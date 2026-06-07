const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { app } = require('electron');

// Stable release URL for Git for Windows 64-bit installer
const GIT_DOWNLOAD_URL = 'https://github.com/git-for-windows/git/releases/download/v2.45.1.windows.1/Git-2.45.1-64-bit.exe';

/**
 * Searches standard Windows directories to locate git.exe if not yet in PATH.
 */
function getGitCommandPath() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return 'git';
  } catch (e) {
    // Git is not in the system environment PATH
  }

  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\User', 'AppData', 'Local');
  const candidates = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    path.join(localAppData, 'Programs', 'Git', 'cmd', 'git.exe')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const dir = path.dirname(candidate);
      if (!process.env.PATH.includes(dir)) {
        process.env.PATH += `;${dir}`;
      }
      return candidate;
    }
  }

  return null;
}

/**
 * Downloads the Git installer exe with progress reporting.
 */
function downloadGitInstaller(destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    function get(url) {
      https.get(url, (response) => {
        // Handle redirect
        if (response.statusCode === 301 || response.statusCode === 302) {
          get(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP Download failed: status ${response.statusCode}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (onProgress && totalBytes) {
            onProgress(downloadedBytes, totalBytes);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    get(GIT_DOWNLOAD_URL);
  });
}

/**
 * Runs the Git setup executable silently.
 */
function runGitSetup(installerPath) {
  return new Promise((resolve, reject) => {
    // Silent flags: /VERYSILENT (no GUI), /NORESTART (do not reboot), /SP- (suppress startup prompts)
    const proc = spawn(installerPath, ['/VERYSILENT', '/NORESTART', '/NOCANCEL', '/SP-'], {
      detached: true,
      stdio: 'ignore'
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Git installation failed. Installer exited with code ${code}.`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Configures global username and email.
 */
async function configureGit(username, email) {
  const gitCmd = getGitCommandPath() || 'git';
  try {
    execSync(`"${gitCmd}" config --global user.name "${username}"`);
    execSync(`"${gitCmd}" config --global user.email "${email}"`);
    return true;
  } catch (error) {
    console.error('Failed to configure git globals:', error);
    throw error;
  }
}

module.exports = {
  getGitCommandPath,
  downloadGitInstaller,
  runGitSetup,
  configureGit
};
