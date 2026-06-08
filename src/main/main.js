const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { store, historyStore } = require('./store');
const { runGitPush, runGitCommit } = require('./git-service');
const { getGitCommandPath, downloadGitInstaller, runGitSetup, configureGit } = require('./git-installer');
const {
  registerContextMenu,
  unregisterContextMenu,
  checkContextMenuStatus
} = require('./menu-registry');

// Handle Squirrel startup events for Windows installer
if (handleSquirrelEvent()) {
  process.exit(0);
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(path.dirname(process.execPath));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess;
    try {
      spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
    } catch (e) {}
    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(path.join(appFolder, '..', 'Update.exe'), args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Create shortcut on desktop/start menu
      spawnUpdate(['--createShortcut', exeName]);
      setTimeout(() => app.quit(), 400);
      return true;

    case '--squirrel-uninstall':
      // Remove shortcuts
      spawnUpdate(['--removeShortcut', exeName]);
      setTimeout(() => app.quit(), 400);
      return true;

    case '--squirrel-obsolete':
      app.quit();
      return true;
  }
  return false;
}

let mainWindow = null;
let initialFolder = null;

// Parse the folder path from arguments
function parseFolderPathFromArgs(argv) {
  // Skip the first arg (executable) and second if in dev (usually '.')
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    // Ignore arguments starting with dash (flags)
    if (arg.startsWith('-')) continue;
    try {
      if (path.isAbsolute(arg) && fs.existsSync(arg)) {
        const stat = fs.statSync(arg);
        if (stat.isDirectory()) {
          return path.resolve(arg);
        }
      }
    } catch (e) {
      // ignore path resolution/access errors
    }
  }
  return null;
}

