const { spawn } = require('child_process');
const { app } = require('electron');

function runReg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('reg', args);
    let stderr = '';
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`reg.exe failed with code ${code}. Stderr: ${stderr.trim()}`));
      }
    });
  });
}

/**
 * Register "Push to GitHub" to HKEY_CURRENT_USER context menu.
 */
async function registerContextMenu() {
  const isPackaged = app.isPackaged;
  const execPath = process.execPath;
  const appPath = app.getAppPath();
  
  // Build the command executed by Windows Explorer
  const commandString = isPackaged
    ? `"${execPath}" "%1"`
    : `"${execPath}" "${appPath}" "%1"`;

  const iconPath = execPath; // Use the application icon

  try {
    // 1. Create base key and set display label
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Directory\\shell\\GitQuickPush',
      '/ve',
      '/t',
      'REG_SZ',
      '/d',
      'Push to GitHub',
      '/f'
    ]);

    // 2. Set Icon string value
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Directory\\shell\\GitQuickPush',
      '/v',
      'Icon',
      '/t',
      'REG_SZ',
      '/d',
      iconPath,
      '/f'
    ]);

    // 3. Set subkey command value
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Directory\\shell\\GitQuickPush\\command',
      '/ve',
      '/t',
      'REG_SZ',
      '/d',
      commandString,
      '/f'
    ]);

    return true;
  } catch (error) {
    console.error('Failed to register context menu:', error);
    throw error;
  }
}

/**
 * Unregister context menu.
 */
async function unregisterContextMenu() {
  try {
    await runReg([
      'delete',
      'HKCU\\Software\\Classes\\Directory\\shell\\GitQuickPush',
      '/f'
    ]);
    return true;
  } catch (error) {
    // If it fails because the key is not there, that's fine
    if (error.message.includes('The system was unable to find the specified registry key')) {
      return true;
    }
    console.error('Failed to unregister context menu:', error);
    throw error;
  }
}

/**
 * Check if context menu is currently registered.
 */
async function checkContextMenuStatus() {
  return new Promise((resolve) => {
    const proc = spawn('reg', [
      'query',
      'HKCU\\Software\\Classes\\Directory\\shell\\GitQuickPush'
    ]);
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    proc.on('error', () => {
      resolve(false);
    });
  });
}

module.exports = {
  registerContextMenu,
  unregisterContextMenu,
  checkContextMenuStatus
};
