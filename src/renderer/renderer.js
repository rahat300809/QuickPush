// DOM elements selection
const folderPathInput = document.getElementById('folder-path');
const btnBrowse = document.getElementById('btn-browse');
const repoUrlInput = document.getElementById('repo-url');
const commitMessageInput = document.getElementById('commit-message');
const btnPush = document.getElementById('btn-push');
const btnCommit = document.getElementById('btn-commit');
const contextMenuCheckbox = document.getElementById('context-menu-checkbox');
const autoscrollCheckbox = document.getElementById('checkbox-autoscroll');
const btnClearLogs = document.getElementById('btn-clear-logs');
const terminalLogs = document.getElementById('terminal-logs');
const statusBanner = document.getElementById('status-banner');

// Drag and drop dropzone
const dragDropZone = document.getElementById('drag-drop-zone');

// Dynamic stats elements
const statGitStatus = document.getElementById('stat-git-status');
const statRepoLink = document.getElementById('stat-repo-link');
const statFilesCount = document.getElementById('stat-files-count');
const statLastPush = document.getElementById('stat-last-push');

// Force Push Modal elements
const forceModal = document.getElementById('force-modal');
const btnForceCancel = document.getElementById('btn-force-cancel');
const btnForceConfirm = document.getElementById('btn-force-confirm');

// Recent Repos list & clear options
const recentReposList = document.getElementById('recent-repos-list');
const btnSidebarReset = document.getElementById('btn-sidebar-reset');
const urlStatusBadge = document.getElementById('url-status-badge');
const aiMsgCheckbox = document.getElementById('ai-msg-checkbox');

// Repositories View elements
const reposViewList = document.getElementById('repos-view-list');

// History View elements
const historyTableBody = document.getElementById('history-view-table-body');
const btnClearHistory = document.getElementById('btn-clear-history');

// Settings View elements
const btnSettingsRegister = document.getElementById('btn-settings-register');
const btnSettingsUnregister = document.getElementById('btn-settings-unregister');
const settingsMenuStatus = document.getElementById('settings-menu-status-text');
const btnSettingsClearAll = document.getElementById('btn-settings-clear-all');

// Git Automatic Installer elements
const gitInstallModal = document.getElementById('git-install-modal');
const btnGitInstallCancel = document.getElementById('btn-git-install-cancel');
const btnGitInstallConfirm = document.getElementById('btn-git-install-confirm');
const gitUsernameInput = document.getElementById('git-username');
const gitEmailInput = document.getElementById('git-email');
const gitInstallError = document.getElementById('git-install-error');

// Helper to append a line to the terminal
function appendLog(type, text) {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.textContent = text;
  terminalLogs.appendChild(line);
  
  if (autoscrollCheckbox.checked) {
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }
}

// Clear terminal logs
btnClearLogs.addEventListener('click', () => {
  terminalLogs.innerHTML = '';
  appendLog('info', 'Logs cleared.');
});

// Calculate and refresh stats
async function updateStats(folderPath) {
  if (!folderPath) {
    statGitStatus.textContent = 'N/A';
    statGitStatus.style.color = 'var(--text-primary)';
    statRepoLink.textContent = 'No';
    statRepoLink.style.color = 'var(--text-primary)';
    statFilesCount.textContent = '0 Files';
    return;
  }
  
  try {
    const stats = await window.api.getFolderStats(folderPath);
    statFilesCount.textContent = `${stats.filesCount} Files`;
    
    statGitStatus.textContent = stats.gitStatus;
    if (stats.gitStatus === 'Clean') {
      statGitStatus.style.color = 'var(--success-color)';
      statGitStatus.style.cursor = 'default';
      statGitStatus.title = '';
    } else if (stats.gitStatus === 'Changes') {
      statGitStatus.style.color = 'var(--warning-color)';
      statGitStatus.style.cursor = 'default';
      statGitStatus.title = '';
    } else if (stats.gitStatus.startsWith('Ahead')) {
      statGitStatus.style.color = 'var(--info-color)';
      statGitStatus.style.cursor = 'default';
      statGitStatus.title = '';
    } else if (stats.gitStatus === 'No Git') {
      statGitStatus.style.color = 'var(--error-color)';
      statGitStatus.style.cursor = 'pointer';
      statGitStatus.title = 'Click to install Git';
    } else {
      statGitStatus.style.color = 'var(--text-primary)';
      statGitStatus.style.cursor = 'default';
      statGitStatus.title = '';
    }
    
    statRepoLink.textContent = stats.repoConnected;
    if (stats.repoConnected === 'Live') {
      statRepoLink.style.color = 'var(--success-color)';
    } else {
      statRepoLink.style.color = 'var(--error-color)';
    }
  } catch (error) {
    console.error('Failed to fetch folder stats:', error);
  }
}