// Check for single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  initialFolder = parseFolderPathFromArgs(process.argv);

  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const folderPath = parseFolderPathFromArgs(commandLine);
      if (folderPath) {
        mainWindow.webContents.send('folder-loaded', folderPath);
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 860,
    minWidth: 700,
    minHeight: 750,
    show: false,
    title: 'Git Quick Push',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('get-saved-url', (event, folderPath) => {
  return store.getSavedUrl(folderPath);
});

ipcMain.handle('save-url', (event, folderPath, repoUrl) => {
  store.saveUrl(folderPath, repoUrl);
  return true;
});

ipcMain.handle('run-git-push', async (event, { folderPath, repoUrl, commitMessage, force }) => {
  try {
    await runGitPush({ folderPath, repoUrl, commitMessage, force }, (type, text) => {
      if (mainWindow) {
        mainWindow.webContents.send('git-log', { type, text });
      }
    });
    // Log success
    historyStore.addLog({
      folderPath,
      folderName: path.basename(folderPath),
      repoUrl,
      commitMessage,
      status: 'Success'
    });
    return { success: true };
  } catch (error) {
    // Log failure
    historyStore.addLog({
      folderPath,
      folderName: path.basename(folderPath),
      repoUrl,
      commitMessage,
      status: 'Failed',
      error: error.message
    });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('run-git-commit', async (event, { folderPath, repoUrl, commitMessage }) => {
  try {
    await runGitCommit({ folderPath, repoUrl, commitMessage }, (type, text) => {
      if (mainWindow) {
        mainWindow.webContents.send('git-log', { type, text });
      }
    });
    // Log success
    historyStore.addLog({
      folderPath,
      folderName: path.basename(folderPath),
      repoUrl: repoUrl || 'Local Only',
      commitMessage,
      status: 'Committed'
    });
    return { success: true };
  } catch (error) {
    // Log failure
    historyStore.addLog({
      folderPath,
      folderName: path.basename(folderPath),
      repoUrl: repoUrl || 'Local Only',
      commitMessage,
      status: 'Commit Failed',
      error: error.message
    });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('register-context-menu', async () => {
  return await registerContextMenu();
});

ipcMain.handle('unregister-context-menu', async () => {
  return await unregisterContextMenu();
});

ipcMain.handle('check-context-menu-status', async () => {
  return await checkContextMenuStatus();
});

ipcMain.handle('get-initial-folder', () => {
  const folder = initialFolder;
  initialFolder = null; // Clear it so it isn't fetched twice
  return folder;
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Failed to open external link:', error);
    return false;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Helper for recursive file counting
function countFiles(dir) {
  let count = 0;
  try {
    if (!fs.existsSync(dir)) return 0;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (['.git', 'node_modules', 'dist', '.gemini'].includes(item)) continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        count += countFiles(fullPath);
      } else {
        count++;
      }
    }
  } catch (e) {
    // ignore
  }
  return count;
}

// Git command quick executor
function runGitCommand(args, cwd) {
  return new Promise((resolve) => {
    const gitCmd = getGitCommandPath() || 'git';
    execFile(gitCmd, args, { cwd }, (err, stdout) => {
      if (err) resolve('');
      else resolve(stdout);
    });
  });
}

// Stats & history retrieval handlers
ipcMain.handle('get-folder-stats', async (event, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { filesCount: 0, gitStatus: 'N/A', repoConnected: 'No' };
  }

  const filesCount = countFiles(folderPath);

  if (getGitCommandPath() === null) {
    return { filesCount, gitStatus: 'No Git', repoConnected: 'No' };
  }

  const dotGitPath = path.join(folderPath, '.git');
  if (!fs.existsSync(dotGitPath)) {
    return { filesCount, gitStatus: 'Not Init', repoConnected: 'No' };
  }

  let gitStatus = 'Clean';
  try {
    const status = await runGitCommand(['status', '--porcelain'], folderPath);
    if (status.trim().length > 0) {
      gitStatus = 'Changes';
    } else {
      const branchInfo = await runGitCommand(['status', '-sb'], folderPath);
      const aheadMatch = branchInfo.match(/\[ahead\s+(\d+)\]/);
      if (aheadMatch) {
        gitStatus = `Ahead by ${aheadMatch[1]}`;
      }
    }
  } catch (e) {
    gitStatus = 'Error';
  }

  let repoConnected = 'No';
  try {
    const url = await runGitCommand(['remote', 'get-url', 'origin'], folderPath);
    if (url.trim()) {
      repoConnected = 'Live';
    }
  } catch (e) {
    repoConnected = 'No';
  }

  return { filesCount, gitStatus, repoConnected };
});

ipcMain.handle('get-recent-repos', () => {
  const entries = [];
  try {
    for (const [folderPath, url] of Object.entries(store.data)) {
      if (fs.existsSync(folderPath)) {
        entries.push({
          path: folderPath,
          url: url,
          name: path.basename(folderPath)
        });
      }
    }
  } catch (error) {
    console.error('Error fetching recent repos:', error);
  }
  return entries.slice(-5).reverse();
});

ipcMain.handle('get-sync-history', () => {
  return historyStore.getLogs();
});

ipcMain.handle('clear-sync-history', () => {
  historyStore.clearLogs();
  return true;
});

ipcMain.handle('untrack-repo', (event, folderPath) => {
  store.removeUrl(folderPath);
  return true;
});

ipcMain.handle('is-git-installed', () => {
  return getGitCommandPath() !== null;
});

ipcMain.handle('install-git', async (event, { username, email }) => {
  const tempPath = path.join(app.getPath('temp'), 'Git-Setup-Temp.exe');
  try {
    if (mainWindow) mainWindow.webContents.send('git-log', { type: 'info', text: 'Preparing Git installer download...' });
    
    // 1. Download Git
    if (mainWindow) mainWindow.webContents.send('git-log', { type: 'info', text: 'Downloading Git for Windows (v2.45.1)...' });
    let lastPercent = -1;
    await downloadGitInstaller(tempPath, (downloaded, total) => {
      const percent = Math.round((downloaded / total) * 100);
      if (percent % 10 === 0 && percent !== lastPercent && mainWindow) {
        lastPercent = percent;
        mainWindow.webContents.send('git-log', { type: 'info', text: `Git download progress: ${percent}%` });
      }
    });
    
    if (mainWindow) mainWindow.webContents.send('git-log', { type: 'info', text: 'Download complete! Starting silent background setup...' });
    
    // 2. Install Git
    await runGitSetup(tempPath);
    
    // Clean up installer exe
    fs.unlink(tempPath, () => {});
    
    // 3. Configure Git Global credentials
    if (mainWindow) mainWindow.webContents.send('git-log', { type: 'info', text: 'Setup finished! Configuring global username and email...' });
    await configureGit(username, email);
    
    if (mainWindow) mainWindow.webContents.send('git-log', { type: 'success', text: 'Git has been successfully configured globally!' });
    return { success: true };
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlink(tempPath, () => {});
    if (mainWindow) mainWindow.webContents.send('git-log', { type: 'error', text: `Git Installation failed: ${error.message}` });
    return { success: false, error: error.message };
  }
});

function generateHistoryHtml(logs) {
  const escapeHtml = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  };

  const successCount = logs.filter(l => l.status === 'Success').length;
  const committedCount = logs.filter(l => l.status === 'Committed').length;
  const failedCount = logs.filter(l => l.status === 'Failed' || l.status === 'Commit Failed').length;
  const totalCount = logs.length;

  const rowsHtml = logs.map(log => {
    const date = new Date(log.timestamp).toLocaleString();
    let statusBadgeColor = '#ef4444'; // default red
    let statusText = log.status;
    if (log.status === 'Success') statusBadgeColor = '#10b981'; // green
    if (log.status === 'Committed') statusBadgeColor = '#3b82f6'; // blue
    
    return `
      <tr>
        <td style="white-space: nowrap;">${date}</td>
        <td>
          <strong style="color: #0f172a; font-size: 0.9em;">${escapeHtml(log.folderName)}</strong><br/>
          <span style="font-size: 0.75em; color: #64748b;">${escapeHtml(log.folderPath)}</span>
        </td>
        <td><span style="font-size: 0.8em; color: #10b981; font-weight: 600;">${escapeHtml(log.repoUrl)}</span></td>
        <td><span style="font-style: italic; font-size: 0.85em;">"${escapeHtml(log.commitMessage)}"</span></td>
        <td>
          <span style="
            background: ${statusBadgeColor}15;
            color: ${statusBadgeColor};
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.72rem;
            font-weight: 700;
            display: inline-block;
          ">${statusText}</span>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Git Quick Push History</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #1e293b;
          background-color: #ffffff;
          margin: 0;
          padding: 24px;
          -webkit-print-color-adjust: exact;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .logo-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 8px;
        }
        .title-text h1 {
          font-size: 1.5rem;
          margin: 0;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }
        .title-text p {
          font-size: 0.8rem;
          margin: 4px 0 0 0;
          color: #475569;
        }
        .report-meta {
          font-size: 0.78rem;
          color: #64748b;
          text-align: right;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          background: #f8fafc;
          text-align: center;
        }
        .stat-val {
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 0.7rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        th, td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.8rem;
        }
        th {
          background-color: #f1f5f9;
          color: #475569;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.72rem;
          letter-spacing: 0.05em;
        }
        tr:hover {
          background-color: #f8fafc;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-title">
          <div class="logo"></div>
          <div class="title-text">
            <h1>Git Quick Push</h1>
            <p>Sync & Commit History Report</p>
          </div>
        </div>
        <div class="report-meta">
          <strong>Generated on:</strong> ${new Date().toLocaleString()}<br/>
          <strong>Source:</strong> Local sync history logs
        </div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-val">${totalCount}</div>
          <div class="stat-label">Total Syncs</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color: #10b981;">${successCount}</div>
          <div class="stat-label">Pushes</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color: #3b82f6;">${committedCount}</div>
          <div class="stat-label">Local Commits</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color: #ef4444;">${failedCount}</div>
          <div class="stat-label">Failures</div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Local Directory</th>
            <th>Remote URL</th>
            <th>Commit Message</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

ipcMain.handle('export-history-pdf', async (event) => {
  const logs = historyStore.getLogs();
  if (logs.length === 0) {
    throw new Error('No history logs available to export.');
  }

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Sync History PDF',
    defaultPath: path.join(app.getPath('downloads'), 'git-push-history.pdf'),
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] }
    ]
  });

  if (canceled || !filePath) {
    return { success: false, reason: 'cancelled' };
  }

  const htmlContent = generateHistoryHtml(logs);

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  try {
    const data = await pdfWindow.webContents.printToPDF({
      margins: {
        top: 0.4,
        bottom: 0.4,
        left: 0.4,
        right: 0.4
      },
      pageSize: 'A4',
      printBackground: true
    });

    fs.writeFileSync(filePath, data);
    return { success: true, filePath };
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw error;
  } finally {
    pdfWindow.destroy();
  }
});

