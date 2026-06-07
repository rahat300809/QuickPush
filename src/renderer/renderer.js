// Select DOM elements
const folderPathInput = document.getElementById('folder-path');
const btnBrowse = document.getElementById('btn-browse');
const repoUrlInput = document.getElementById('repo-url');
const commitMessageInput = document.getElementById('commit-message');
const btnPush = document.getElementById('btn-push');
const contextMenuCheckbox = document.getElementById('context-menu-checkbox');
const autoscrollCheckbox = document.getElementById('checkbox-autoscroll');
const btnClearLogs = document.getElementById('btn-clear-logs');
const terminalLogs = document.getElementById('terminal-logs');
const statusBanner = document.getElementById('status-banner');

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

// Update UI with selected folder
async function handleFolderSelected(folderPath) {
  if (!folderPath) return;
  
  folderPathInput.value = folderPath;
  appendLog('info', `Selected folder: ${folderPath}`);
  
  // Get and populate last saved Repo URL for this folder
  try {
    const savedUrl = await window.api.getSavedUrl(folderPath);
    if (savedUrl) {
      repoUrlInput.value = savedUrl;
      appendLog('info', `Loaded previously saved URL: ${savedUrl}`);
    } else {
      repoUrlInput.value = '';
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

// Context Menu Switch logic
contextMenuCheckbox.addEventListener('change', async () => {
  const shouldRegister = contextMenuCheckbox.checked;
  
  try {
    if (shouldRegister) {
      await window.api.registerContextMenu();
      appendLog('success', 'Windows Explorer context menu item "Push to GitHub" registered successfully!');
    } else {
      await window.api.unregisterContextMenu();
      appendLog('info', 'Windows Explorer context menu item "Push to GitHub" removed.');
    }
  } catch (error) {
    appendLog('error', `Failed to modify Explorer context menu: ${error.message}`);
    // Revert checkbox state
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
function setFormLocked(locked) {
  folderPathInput.disabled = locked;
  btnBrowse.disabled = locked;
  repoUrlInput.disabled = locked;
  commitMessageInput.disabled = locked;
  btnPush.disabled = locked;
  
  if (locked) {
    btnPush.classList.add('loading');
  } else {
    btnPush.classList.remove('loading');
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

// Git Push Trigger
btnPush.addEventListener('click', async () => {
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

  // Validate Repo URL structure roughly
  const gitUrlRegex = /^(https:\/\/github\.com\/|git@github\.com:).+\.git$/;
  if (!gitUrlRegex.test(repoUrl)) {
    showBanner('error', 'Invalid repository URL. It must be a valid GitHub HTTPS or SSH URL (ending with .git).');
    appendLog('error', `Validation error: Invalid GitHub URL format: "${repoUrl}"`);
    return;
  }

  const finalCommitMessage = commitMessage || 'Auto Commit';

  // Proceed with execution
  hideBanner();
  setFormLocked(true);
  appendLog('system', '\n=== Starting Git Quick Push pipeline ===');

  try {
    // 1. Save Repo URL history
    await window.api.saveUrl(folderPath, repoUrl);
    
    // 2. Setup stdout listener
    setupLogsStream();

    // 3. Execute push
    const result = await window.api.runGitPush({
      folderPath,
      repoUrl,
      commitMessage: finalCommitMessage
    });

    if (result.success) {
      showBanner('success', 'Repository successfully pushed to GitHub!');
      appendLog('success', '=== Pipeline completed successfully! ===\n');
    } else {
      showBanner('error', result.error || 'An unexpected error occurred during Git execution.');
      appendLog('error', `=== Pipeline failed: ${result.error} ===\n`);
    }
  } catch (error) {
    showBanner('error', error.message || 'An unexpected error occurred.');
    appendLog('error', `=== Pipeline error: ${error.message} ===\n`);
  } finally {
    setFormLocked(false);
  }
});

// Handle when folder is loaded via second instance
window.api.onFolderLoaded(async (folderPath) => {
  appendLog('info', `Received directory from Explorer right-click: ${folderPath}`);
  await handleFolderSelected(folderPath);
});

// App Initialization
async function init() {
  try {
    // 1. Check registry menu status to toggle switch
    const registered = await window.api.checkContextMenuStatus();
    contextMenuCheckbox.checked = registered;
  } catch (error) {
    console.error('Failed to query registry context menu status:', error);
  }

  try {
    // 2. Check if a folder was loaded on startup (from registry double-click)
    const initialFolder = await window.api.getInitialFolder();
    if (initialFolder) {
      appendLog('info', `App launched with directory argument: ${initialFolder}`);
      await handleFolderSelected(initialFolder);
    }
  } catch (error) {
    console.error('Failed to retrieve initial folder path:', error);
  }
}

// Run init
init();