// Fetch and load recent repos
async function loadRecentRepos() {
  try {
    const repos = await window.api.getRecentRepos();
    recentReposList.innerHTML = '';
    if (repos.length === 0) {
      recentReposList.innerHTML = '<div class="recent-repo-empty">No recent repositories.</div>';
      return;
    }
    repos.slice(0, 3).forEach(repo => {
      const item = document.createElement('div');
      item.className = 'recent-repo-item';
      item.innerHTML = `
        <svg class="icon-green" style="width:18px;height:18px;margin-right:8px;" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        <div class="recent-repo-details">
          <span class="recent-repo-name">${repo.name}</span>
          <span class="recent-repo-path" title="${repo.path}">${repo.path}</span>
        </div>
      `;
      item.addEventListener('click', async () => {
        await handleFolderSelected(repo.path);
        repoUrlInput.value = repo.url;
        validateRepoUrl(repo.url);
      });
      recentReposList.appendChild(item);
    });
  } catch (error) {
    console.error('Failed to load recent repos:', error);
  }
}

// Update UI with selected folder
async function handleFolderSelected(folderPath) {
  if (!folderPath) return;
  
  folderPathInput.value = folderPath;
  appendLog('info', `Folder selected: ${folderPath}`);
  
  // Refresh stats
  await updateStats(folderPath);
  
  // Get and populate last saved Repo URL for this folder
  try {
    const savedUrl = await window.api.getSavedUrl(folderPath);
    if (savedUrl) {
      repoUrlInput.value = savedUrl;
      validateRepoUrl(savedUrl);
      appendLog('info', `Loaded URL history: ${savedUrl}`);
    } else {
      repoUrlInput.value = '';
      validateRepoUrl('');
    }
  } catch (error) {
    console.error('Error fetching saved URL:', error);
  }
}

// Handle folder browse button
btnBrowse.addEventListener('click', async () => {
  try {
    const folderPath = await window.api.selectFolder();
    if (folderPath) {
      await handleFolderSelected(folderPath);
    }
  } catch (error) {
    appendLog('error', `Failed to open directory browser: ${error.message}`);
  }
});

// Drag and drop events
dragDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dragDropZone.classList.add('hover');
});

dragDropZone.addEventListener('dragleave', () => {
  dragDropZone.classList.remove('hover');
});

dragDropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDropZone.classList.remove('hover');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const path = files[0].path;
    await handleFolderSelected(path);
  }
});

// Click on drag-drop zone triggers folder browser
dragDropZone.addEventListener('click', async () => {
  try {
    const folderPath = await window.api.selectFolder();
    if (folderPath) {
      await handleFolderSelected(folderPath);
    }
  } catch (error) {
    appendLog('error', `Failed to open directory browser: ${error.message}`);
  }
});

// Verify Repo URL format on input
function validateRepoUrl(url) {
  const gitUrlRegex = /^(https:\/\/github\.com\/|git@github\.com:).+\.git$/;
  if (gitUrlRegex.test(url)) {
    urlStatusBadge.style.display = 'flex';
  } else {
    urlStatusBadge.style.display = 'none';
  }
}

