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
const MAX_BACKEND_RESTARTS = 10;

function logToFile(msg) {
  try {
    const dataDir = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const logPath = path.join(dataDir, 'electron_debug.log');
    
    // Log rotation: truncate if over 5MB (keep last 1MB)
    try {
      const stats = fs.statSync(logPath);
      if (stats.size > 5 * 1024 * 1024) {
        const content = fs.readFileSync(logPath, 'utf-8');
        const truncated = content.slice(-1024 * 1024); // Keep last 1MB
        fs.writeFileSync(logPath, `[LOG ROTATED at ${new Date().toISOString()}]\n${truncated}`);
      }
    } catch (rotateErr) { /* file might not exist yet */ }
    
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

function requestElevatedFirewallSetup() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: true, message: 'Firewall elevation only required on Windows' });
      return;
    }

    const scriptPath = path.join(app.getAppPath(), 'apply-firewall-rules.ps1');
    const cmd = `powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \\"${scriptPath}\\"' -Verb RunAs -Wait"`;

    exec(cmd, { windowsHide: true }, (err) => {
      if (err) {
        logToFile(`Elevated Firewall Setup Error: ${err.message}`);
        const ruleName = 'Restaurant POS Network Access';
        const ports = '3000,3100,3101,5173,5175';
        const fallbackCmd = `powershell -Command "Start-Process netsh -ArgumentList 'advfirewall firewall add rule name=\\"${ruleName}\\" dir=in action=allow protocol=TCP localport=${ports} profile=any enable=yes' -Verb RunAs -Wait"`;
        exec(fallbackCmd, { windowsHide: true }, () => resolve({ success: true }));
      } else {
        logToFile(`Elevated Firewall Setup SUCCEEDED`);
        resolve({ success: true, message: 'Firewall rules created successfully!' });
      }
    });
  });
}

function ensureFirewallRules() {
  const port = process.env.PORT || '3101';
  const ports = ['3100', port, '5175'];

  if (process.platform === 'win32') {
    // ── Windows: Create inbound TCP allow rules for ALL network profiles ──
    // This covers Private, Public, and Domain networks so switching Wi-Fi
    // routers never blocks incoming connections from phones/tablets.
    const ruleName = 'Restaurant POS Network Access';
    const portList = ports.join(',');

    // Step 1: Delete any stale rules with the same name (idempotent)
    const deleteCmd = `netsh advfirewall firewall delete rule name="${ruleName}" 2>nul`;
    // Step 2: Create a single rule covering all POS ports on ALL profiles
    const addCmd = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=TCP localport=${portList} profile=any enable=yes`;
    // Step 3: Also whitelist the exact Electron executable (covers edge cases
    // where per-app blocking overrides port rules)
    const exePath = process.execPath.replace(/\\/g, '\\\\');
    const exeRuleName = 'Restaurant POS App';
    const deleteExeCmd = `netsh advfirewall firewall delete rule name="${exeRuleName}" 2>nul`;
    const addExeCmd = `netsh advfirewall firewall add rule name="${exeRuleName}" dir=in action=allow program="${exePath}" profile=any enable=yes`;

    const fullCmd = `${deleteCmd} & ${addCmd} & ${deleteExeCmd} & ${addExeCmd}`;
    exec(fullCmd, { shell: true, windowsHide: true }, (err) => {
      if (err) {
        logToFile(`Firewall config (non-admin, expected): ${err.message}`);
        // Fallback: try PowerShell with less privileges
        const psCmd = `powershell -WindowStyle Hidden -Command "try { New-NetFirewallRule -DisplayName '${ruleName}' -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${portList} -Profile Any -Enabled True -ErrorAction SilentlyContinue } catch {}"`;
        exec(psCmd, { windowsHide: true }, (psErr) => {
          if (psErr) logToFile(`Firewall PS fallback: ${psErr.message}`);
          else logToFile('Firewall rules applied via PowerShell fallback.');
        });
      } else {
        logToFile(`Firewall rules verified: ports ${portList} allowed on all profiles.`);
      }
    });
  } else if (process.platform === 'darwin') {
    // ── macOS: Allow the app through Application Firewall ──
    // macOS uses socketfilterfw for per-app rules (not port-based).
    // If the macOS firewall is active, we need to whitelist our binary.
    const appPath = process.execPath;
    const cmds = [
      `/usr/libexec/ApplicationFirewall/socketfilterfw --add "${appPath}" 2>/dev/null`,
      `/usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "${appPath}" 2>/dev/null`
    ];
    exec(cmds.join(' && '), { shell: '/bin/bash' }, (err) => {
      if (err) logToFile(`macOS firewall config: ${err.message}`);
      else logToFile('macOS firewall: app whitelisted.');
    });
  }
  // Linux: iptables typically not an issue for desktop LAN apps; no action needed.
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
      ELECTRON_RUN_AS_NODE: '1',
      PORT: process.env.PORT || '3101',
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

  const port = process.env.PORT || '3101';
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

  // ── Crash Recovery: Auto-reload if renderer process crashes ──
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logToFile(`[RENDERER CRASH] Reason: ${details.reason}, exitCode: ${details.exitCode}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'POS Display Crashed',
        message: 'The POS display encountered an error and will now reload.',
        detail: `Reason: ${details.reason}`,
        buttons: ['Reload Now']
      }).then(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
      });
    }
  });

  mainWindow.on('unresponsive', () => {
    logToFile('[RENDERER UNRESPONSIVE] Window became unresponsive');
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'POS Not Responding',
        message: 'The POS interface is not responding.',
        detail: 'This may be caused by a heavy operation. You can wait or reload.',
        buttons: ['Wait', 'Reload POS'],
        defaultId: 0,
        cancelId: 0
      }).then((result) => {
        if (result.response === 1 && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      });
    }
  });

  mainWindow.on('responsive', () => {
    logToFile('[RENDERER RESPONSIVE] Window recovered from unresponsive state');
  });
}

