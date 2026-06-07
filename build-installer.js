const electronInstaller = require('electron-winstaller');
const path = require('path');

async function build() {
  console.log('Building Squirrel installer (this may take a moment)...');
  try {
    await electronInstaller.createWindowsInstaller({
      appDirectory: path.join(__dirname, 'dist/Git-Quick-Push-win32-x64'),
      outputDirectory: path.join(__dirname, 'dist/installer'),
      authors: 'Antigravity',
      exe: 'Git-Quick-Push.exe',
      setupExe: 'GitQuickPushSetup.exe',
      noMsi: true,
      description: 'Windows desktop app to quickly push local directories to GitHub repositories'
    });
    console.log('Installer built successfully! You can find the installer in: dist/installer/GitQuickPushSetup.exe');
  } catch (e) {
    console.error('Installer build failed:', e.message);
    process.exit(1);
  }
}

build();