repoUrlInput.addEventListener('input', (e) => {
  validateRepoUrl(e.target.value.trim());
});

// Context Menu Switch logic
contextMenuCheckbox.addEventListener('change', async () => {
  const shouldRegister = contextMenuCheckbox.checked;
  
  try {
    if (shouldRegister) {
      await window.api.registerContextMenu();
      appendLog('success', 'Explorer context menu item "Push to GitHub" registered!');
    } else {
      await window.api.unregisterContextMenu();
      appendLog('info', 'Explorer context menu item "Push to GitHub" removed.');
    }
    await updateSettingsPanel();
  } catch (error) {
    appendLog('error', `Failed to modify Explorer context menu: ${error.message}`);
    contextMenuCheckbox.checked = !shouldRegister;
  }
});

// Git logs stream listener
let cleanupLogsListener = null;

function setupLogsStream() {
  if (cleanupLogsListener) cleanupLogsListener();
  
  cleanupLogsListener = window.api.onGitLog(({ type, text }) => {
    appendLog(type, text);
  });
}

// Disable/Enable form controls during operation
function setFormLocked(locked, activeBtn = null) {
  folderPathInput.disabled = locked;
  btnBrowse.disabled = locked;
  repoUrlInput.disabled = locked;
  commitMessageInput.disabled = locked;
  btnPush.disabled = locked;
  btnCommit.disabled = locked;
  btnSidebarReset.disabled = locked;
  
  if (locked) {
    if (activeBtn) {
      activeBtn.classList.add('loading');
    }
  } else {
    btnPush.classList.remove('loading');
    btnCommit.classList.remove('loading');
  }
}

// Show Status Banner
function showBanner(type, message) {
  statusBanner.className = `status-banner ${type}`;
  statusBanner.textContent = message;
}

function hideBanner() {
  statusBanner.className = 'status-banner';
  statusBanner.textContent = '';
}

// Main Git Push Trigger
async function executePush(force = false) {
  // Intercept if Git is not installed
  const gitInstalled = await window.api.isGitInstalled();
  if (!gitInstalled) {
    appendLog('warning', 'Git is not installed on your system. Launching automatic setup...');
    showGitInstallModal();
    return;
  }

  const folderPath = folderPathInput.value.trim();
  const repoUrl = repoUrlInput.value.trim();
  const commitMessage = commitMessageInput.value.trim();

  // Basic Validation
  if (!folderPath) {
    showBanner('error', 'Please select a local project directory.');
    appendLog('error', 'Validation error: Local folder path is missing.');
    return;
  }
  
  if (!repoUrl) {
    showBanner('error', 'Please enter a GitHub repository URL.');
    appendLog('error', 'Validation error: GitHub repository URL is missing.');
    return;
  }

  // Validate Repo URL structure
  const gitUrlRegex = /^(https:\/\/github\.com\/|git@github\.com:).+\.git$/;
  if (!gitUrlRegex.test(repoUrl)) {
    showBanner('error', 'Invalid URL format. It must be a valid GitHub HTTPS or SSH URL (ending with .git).');
    appendLog('error', `Validation error: Invalid GitHub URL format: "${repoUrl}"`);
    return;
  }

  const finalCommitMessage = commitMessage || 'Auto Commit';

  hideBanner();
  setFormLocked(true, btnPush);
  appendLog('system', `\n=== Starting Git Push pipeline (Force: ${force}) ===`);

  try {
    await window.api.saveUrl(folderPath, repoUrl);
    setupLogsStream();

    const result = await window.api.runGitPush({
      folderPath,
      repoUrl,
      commitMessage: finalCommitMessage,
      force
    });

    if (result.success) {
      showBanner('success', force ? 'Repository force pushed to GitHub!' : 'Repository successfully pushed to GitHub!');
      appendLog('success', '=== Pipeline completed successfully! ===\n');
      
      const now = new Date();
      statLastPush.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      await updateStats(folderPath);
      await loadRecentRepos();
    } else {
      if (result.error && result.error.includes('GIT_PUSH_CONFLICT')) {
        appendLog('error', 'Push failed: Remote changes detected. Displaying Force Push prompt...');
        showBanner('error', 'Push rejected: The remote contains commits that do not exist locally.');
        
        // Open Force Push modal
        forceModal.classList.add('active');
      } else {
        showBanner('error', result.error || 'An unexpected error occurred during Git execution.');
        appendLog('error', `=== Pipeline failed: ${result.error} ===\n`);
      }
    }
  } catch (error) {
    showBanner('error', error.message || 'An unexpected error occurred.');
    appendLog('error', `=== Pipeline error: ${error.message} ===\n`);
  } finally {
    setFormLocked(false);
  }
}

