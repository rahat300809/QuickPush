const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { store, historyStore } = require('./store');
const { runGitPush } = require('./git-service');
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
    execFile('git', args, { cwd }, (err, stdout) => {
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
