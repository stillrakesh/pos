import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;
let backendRestartAttempts = 0;
const MAX_BACKEND_RESTARTS = 3;

function logToFile(msg) {
  try {
    const dataDir = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const logPath = path.join(dataDir, 'electron_debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

function ensureFirewallRules() {
  if (process.platform !== 'win32') return;
  const cmd = `powershell -Command "New-NetFirewallRule -DisplayName 'Restaurant POS Ports (3100, 3101)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3100,3101 -Profile Any -Enabled True -ErrorAction SilentlyContinue"`;
  exec(cmd, (err) => {
    if (err) logToFile(`Firewall rule check: ${err.message}`);
    else logToFile(`Firewall rule verified on startup.`);
  });
}

/**
 * Starts the Backend Server using Electron's own runtime.
 * This is the most compatible way to run a standalone backend.
 */
function startBackend() {
  ensureFirewallRules();
  const isPackaged = app.isPackaged;
  
  // Resolve paths
  const serverPath = isPackaged 
    ? path.join(process.resourcesPath, 'app', 'server', 'index.js')
    : path.join(__dirname, '..', 'server', 'index.js');
    
  const dataPath = isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(__dirname, '..', 'data_dev');
    
  const projectDir = isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..');

  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }

  // Use the SAME binary that is currently running (Electron)
  // but tell it to act as a plain Node.js process.
  const nodeExe = process.execPath;

  logToFile(`Starting Backend (Unified Mode)...`);
  logToFile(`   ServerPath: ${serverPath}`);
  logToFile(`   Runtime:    ${nodeExe}`);
  logToFile(`   DataPath:   ${dataPath}`);

  backendProcess = spawn(nodeExe, [serverPath], {
    cwd: projectDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1', // <--- THIS IS THE MAGIC KEY
      PORT: isPackaged ? '3100' : '3101',
      DATA_DIR: dataPath,
      APP_PATH: app.getAppPath()
    },
  });

  backendProcess.stdout.on('data', (data) => {
    const msg = data.toString();
    process.stdout.write(`[Backend] ${msg}`);
    logToFile(`[Backend STDOUT] ${msg}`);
  });

  backendProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    process.stderr.write(`[Backend ERR] ${msg}`);
    logToFile(`[Backend STDERR] ${msg}`);
  });

  backendProcess.on('error', (err) => {
    logToFile(`[Backend ERROR EVENT] ${err.message}`);
    dialog.showErrorBox('Backend Error', `Failed to start backend server:\n${err.message}`);
  });

  backendProcess.on('exit', (code, signal) => {
    logToFile(`[Backend EXIT EVENT] Code: ${code}, Signal: ${signal}`);
    if (code !== 0 && code !== null) {
      if (backendRestartAttempts < MAX_BACKEND_RESTARTS) {
        backendRestartAttempts++;
        logToFile(`[Backend AUTO-RESTART] Attempt ${backendRestartAttempts}/${MAX_BACKEND_RESTARTS} in 2 seconds...`);
        setTimeout(() => {
          startBackend();
        }, 2000);
      } else {
        logToFile(`[Backend GIVING UP] All ${MAX_BACKEND_RESTARTS} restart attempts exhausted.`);
        dialog.showErrorBox('Backend Crashed', `Backend exited with code ${code} after ${MAX_BACKEND_RESTARTS} restart attempts.\nPlease restart the application.`);
      }
    }
  });
}