// Main Git Commit Trigger
async function executeCommit() {
  // Intercept if Git is not installed
  const gitInstalled = await window.api.isGitInstalled();
  if (!gitInstalled) {
    appendLog('warning', 'Git is not installed on your system. Launching automatic setup...');
    showGitInstallModal();
    return;
  }

  const folderPath = folderPathInput.value.trim();
  const repoUrl = repoUrlInput.value.trim();
  const commitMessage = commitMessageInput.value.trim();

  // Basic Validation
  if (!folderPath) {
    showBanner('error', 'Please select a local project directory.');
    appendLog('error', 'Validation error: Local folder path is missing.');
    return;
  }

  const finalCommitMessage = commitMessage || 'Auto Commit';

  hideBanner();
  setFormLocked(true, btnCommit);
  appendLog('system', `\n=== Starting Git Commit pipeline ===`);

  try {
    if (repoUrl) {
      const gitUrlRegex = /^(https:\/\/github\.com\/|git@github\.com:).+\.git$/;
      if (gitUrlRegex.test(repoUrl)) {
        await window.api.saveUrl(folderPath, repoUrl);
      }
    }
    setupLogsStream();

    const result = await window.api.runGitCommit({
      folderPath,
      repoUrl,
      commitMessage: finalCommitMessage
    });

    if (result.success) {
      showBanner('success', 'Changes successfully committed locally!');
      appendLog('success', '=== Commit pipeline completed successfully! ===\n');
      
      await updateStats(folderPath);
      await loadRecentRepos();
    } else {
      showBanner('error', result.error || 'An unexpected error occurred during Git execution.');
      appendLog('error', `=== Commit pipeline failed: ${result.error} ===\n`);
    }
  } catch (error) {
    showBanner('error', error.message || 'An unexpected error occurred.');
    appendLog('error', `=== Commit pipeline error: ${error.message} ===\n`);
  } finally {
    setFormLocked(false);
  }
}

btnPush.addEventListener('click', () => executePush(false));
btnCommit.addEventListener('click', () => executeCommit());

// Force Push Modal Actions
btnForceCancel.addEventListener('click', () => {
  forceModal.classList.remove('active');
  appendLog('info', 'Force push aborted by user.');
});

btnForceConfirm.addEventListener('click', () => {
  forceModal.classList.remove('active');
  executePush(true);
});

// Reset Dashboard / New Repository button
btnSidebarReset.addEventListener('click', () => {
  folderPathInput.value = '';
  repoUrlInput.value = '';
  commitMessageInput.value = 'Auto Commit';
  aiMsgCheckbox.checked = false;
  validateRepoUrl('');
  hideBanner();
  updateStats('');
  appendLog('info', 'Dashboard reset. Select a folder to configure a new repository.');
});

// AI Message Toggle
aiMsgCheckbox.addEventListener('change', () => {
  if (aiMsgCheckbox.checked) {
    commitMessageInput.value = 'AI: Refactored workspace config & synchronized files';
  } else {
    commitMessageInput.value = 'Auto Commit';
  }
});

// Handle click on external profile links
document.querySelectorAll('.dev-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const url = link.getAttribute('data-url');
    if (url) {
      window.api.openExternal(url);
    }
  });
});

