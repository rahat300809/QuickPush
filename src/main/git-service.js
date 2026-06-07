const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

/**
 * Spawns a process and logs stdout/stderr line-by-line.
 */
function spawnPromise(command, args, options, onLog) {
  return new Promise((resolve, reject) => {
    // Log the system command execution
    onLog('system', `> ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, { ...options, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });

    let stdoutBuffer = '';
    let stderrBuffer = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdoutBuffer += text;
      
      // Split and stream lines
      const lines = text.split('\n');
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          onLog('stdout', trimmed);
        }
      });
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderrBuffer += text;
      
      const lines = text.split('\n');
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          onLog('stderr', trimmed);
        }
      });
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdoutBuffer.trim());
      } else {
        const errMsg = stderrBuffer.trim() || stdoutBuffer.trim() || `Exit code ${code}`;
        reject(new Error(errMsg));
      }
    });
  });
}

/**
 * Check if Git is installed and visible in path.
 */
async function isGitInstalled() {
  return new Promise((resolve) => {
    const proc = spawn('git', ['--version']);
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Check internet connectivity to GitHub.
 */
async function isInternetAvailable() {
  try {
    await dns.lookup('github.com');
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Main function to execute the automated git push pipeline.
 */
async function runGitPush({ folderPath, repoUrl, commitMessage, force = false }, onLog) {
  // 1. Verify folder exists
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Local folder path does not exist: ${folderPath}`);
  }

  // 2. Check Git installation
  onLog('info', 'Checking if Git is installed on your system...');
  const gitInstalled = await isGitInstalled();
  if (!gitInstalled) {
    throw new Error(
      'Git is not installed or not available in the system PATH.\n' +
      'Please install Git (https://git-scm.com/) and make sure it is added to your environment variables.'
    );
  }

  const options = { cwd: folderPath };

  // 3. Check if .git folder exists
  const dotGitPath = path.join(folderPath, '.git');
  const isExistingRepo = fs.existsSync(dotGitPath);

  if (!isExistingRepo) {
    onLog('info', 'No Git repository detected in the directory. Initializing repository (git init)...');
    await spawnPromise('git', ['init'], options, onLog);
  } else {
    onLog('info', 'Existing Git repository detected in the directory. Skipping initialization.');
  }

  // 4. Handle Remote Origin
  let originExists = false;
  let existingUrl = '';
  try {
    const remotes = await spawnPromise('git', ['remote'], options, () => {}); // silent
    const remoteList = remotes.split(/\s+/).map((r) => r.trim()).filter(Boolean);
    if (remoteList.includes('origin')) {
      originExists = true;
      existingUrl = await spawnPromise('git', ['remote', 'get-url', 'origin'], options, () => {}); // silent
    }
  } catch (err) {
    // If commands fail or origin doesn't exist, we just treat originExists as false
    originExists = false;
  }

  if (!originExists) {
    onLog('info', `Configuring remote origin pointing to: ${repoUrl}`);
    await spawnPromise('git', ['remote', 'add', 'origin', repoUrl], options, onLog);
  } else if (existingUrl.trim() !== repoUrl.trim()) {
    onLog('info', `Updating existing remote origin URL from "${existingUrl.trim()}" to "${repoUrl.trim()}"`);
    await spawnPromise('git', ['remote', 'set-url', 'origin', repoUrl], options, onLog);
  } else {
    onLog('info', 'Remote origin already matches the target repository.');
  }

  // 5. Check if there are changes to stage/commit
  onLog('info', 'Scanning repository for uncommitted changes...');
  let changesExist = false;
  try {
    const status = await spawnPromise('git', ['status', '--porcelain'], options, () => {}); // silent
    if (status.trim().length > 0) {
      changesExist = true;
    }
  } catch (err) {
    // If status fails, might be unborn branch or weird state, we default to running add/commit
    changesExist = true;
  }

  if (changesExist) {
    onLog('info', 'Staging changes (git add .)...');
    await spawnPromise('git', ['add', '.'], options, onLog);

    onLog('info', `Committing changes (git commit -m "${commitMessage}")...`);
    try {
      await spawnPromise('git', ['commit', '-m', commitMessage], options, onLog);
    } catch (err) {
      if (err.message.includes('nothing to commit') || err.message.includes('working tree clean')) {
        onLog('info', 'Nothing to commit, working tree is clean.');
      } else {
        throw err;
      }
    }
  } else {
    onLog('info', 'No uncommitted changes detected. Skipping stage and commit steps.');
  }

  // 6. Branch setup
  onLog('info', 'Setting default branch name to main (git branch -M main)...');
  await spawnPromise('git', ['branch', '-M', 'main'], options, onLog);

  // 7. Verify Internet Connection
  onLog('info', 'Checking internet connectivity to github.com...');
  const internetOk = await isInternetAvailable();
  if (!internetOk) {
    throw new Error('Internet is unavailable or github.com is unreachable. Please verify your connection.');
  }

  // 8. Push changes
  if (force) {
    onLog('system', 'Force push enabled! Pushing commits to remote (git push -f -u origin main)...');
  } else {
    onLog('info', 'Pushing commits to remote (git push -u origin main)...');
  }

  try {
    const pushArgs = ['push', '-u', 'origin', 'main'];
    if (force) {
      pushArgs.splice(1, 0, '-f');
    }
    await spawnPromise('git', pushArgs, options, onLog);
    onLog('success', 'Successfully pushed repository to GitHub!');
  } catch (err) {
    const errMsg = err.message;
    if (
      errMsg.includes('rejected') ||
      errMsg.includes('non-fast-forward') ||
      errMsg.includes('fetch first') ||
      errMsg.includes('Updates were rejected')
    ) {
      throw new Error('GIT_PUSH_CONFLICT: Remote contains changes that do not exist locally.');
    }

    if (
      errMsg.includes('Authentication failed') ||
      errMsg.includes('could not read Username') ||
      errMsg.includes('Permission denied') ||
      errMsg.includes('terminal prompts disabled')
    ) {
      throw new Error(
        'GitHub Authentication Failed.\n' +
        'Please verify that your git credentials are configured on Windows:\n' +
        '  - If using HTTPS: Ensure a Git Credential Manager or PAT (Personal Access Token) is set up.\n' +
        '  - If using SSH: Ensure your SSH key is added to your GitHub account and your local ssh-agent is running.\n' +
        '  - Try running a git push manually once in Git Bash to authorize.'
      );
    } else if (errMsg.includes('Repository not found') || errMsg.includes('does not exist')) {
      throw new Error(
        `Repository not found at: ${repoUrl}\n` +
        'Please verify the URL is correct and you have permission to push to it.'
      );
    } else {
      throw err;
    }
  }
}

module.exports = {
  runGitPush
};
