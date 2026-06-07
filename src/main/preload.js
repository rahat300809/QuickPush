const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getSavedUrl: (folderPath) => ipcRenderer.invoke('get-saved-url', folderPath),
  saveUrl: (folderPath, repoUrl) => ipcRenderer.invoke('save-url', folderPath, repoUrl),
  runGitPush: (params) => ipcRenderer.invoke('run-git-push', params),
  onGitLog: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('git-log', listener);
    return () => ipcRenderer.removeListener('git-log', listener);
  },
  registerContextMenu: () => ipcRenderer.invoke('register-context-menu'),
  unregisterContextMenu: () => ipcRenderer.invoke('unregister-context-menu'),
  checkContextMenuStatus: () => ipcRenderer.invoke('check-context-menu-status'),
  onFolderLoaded: (callback) => {
    const listener = (event, folderPath) => callback(folderPath);
    ipcRenderer.on('folder-loaded', listener);
    return () => ipcRenderer.removeListener('folder-loaded', listener);
  },
  getInitialFolder: () => ipcRenderer.invoke('get-initial-folder'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getFolderStats: (folderPath) => ipcRenderer.invoke('get-folder-stats', folderPath),
  getRecentRepos: () => ipcRenderer.invoke('get-recent-repos'),
  getSyncHistory: () => ipcRenderer.invoke('get-sync-history'),
  clearSyncHistory: () => ipcRenderer.invoke('clear-sync-history'),
  untrackRepo: (folderPath) => ipcRenderer.invoke('untrack-repo', folderPath),
  isGitInstalled: () => ipcRenderer.invoke('is-git-installed'),
  installGit: (username, email) => ipcRenderer.invoke('install-git', { username, email })
});