// Handle when folder is loaded via second instance
window.api.onFolderLoaded(async (folderPath) => {
  appendLog('info', `Received directory from right-click: ${folderPath}`);
  await handleFolderSelected(folderPath);
});

// View Navigation & Router implementation
const menuItems = {
  'menu-dashboard': 'view-dashboard',
  'menu-repos': 'view-repos',
  'menu-history': 'view-history',
  'menu-settings': 'view-settings'
};

function updateHeaderTitles(menuId) {
  const title = document.getElementById('view-title-label');
  const subtitle = document.getElementById('view-subtitle-label');
  
  if (menuId === 'menu-dashboard') {
    title.textContent = 'Git Quick Push';
    subtitle.textContent = 'Push your projects to GitHub in one click';
  } else if (menuId === 'menu-repos') {
    title.textContent = 'Tracked Repositories';
    subtitle.textContent = 'Manage local directories mapped to GitHub';
  } else if (menuId === 'menu-history') {
    title.textContent = 'Sync History Tracker';
    subtitle.textContent = 'View and manage synchronizations log database';
  } else if (menuId === 'menu-settings') {
    title.textContent = 'Application Settings';
    subtitle.textContent = 'Configure preferences and system integration';
  }
}

Object.entries(menuItems).forEach(([menuId, viewId]) => {
  const menuBtn = document.getElementById(menuId);
  const viewDiv = document.getElementById(viewId);
  
  if (menuBtn && viewDiv) {
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Toggle active menu item
      Object.keys(menuItems).forEach(id => {
        document.getElementById(id).classList.remove('active');
      });
      menuBtn.classList.add('active');
      
      // Toggle active view
      Object.values(menuItems).forEach(vId => {
        document.getElementById(vId).classList.remove('active');
      });
      viewDiv.classList.add('active');
      
      // Update page labels
      updateHeaderTitles(menuId);
      
      // Trigger data loads
      if (menuId === 'menu-repos') loadTrackedRepos();
      if (menuId === 'menu-history') loadSyncHistory();
      if (menuId === 'menu-settings') updateSettingsPanel();
    });
  }
});

// View All link prints full URL histories in console logs
document.getElementById('btn-view-all').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('menu-history').click();
});

// Populate Repositories View
async function loadTrackedRepos() {
  try {
    const repos = await window.api.getRecentRepos();
    reposViewList.innerHTML = '';
    if (repos.length === 0) {
      reposViewList.innerHTML = '<div class="recent-repo-empty" style="grid-column: 1/-1;">No configured repositories found. Sync a folder to get started.</div>';
      return;
    }
    repos.forEach(repo => {
      const card = document.createElement('div');
      card.className = 'repo-card';
      card.innerHTML = `
        <div class="repo-card-meta">
          <div class="repo-card-name">${repo.name}</div>
          <div class="repo-card-path" title="${repo.path}">${repo.path}</div>
          <div class="repo-card-url" title="${repo.url}">${repo.url}</div>
        </div>
        <div class="repo-card-actions">
          <button class="btn-repo-card btn-untrack" data-path="${repo.path}">Untrack</button>
          <button class="btn-repo-card btn-push" data-path="${repo.path}" data-url="${repo.url}">Load Repository</button>
        </div>
      `;
      
      // Untrack
      card.querySelector('.btn-untrack').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Remove tracking mapping for "${repo.name}"?\nLocal files will not be deleted.`)) {
          await window.api.untrackRepo(repo.path);
          await loadTrackedRepos();
          await loadRecentRepos();
        }
      });
      
      // Load and Push
      card.querySelector('.btn-push').addEventListener('click', async () => {
        await handleFolderSelected(repo.path);
        repoUrlInput.value = repo.url;
        validateRepoUrl(repo.url);
        document.getElementById('menu-dashboard').click();
      });
      
      reposViewList.appendChild(card);
    });
  } catch (error) {
    console.error('Failed to load tracked repositories:', error);
  }
}

// Populate History View
async function loadSyncHistory() {
  try {
    const logs = await window.api.getSyncHistory();
    historyTableBody.innerHTML = '';
    if (logs.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 24px;">No sync log events found.</td></tr>';
      return;
    }
    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleString();
      let statusClass = 'failed';
      if (log.status === 'Success') {
        statusClass = 'success';
      } else if (log.status === 'Committed') {
        statusClass = 'committed';
      }
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="white-space: nowrap;">${date}</td>
        <td><strong>${log.folderName}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${log.folderPath}</span></td>
        <td><span style="font-size:0.78rem;">${log.repoUrl}</span></td>
        <td><span style="font-style: italic;">"${log.commitMessage}"</span></td>
        <td><span class="badge-status ${statusClass}">${log.status}</span></td>
      `;
      historyTableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Failed to load sync history:', error);
  }
}

btnClearHistory.addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete your entire sync history tracker logs?')) {
    await window.api.clearSyncHistory();
    await loadSyncHistory();
    appendLog('info', 'Sync history database wiped.');
  }
});

