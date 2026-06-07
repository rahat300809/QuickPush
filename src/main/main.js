const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { runGitPush } = require('./git-service');
const {
  registerContextMenu,
  unregisterContextMenu,
  checkContextMenuStatus
} = require('./menu-registry');

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
    height: 720,
    minWidth: 700,
    minHeight: 600,
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

ipcMain.handle('run-git-push', async (event, { folderPath, repoUrl, commitMessage }) => {
  try {
    await runGitPush({ folderPath, repoUrl, commitMessage }, (type, text) => {
      if (mainWindow) {
        mainWindow.webContents.send('git-log', { type, text });
      }
    });
    return { success: true };
  } catch (error) {
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
