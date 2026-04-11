import qz from 'qz-tray';
import { get, set } from 'idb-keyval';

/**
 * qzTrayPrinter.js
 * 
 * Logic for connecting to and printing via QZ Tray.
 * Uses ESC/POS raw commands for high performance thermal printing.
 */

const QZ_SETTINGS_KEY = 'qz_printer_prefs';

let _connected = false;
let _selectedPrinter = null;
let _printerConfig = null;

/**
 * Connects to the QZ Tray local service.
 * Handles certificate and signature configuration.
 */
export async function connectQzTray() {
  if (_connected && qz.websocket.isActive()) return true;

  try {
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001' 
      : window.location.origin;

    // ─── Certificate and Signing via backend ──────────────────
    // Points to the server-side signing API which uses your private key.
    qz.security.setCertificatePromise((resolve, reject) => {
      fetch(`${API_BASE}/api/signing/certificate`, { cache: 'no-store' })
        .then(res => res.ok ? res.text() : '')
        .then(cert => resolve(cert))
        .catch(() => resolve(''));
    });

    qz.security.setSignatureAlgorithm('SHA512');

    qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
      fetch(`${API_BASE}/api/signing/sign?request=${encodeURIComponent(toSign)}`, { cache: 'no-store' })
        .then(res => res.ok ? res.text() : '')
        .then(sig => resolve(sig))
        .catch(() => resolve(''));
    });

    console.log('[QZ Tray] 🌐 Connecting via WebSocket...');
    await qz.websocket.connect();
    console.log('[QZ Tray] ✅ WebSocket Connected!');
    _connected = true;

    // Load saved printer preference
    const saved = await get(QZ_SETTINGS_KEY);
    if (saved?.printerName) {
      console.log('[QZ Tray] 💾 Restoring saved printer:', saved.printerName);
      _selectedPrinter = saved.printerName;
      _printerConfig = qz.configs.create(saved.printerName, { forceRaw: true });
    }

    return true;
  } catch (err) {
    _connected = false;
    console.error('[QZ Tray] ❌ Connection failed error:', err);
    return false;
  }
}

/**
 * Disconnects from QZ Tray.
 */
export async function disconnectQzTray() {
  try {
    if (qz.websocket.isActive()) {
      await qz.websocket.disconnect();
    }
  } catch (err) {
    console.error('[QZ Tray] Error during disconnect:', err);
  } finally {
    _connected = false;
  }
}

/**
 * Returns the current connection status.
 */
export function isQzConnected() {
  return _connected && qz.websocket.isActive();
}

/**
 * Lists all available printers detected by QZ Tray.
 */
export async function findPrinters() {
  if (!isQzConnected()) {
    const ok = await connectQzTray();
    if (!ok) return [];
  }

  try {
    return await qz.printers.find();
  } catch (err) {
    console.error('[QZ Tray] Error finding printers:', err);
    return [];
  }
}

/**
 * Sets the active printer and saves the choice to local storage.
 */
export async function selectPrinter(printerName) {
  _selectedPrinter = printerName;
  _printerConfig = qz.configs.create(printerName, { forceRaw: true });
  
  await set(QZ_SETTINGS_KEY, { printerName });
  console.log('[QZ Tray] Printer selected:', printerName);
}

/**
 * Returns the name of the currently selected printer.
 */
export function getSelectedPrinter() {
  return _selectedPrinter;
}

/**
 * Core printing function. Formats order data into ESC/POS commands
 * and sends them to the configured printer.
 */
export async function printViaQzTray(orderData, type = 'BILL', settings = {}) {
  if (!isQzConnected()) {
    const ok = await connectQzTray();
    if (!ok) return { success: false, message: 'QZ Tray is not running or connected.' };
  }

  if (!_selectedPrinter) {
    return { success: false, message: 'No printer selected. Please go to Settings > Printer Setup.' };
  }

  try {
    const commands = type === 'KOT' 
      ? generateKotCommands(orderData, settings)
      : generateBillCommands(orderData, settings);

    await qz.print(_printerConfig, commands);
    return { success: true };
  } catch (err) {
    console.error('[QZ Tray] Print error:', err);
    return { success: false, message: err.message || 'Printing failed' };
  }
}