// Settings panel handlers
async function updateSettingsPanel() {
  try {
    const registered = await window.api.checkContextMenuStatus();
    if (registered) {
      settingsMenuStatus.textContent = 'Status: Active';
      settingsMenuStatus.className = 'status-badge-inline active';
    } else {
      settingsMenuStatus.textContent = 'Status: Inactive';
      settingsMenuStatus.className = 'status-badge-inline';
    }
  } catch (error) {
    console.error('Failed to update settings context status:', error);
  }
}

btnSettingsRegister.addEventListener('click', async () => {
  try {
    await window.api.registerContextMenu();
    contextMenuCheckbox.checked = true;
    await updateSettingsPanel();
    appendLog('success', 'Explorer right-click context menu item registered successfully.');
  } catch (error) {
    appendLog('error', `Failed to register context menu: ${error.message}`);
  }
});

btnSettingsUnregister.addEventListener('click', async () => {
  try {
    await window.api.unregisterContextMenu();
    contextMenuCheckbox.checked = false;
    await updateSettingsPanel();
    appendLog('info', 'Explorer right-click context menu item removed.');
  } catch (error) {
    appendLog('error', `Failed to remove context menu: ${error.message}`);
  }
});

btnSettingsClearAll.addEventListener('click', async () => {
  if (confirm('CRITICAL WARNING: This will delete all tracked repositories history and clear the sync history log database. Proceed?')) {
    await window.api.clearSyncHistory();
    
    // Wipes all recent repo paths from history
    try {
      const repos = await window.api.getRecentRepos();
      for (const repo of repos) {
        await window.api.untrackRepo(repo.path);
      }
    } catch (e) {
      console.error(e);
    }
    
    btnSidebarReset.click();
    await loadRecentRepos();
    appendLog('success', 'All local storage databases reset to empty.');
    document.getElementById('menu-dashboard').click();
  }
});

// Sidebar footer Export History to PDF trigger
document.getElementById('link-docs').addEventListener('click', async (e) => {
  e.preventDefault();
  appendLog('system', 'Generating Sync History report...');
  try {
    const result = await window.api.exportHistoryPdf();
    if (result.success) {
      appendLog('success', `PDF Report successfully exported to: ${result.filePath}`);
    } else if (result.reason === 'cancelled') {
      appendLog('info', 'PDF Export cancelled by user.');
    }
  } catch (error) {
    appendLog('error', `Failed to export PDF: ${error.message}`);
    showBanner('error', `PDF Export Error: ${error.message}`);
  }
});
document.getElementById('link-logout').addEventListener('click', () => appendLog('info', 'Logout triggered. Close the app to exit.'));

// Terminal mac dot controls
document.querySelector('.dot.red').addEventListener('click', () => {
  terminalLogs.innerHTML = '';
  appendLog('info', 'Terminal output cleared.');
});

document.querySelector('.dot.yellow').addEventListener('click', () => {
  if (terminalLogs.style.display === 'none') {
    terminalLogs.style.display = 'block';
    appendLog('info', 'Terminal console expanded.');
  } else {
    terminalLogs.style.display = 'none';
  }
});

