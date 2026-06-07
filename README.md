# Git Quick Push

Git Quick Push is a modern, premium Windows desktop application built with Electron and Node.js. It allows developers to instantly initialize, stage, commit, and push any local project folder to GitHub without using Git Bash or the Command Prompt.

Additionally, it integrates directly with the Windows File Explorer right-click context menu, allowing you to right-click any folder and select **Push to GitHub** to load it directly into the app.

---

## Features

1. **Local Directory Chooser**: Browse and select any folder.
2. **GitHub URL Auto-Save**: remebers the repository URL for each folder so you don't have to re-enter it.
3. **Automated Git Command Execution**:
   * Runs `git init` (if it is a new repository).
   * Dynamically configures `origin` URL (adds or updates remote origin).
   * Runs `git add .` (if changes are detected).
   * Runs `git commit -m "<custom message>"` (if there are changes).
   * Runs `git branch -M main` (ensures standard default branch).
   * Runs `git push -u origin main`.
4. **Real-time Logging Console**: Beautiful dark terminal scrolling log output displaying real-time command stdout/stderr.
5. **Explorer Context Menu Integration**: Toggle "Explorer Menu" in the app header to register/unregister the right-click option dynamically.
6. **Error Handling**: Detailed guides on authentication failures, missing Git installations, network offline states, and invalid repository URLs.

---

## Installation & Getting Started

### Prerequisites
1. **Windows OS**.
2. **Node.js** (v16 or higher recommended).
3. **Git** installed on your system and added to your environmental PATH.
   * If you don't have Git, download it from [git-scm.com](https://git-scm.com/).
4. **GitHub Authentication Setup**:
   Ensure Git on Windows is authorized to push to your GitHub account (either via the Git Credential Manager, an active SSH Agent, or GitHub CLI).

### Step 1: Install Dependencies
Open a terminal (Command Prompt, PowerShell, or Git Bash) inside the project folder and run:
```bash
npm install
```

### Step 2: Run in Development Mode
Launch the application locally to test:
```bash
npm start
```

### Step 3: Package as a Windows Portable Executable
To package the app directory:
```bash
npm run package
```
This will compile the application files into:
`dist/Git-Quick-Push-win32-x64/`

### Step 4: Build Setup Installer (.exe)
To create a single, clean Windows setup installer executable:
```bash
npm run installer
```
This compiles the packed assets into:
`dist/installer/GitQuickPushSetup.exe`

Double-clicking `GitQuickPushSetup.exe` will install the application on the system and put a shortcut icon on the Desktop.


---

## Windows Explorer Context Menu Integration

You can register the application to show up when you right-click any folder in Windows Explorer:

1. Open the application.
2. Toggle the **Explorer Menu** switch in the top-right header.
3. Once turned on, a registry key is added under `HKEY_CURRENT_USER\Software\Classes\Directory\shell\GitQuickPush` pointing to your current executable.
4. Right-click any folder in Windows Explorer, select **Push to GitHub**, and the application will launch with that folder automatically loaded!

> [!NOTE]
> Because it writes to the current user (`HKCU`) registry hive, **it does not require Administrator privileges** to register or unregister the menu.

---

## Project Architecture & Structure

```
├── dist/                          # Compiled production bundles
├── src/
│   ├── main/
│   │   ├── main.js                # Electron main process & IPC handlers
│   │   ├── preload.js             # Secure IPC context bridge
│   │   ├── git-service.js         # Git command exec & terminal streaming service
│   │   ├── menu-registry.js       # Windows Registry context menu management
│   │   └── store.js               # Lightweight JSON store for folder histories
│   └── renderer/
│       ├── index.html             # UI HTML5 structure
│       ├── style.css              # Premium dark stylesheet with glassmorphism
│       └── renderer.js            # Renderer process GUI event logic
├── package.json                   # Script configurations & project metadata
└── README.md                      # Documentation
```

### Clean Architecture Details
- **Decoupled Business Logic**: Git command execution is isolated inside `git-service.js` using Node's `child_process.spawn` for non-blocking stream pipes.
- **Security-First IPC**: Renderer process doesn't have raw access to `child_process`, `fs`, or the Windows Registry. All communications are bridged through a secure `preload.js` API using Electron's `contextBridge`.
- **Zero Heavy Native Dependencies**: The registry manager (`menu-registry.js`) spawns Windows `reg.exe` directly to avoid binary compilation issues with NPM registry packages across different Node environments.