/**
 * Sends a basic test print to verify connection.
 */
export async function testPrint(settings) {
  const dummyOrder = {
    tableName: 'Test Table',
    orderType: 'Dine In',
    items: [
      { name: 'Paper Test Item', qty: 1, price: 0 },
      { name: 'Connection Active', qty: 2, price: 0 }
    ],
    grandTotal: 0
  };

  return await printViaQzTray(dummyOrder, 'KOT', settings);
}

// ─── Command Generators (ESC/POS) ────────────────────────────────

function generateKotCommands(order, settings) {
  const esc = '\u001B'; // ESC
  const gs = '\u001D';  // GS
  const center = esc + 'a' + '\u0001';
  const left = esc + 'a' + '\u0000';
  const boldOn = esc + 'E' + '\u0001';
  const boldOff = esc + 'E' + '\u0000';
  const sizeNormal = gs + '!' + '\u0000';
  const sizeLarge = gs + '!' + '\u0011'; // Double height, double width
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  let data = [
    center, 
    sizeNormal, dateStr + ' ' + timeStr + '\n',
    sizeLarge, boldOn, 'K O T\n',
    sizeNormal, '--------------------------------\n',
    left,
    boldOn, 'Table: ' + (order.tableName || 'N/A') + '\n',
    'Type: ' + (order.orderType || 'Dine In') + '\n',
    boldOff, '--------------------------------\n',
    boldOn,
  ];

  for (const item of order.items) {
    data.push(left + item.name.padEnd(26) + ' ' + item.qty + '\n');
    if (item.note) {
      data.push('  * ' + item.note + '\n');
    }
  }

  data.push(
    boldOff, '--------------------------------\n',
    '\n\n\n\n\n',
    esc + 'm' // Cut paper
  );

  return data;
}

function generateBillCommands(order, settings) {
  const esc = '\u001B';
  const gs = '\u001D';
  const center = esc + 'a' + '\u0001';
  const left = esc + 'a' + '\u0000';
  const boldOn = esc + 'E' + '\u0001';
  const boldOff = esc + 'E' + '\u0000';
  const sizeNormal = gs + '!' + '\u0000';
  const sizeLarge = gs + '!' + '\u0011';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  let data = [
    center,
    sizeLarge, boldOn, (settings.billHeader || 'Tyde Cafe') + '\n',
    sizeNormal, boldOff, (settings.address || 'Nerul Ferry Terminal') + '\n',
    '--------------------------------\n',
    left,
    'Bill No: ' + (order.billNumber || '---') + ' | ' + dateStr + '\n',
    'Table: ' + (order.tableName || 'N/A') + ' | Time: ' + timeStr + '\n',
    '--------------------------------\n',
    boldOn, 
    'Item                      Qty   Amt\n',
    boldOff, 
    '--------------------------------\n',
  ];

  order.items.forEach(item => {
    const amt = (item.qty * item.price).toFixed(2);
    const line = item.name.substring(0, 20).padEnd(21) + 
                 item.qty.toString().padStart(3) + '   ' + 
                 amt.padStart(8) + '\n';
    data.push(line);
  });

  data.push(
    '--------------------------------\n',
    esc + 'a' + '\u0002', // Align right
    boldOn, 'GRAND TOTAL: Rs. ' + (order.grandTotal || 0).toFixed(2) + '\n',
    boldOff,
    '--------------------------------\n',
    center,
    '\n' + (settings.billFooter || 'Thank You! Visit Again!') + '\n',
    '\n\n\n\n\n',
    esc + 'm' // Cut
  );

  return data;
}