// --- IPC Handlers for Printing ---
ipcMain.handle('request-firewall-setup', async () => {
  return await requestElevatedFirewallSetup();
});

ipcMain.handle('get-printers', async (event) => {
  return await event.sender.getPrintersAsync();
});

// ─── Cross-Platform Silent Print (webContents.print) ──────────────────────────
// This is the PRIMARY silent print method. Works on Windows AND macOS.
// Uses Electron's native print API — no lp, no PowerShell needed.
ipcMain.handle('print-silent', async (event, html, printerName) => {
  const tmpHtml = path.join(app.getPath('temp'), `receipt_silent_${Date.now()}.html`);
  const printWindow = new BrowserWindow({
    show: false, width: 275, height: 5000, frame: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  try {
    fs.writeFileSync(tmpHtml, html, 'utf-8');
    await printWindow.loadFile(tmpHtml);
    await new Promise(r => setTimeout(r, 500)); // Wait for render

    return await new Promise((resolve) => {
      printWindow.webContents.print({
        silent: true,
        deviceName: printerName || undefined,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: { width: 72000, height: 297000 } // 72mm printable area (80mm minus driver margins)
      }, (success, failureReason) => {
        if (!printWindow.isDestroyed()) printWindow.close();
        try { fs.unlinkSync(tmpHtml); } catch {}
        if (success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, message: failureReason || 'Print failed' });
        }
      });
    });
  } catch (err) {
    if (!printWindow.isDestroyed()) printWindow.close();
    try { fs.unlinkSync(tmpHtml); } catch {}
    return { success: false, message: err.message };
  }
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
      if (process.platform === 'win32') {
        // Windows: Use PowerShell to send raw bytes to the printer
        const psScript = `
          $PrinterName = '${printerName.replace(/'/g, "''")}'
          $FilePath = '${tmpFile.replace(/\\/g, '\\\\').replace(/'/g, "''")}'
          try {
            $bytes = [System.IO.File]::ReadAllBytes($FilePath)
            $prn = Get-Printer -Name $PrinterName -ErrorAction Stop
            $port = (Get-PrinterPort -Name $prn.PortName -ErrorAction Stop).Name
            $fs = [System.IO.File]::OpenWrite("\\\\.$port")
            $fs.Write($bytes, 0, $bytes.Length)
            $fs.Close()
            Write-Output 'OK'
          } catch {
            Write-Error $_.Exception.Message
          }
        `;
        const ps = spawn('powershell', ['-NoProfile', '-Command', psScript], { windowsHide: true });
        let stdout = '', stderr = '';
        ps.stdout.on('data', d => { stdout += d.toString(); });
        ps.stderr.on('data', d => { stderr += d.toString(); });
        ps.on('close', code => {
          try { fs.unlinkSync(tmpFile); } catch {}
          resolve(stdout.includes('OK') ? { success: true } : { success: false, message: stderr || 'PowerShell print failed' });
        });
        ps.on('error', err => {
          try { fs.unlinkSync(tmpFile); } catch {}
          resolve({ success: false, message: err.message });
        });
      } else {
        // macOS/Linux: Use lp command
        const lp = spawn('lp', ['-d', printerName, '-o', 'raw', tmpFile]);
        let stderr = '';
        lp.stderr.on('data', d => { stderr += d.toString(); });
        lp.on('close', code => { try { fs.unlinkSync(tmpFile); } catch {} resolve(code === 0 ? { success: true } : { success: false, message: stderr }); });
        lp.on('error', err => { try { fs.unlinkSync(tmpFile); } catch {} resolve({ success: false, message: err.message }); });
      }
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

// ── Global Crash Protection for Main Process ──
process.on('uncaughtException', (err) => {
  logToFile(`[MAIN PROCESS CRASH PREVENTED] ${err.stack || err}`);
});

process.on('unhandledRejection', (reason) => {
  logToFile(`[MAIN PROCESS UNHANDLED REJECTION] ${reason?.stack || reason}`);
});

function killProcessOnPort(port) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const cmd = `powershell -NoProfile -NonInteractive -Command "try { Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } catch {}"`;
      exec(cmd, { windowsHide: true }, () => resolve());
    } else {
      exec(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`, { shell: '/bin/bash' }, () => resolve());
    }
  });
}

app.whenReady().then(async () => {
  const port = process.env.PORT || '3101';
  logToFile(`Ensuring port ${port} is clear before backend spawn...`);
  await killProcessOnPort(port);
  startBackend();
  createWindow();
});

let isQuitting = false;

app.on('before-quit', (e) => {
  if (isQuitting) return;
  isQuitting = true;
  e.preventDefault();

  logToFile('[App Shutdown] Graceful shutdown initiated. Triggering backend database save...');

  const port = process.env.PORT || '3101';
  const shutdownUrl = `http://127.0.0.1:${port}/api/system/shutdown`;

  try {
    const req = http.request(shutdownUrl, { method: 'POST', timeout: 800 }, () => {});
    req.on('error', () => {});
    req.end();
  } catch (err) {}

  setTimeout(() => {
    if (backendProcess && !backendProcess.killed) {
      try {
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${backendProcess.pid} /T /F`, { windowsHide: true }, () => {});
        } else {
          backendProcess.kill('SIGTERM');
        }
      } catch (err) {}
    }
    app.exit(0);
  }, 500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