function waitForBackend(healthURL, callback, attempts = 0) {
  if (attempts > 60) {
    logToFile(`Backend wait TIMEOUT`);
    dialog.showErrorBox('Startup Timeout', 'The backend server is taking too long to start.\nPlease try restarting the app.');
    return;
  }

  http.get(healthURL, (res) => {
    if (res.statusCode === 200) {
      logToFile(`Backend is READY`);
      backendRestartAttempts = 0;
      callback();
    } else {
      setTimeout(() => waitForBackend(healthURL, callback, attempts + 1), 500);
    }
  }).on('error', () => {
    if (attempts % 10 === 0) logToFile(`Waiting for backend... (${attempts} attempts)`);
    setTimeout(() => waitForBackend(healthURL, callback, attempts + 1), 500);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs')
    },
    title: 'Tyde POS Desktop',
    autoHideMenuBar: true,
  });

  mainWindow.maximize();

  const port = app.isPackaged ? '3100' : '3101';
  const targetURL = `http://127.0.0.1:${port}`;
  const healthURL = `http://127.0.0.1:${port}/api/health`;

  waitForBackend(healthURL, () => {
    mainWindow.loadURL(targetURL)
      .then(() => {
        logToFile(`UI Loaded successfully`);
        mainWindow.show();
      })
      .catch((err) => {
        logToFile(`UI Load FAILED: ${err.message}`);
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
  const tmpHtml = path.join(app.getPath('temp'), `receipt_${Date.now()}.html`);
  const tmpBin  = path.join(app.getPath('temp'), `receipt_raster_${Date.now()}.bin`);
  const printWindow = new BrowserWindow({ show: false, width: 576, height: 5000, frame: false, webPreferences: { nodeIntegration: false, contextIsolation: true, zoomFactor: 2.021 } });
  try {
    fs.writeFileSync(tmpHtml, html, 'utf-8');
    await printWindow.loadFile(tmpHtml);
    await new Promise(r => setTimeout(r, 600));
    const height = await printWindow.webContents.executeJavaScript(`document.querySelector('.wrap')?.offsetHeight || document.documentElement.scrollHeight`);
    printWindow.setContentSize(576, Math.ceil(height * 2.021));
    await new Promise(r => setTimeout(r, 200));
    const image = await printWindow.webContents.capturePage();
    const finalImage = image.resize({ width: 576 });
    const bmp = finalImage.getBitmap();
    const w = 576;
    const h = Math.floor(bmp.length / 4 / w);
    const wBytes = Math.ceil(w / 8);
    const escpos = [];
    escpos.push(0x1B, 0x40, 0x1B, 0x61, 0x01, 0x1D, 0x76, 0x30, 0x00, wBytes & 0xFF, (wBytes >> 8) & 0xFF, h & 0xFF, (h >> 8) & 0xFF);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < wBytes; x++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const px = (x * 8) + bit;
          if (px < w) {
            const i = (y * w + px) * 4;
            if ((bmp[i+3] > 50) && ((bmp[i] + bmp[i+1] + bmp[i+2]) / 3 < 220)) byte |= (1 << (7 - bit));
          }
        }
        escpos.push(byte);
      }
    }
    escpos.push(0x0A, 0x1D, 0x56, 0x42, 0x00);
    fs.writeFileSync(tmpBin, Buffer.from(escpos));
    return await new Promise((resolve) => {
      const cmd = `lp -d "${printerName}" -o raw "${tmpBin}"`;
      exec(cmd, (err, stdout, stderr) => {
        if (!printWindow.isDestroyed()) printWindow.close();
        try { fs.unlinkSync(tmpHtml); fs.unlinkSync(tmpBin); } catch {}
        resolve(err ? { success: false, message: stderr || err.message } : { success: true });
      });
    });
  } catch (err) { if (!printWindow.isDestroyed()) printWindow.close(); return { success: false, message: err.message }; }
});

ipcMain.handle('print-raw-tcp', async (event, buffer, ip, port) => {
  return new Promise((resolve) => {
    const tcpPort = port || 9100;
    const client = new net.Socket();
    let resolved = false;
    const done = (success, msg) => { if (!resolved) { resolved = true; client.destroy(); resolve(success ? { success: true } : { success: false, message: msg }); } };
    client.setTimeout(5000);
    client.on('timeout', () => done(false, 'Connection timed out'));
    client.on('error', (err) => done(false, err.message));
    client.connect(tcpPort, ip, () => { client.write(Buffer.from(buffer), () => { setTimeout(() => done(true), 200); }); });
  });
});

ipcMain.handle('print-raw-usb', async (event, buffer, printerName) => {
  const tmpFile = path.join(app.getPath('temp'), `kot_${Date.now()}.bin`);
  try {
    fs.writeFileSync(tmpFile, Buffer.from(buffer));
    return await new Promise((resolve) => {
      const lp = spawn('lp', ['-d', printerName, '-o', 'raw', tmpFile]);
      let stderr = '';
      lp.stderr.on('data', d => { stderr += d.toString(); });
      lp.on('close', code => { try { fs.unlinkSync(tmpFile); } catch {} resolve(code === 0 ? { success: true } : { success: false, message: stderr }); });
      lp.on('error', err => { try { fs.unlinkSync(tmpFile); } catch {} resolve({ success: false, message: err.message }); });
    });
  } catch (err) { return { success: false, message: err.message }; }
});

ipcMain.handle('print-pdf-usb', async (event, html, printerName) => {
  const tmpHtml = path.join(app.getPath('temp'), `receipt_${Date.now()}.html`);
  const tmpPdf  = path.join(app.getPath('temp'), `receipt_${Date.now()}.pdf`);
  const printWindow = new BrowserWindow({ show: false, width: 302, height: 1800, webPreferences: { nodeIntegration: false, contextIsolation: true } });
  try {
    fs.writeFileSync(tmpHtml, html, 'utf-8');
    await printWindow.loadURL(`file://${tmpHtml}`);
    await new Promise(r => setTimeout(r, 800));
    const pdfData = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: { width: 80000, height: 297000 }, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    printWindow.close();
    fs.writeFileSync(tmpPdf, pdfData);
    return await new Promise((resolve) => {
      const lp = spawn('lp', ['-d', printerName, tmpPdf]);
      let stderr = '';
      lp.stderr.on('data', d => { stderr += d.toString(); });
      lp.on('close', code => { try { fs.unlinkSync(tmpPdf); fs.unlinkSync(tmpHtml); } catch {} resolve(code === 0 ? { success: true } : { success: false, message: stderr }); });
      lp.on('error', err => { try { fs.unlinkSync(tmpPdf); fs.unlinkSync(tmpHtml); } catch {} resolve({ success: false, message: err.message }); });
    });
  } catch (err) { if (!printWindow.isDestroyed()) printWindow.close(); return { success: false, message: err.message }; }
});

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('quit', () => { if (backendProcess && !backendProcess.killed) backendProcess.kill('SIGTERM'); });
