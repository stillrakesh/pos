import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;

/**
 * Starts the Backend Server as a REAL standalone node.exe process.
 * Using spawn() instead of fork() ensures the backend runs as a genuine
 * node.exe process — not inside Electron's process space — so Windows
 * Firewall treats it correctly and it's accessible from LAN devices.
 */
function startBackend() {
  const isPackaged = app.isPackaged;
  
  // 1. Resolve Server Script Path
  const serverPath = isPackaged 
    ? path.join(process.resourcesPath, 'app', 'server', 'index.js')
    : path.join(__dirname, '..', 'server', 'index.js');
    
  // 2. Resolve Data Path (crucial for protecting data across updates)
  const dataPath = isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(__dirname, '..', 'data');
    
  // 3. Resolve Project Dir
  const projectDir = isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..');

  // Make sure the data directory exists
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }

  // 4. Resolve Node Executable
  // Use system node during dev, but use bundled-node.exe in production.
  const nodeExe = isPackaged
    ? (process.platform === 'darwin' 
        ? path.join(process.resourcesPath, 'bundled-node')
        : path.join(process.resourcesPath, 'bundled-node.exe'))
    : (process.env.npm_node_execpath || 'node');

  console.log('🚀 [Electron] Starting Backend Server as node.exe...');
  console.log(`   Packaged: ${isPackaged}`);
  console.log(`   Server: ${serverPath}`);
  console.log(`   Node:   ${nodeExe}`);
  console.log(`   Data:   ${dataPath}`);

  backendProcess = spawn(nodeExe, [serverPath], {
    cwd: projectDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: '3001',
      DATA_DIR: dataPath,
    },
  });

  backendProcess.stdout.on('data', (data) => {
    process.stdout.write(`[Backend] ${data.toString()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    process.stderr.write(`[Backend ERR] ${data.toString()}`);
  });

  backendProcess.on('error', (err) => {
    console.error('❌ [Electron] Backend failed to start:', err.message);
    dialog.showErrorBox('Backend Error', `Failed to start backend server:\n${err.message}`);
  });

  backendProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ [Electron] Backend exited with code ${code}`);
      dialog.showErrorBox('Backend Crashed', `Backend exited with code ${code}.\nPlease restart the application.`);
    }
  });

  console.log(`✅ [Electron] Backend spawned as node.exe (PID: ${backendProcess.pid})`);
}

/**
 * Polls /api/health until the backend is ready, then calls callback.
 */
function waitForBackend(healthURL, callback, attempts = 0) {
  http.get(healthURL, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ [Electron] Backend is READY — loading UI...');
      callback();
    } else {
      setTimeout(() => waitForBackend(healthURL, callback, attempts + 1), 500);
    }
  }).on('error', () => {
    if (attempts % 10 === 0) {
      console.log(`⏳ [Electron] Waiting for backend... (${attempts} attempts)`);
    }
    setTimeout(() => waitForBackend(healthURL, callback, attempts + 1), 500);
  });
}

/**
 * Creates the main Electron window.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs')
    },
    title: 'Tyde POS Desktop',
    autoHideMenuBar: true,
  });

  mainWindow.maximize();

  const targetURL = 'http://127.0.0.1:3001';
  const healthURL = 'http://127.0.0.1:3001/api/health';

  console.log('⏳ [Electron] Waiting for backend at', targetURL);

  waitForBackend(healthURL, () => {
    mainWindow.loadURL(targetURL)
      .then(() => {
        console.log('✅ [Electron] POS UI Loaded.');
        mainWindow.show();
      })
      .catch((err) => {
        console.error('❌ [Electron] Failed to load UI:', err.message);
        dialog.showErrorBox('UI Load Error', `Failed to load POS UI:\n${err.message}`);
      });
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- IPC Handlers for Printing ---
ipcMain.handle('get-printers', async (event) => {
  return await event.sender.getPrintersAsync();
});

ipcMain.handle('print-html', async (event, html, printerName) => {
  return new Promise((resolve) => {
    const PAPER_PX = 280;

    const printWindow = new BrowserWindow({
      show: false,
      width:  PAPER_PX,
      height: 1200,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Use loadURL + executeJavaScript instead of a data URI to avoid
    // URL length limits on long receipts.
    printWindow.loadURL('about:blank');

    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents
        .executeJavaScript(`
          document.open();
          document.write(${JSON.stringify(html)});
          document.close();
        `)
        .then(() => {
          // Allow 600ms for the page to fully render after document.write
          setTimeout(() => {
            printWindow.webContents.print({
              silent: true,
              deviceName: printerName || undefined,
              printBackground: true,
              margins: { marginType: 'none' },
              pageSize: {
                width: 80000,
                height: 297000
              }
            }, (success, failureReason) => {
              printWindow.close();
              if (success) {
                resolve({ success: true });
              } else {
                resolve({ success: false, message: failureReason });
              }
            });
          }, 600);
        })
        .catch((err) => {
          printWindow.close();
          resolve({ success: false, message: err.message });
        });
    });
  });
});

// ─── App lifecycle ────────────────────────────────────────────
app.whenReady().then(() => {
  startBackend();
  createWindow();
  setupAutoUpdater();
});

import pkg from 'electron-updater';
const { autoUpdater } = pkg;

function setupAutoUpdater() {
  if (!app.isPackaged) return; // Only check for updates in production

  autoUpdater.autoDownload = false; // Prompt before downloading
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) of Restaurant POS is available. Would you like to update now?`,
      buttons: ['Update Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'The update has been downloaded. The application will restart to install it.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ [AutoUpdater] Error:', err.message);
  });

  // Check on startup
  autoUpdater.checkForUpdatesAndNotify();
  
  // Check periodically (every 12 hours)
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 12 * 60 * 60 * 1000);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (backendProcess && !backendProcess.killed) {
    console.log('🛑 [Electron] Killing backend process...');
    backendProcess.kill('SIGTERM');
  }
});