document.querySelector('.dot.green').addEventListener('click', () => {
  appendLog('system', 'Terminal status check: System online. All systems functional.');
});

// Git Installer Modal Actions
function showGitInstallModal() {
  gitInstallError.style.display = 'none';
  gitInstallError.textContent = '';
  gitUsernameInput.value = '';
  gitEmailInput.value = '';
  gitInstallModal.classList.add('active');
  gitUsernameInput.focus();
}

btnGitInstallCancel.addEventListener('click', () => {
  gitInstallModal.classList.remove('active');
  appendLog('info', 'Git setup aborted by user.');
});

btnGitInstallConfirm.addEventListener('click', async () => {
  const username = gitUsernameInput.value.trim();
  const email = gitEmailInput.value.trim();

  // Basic Validation
  if (!username) {
    gitInstallError.textContent = 'Please enter a GitHub Username.';
    gitInstallError.style.display = 'block';
    gitUsernameInput.focus();
    return;
  }
  
  if (!email) {
    gitInstallError.textContent = 'Please enter a GitHub Email Address.';
    gitInstallError.style.display = 'block';
    gitEmailInput.focus();
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    gitInstallError.textContent = 'Please enter a valid Email Address.';
    gitInstallError.style.display = 'block';
    gitEmailInput.focus();
    return;
  }

  gitInstallError.style.display = 'none';
  gitInstallError.textContent = '';

  // Lock modal inputs
  gitUsernameInput.disabled = true;
  gitEmailInput.disabled = true;
  btnGitInstallCancel.disabled = true;
  btnGitInstallConfirm.disabled = true;
  const originalConfirmText = btnGitInstallConfirm.textContent;
  btnGitInstallConfirm.textContent = 'Installing Git...';

  appendLog('system', '\n=== Starting Git Auto-Installer pipeline ===');

  try {
    setupLogsStream();
    const result = await window.api.installGit(username, email);
    if (result.success) {
      gitInstallModal.classList.remove('active');
      
      // Refresh folder stats
      const folderPath = folderPathInput.value.trim();
      await updateStats(folderPath);
      
      // Auto resume push
      if (folderPath && repoUrlInput.value.trim()) {
        appendLog('success', 'Git setup complete. Automatically resuming your push to GitHub!');
        await executePush(false);
      }
    } else {
      gitInstallError.textContent = `Setup failed: ${result.error}`;
      gitInstallError.style.display = 'block';
      appendLog('error', `Git installation failed: ${result.error}`);
    }
  } catch (err) {
    gitInstallError.textContent = `Setup failed: ${err.message}`;
    gitInstallError.style.display = 'block';
    appendLog('error', `Git installation pipeline error: ${err.message}`);
  } finally {
    gitUsernameInput.disabled = false;
    gitEmailInput.disabled = false;
    btnGitInstallCancel.disabled = false;
    btnGitInstallConfirm.disabled = false;
    btnGitInstallConfirm.textContent = originalConfirmText;
  }
});

// Click Git Status "No Git" badge to configure
statGitStatus.addEventListener('click', async () => {
  const gitInstalled = await window.api.isGitInstalled();
  if (!gitInstalled) {
    showGitInstallModal();
  }
});

// App Initialization
async function init() {
  // 1. Check registry menu status
  try {
    const registered = await window.api.checkContextMenuStatus();
    contextMenuCheckbox.checked = registered;
  } catch (error) {
    console.error('Failed to query registry context menu status:', error);
  }

  // 2. Fetch recent repos
  await loadRecentRepos();

  // 3. Check if a folder was loaded on startup
  try {
    const initialFolder = await window.api.getInitialFolder();
    if (initialFolder) {
      appendLog('info', `App launched with directory argument: ${initialFolder}`);
      await handleFolderSelected(initialFolder);
    }
  } catch (error) {
    console.error('Failed to retrieve initial folder path:', error);
  }
}
