import qz from 'qz-tray';
import { get, set } from 'idb-keyval';
import { BASE_URL } from '../constants';

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
    const API_BASE = BASE_URL;

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
    
    // Reduce retries and timeout to avoid long hangs when service is not running
    qz.websocket.setConnectRetries(0);
    
    // Wrap connection in a race to ensure it fails fast (2 seconds max)
    await Promise.race([
      qz.websocket.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('QZ Connection Timeout')), 1500))
    ]);
    
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
  const esc = '\u001B';
  const gs = '\u001D';
  const center = esc + 'a' + '\u0001';
  const left = esc + 'a' + '\u0000';
  const boldOn = esc + 'E' + '\u0001';
  const boldOff = esc + 'E' + '\u0000';
  const sizeNormal = gs + '!' + '\u0000';
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Header per requested format: Table -> Category -> Items -> Time
  let data = [
    center, 
    sizeNormal, boldOn, 'Table: ' + (order.tableName || '--') + '\n',
    order.categoryHeader ? `Category: ${order.categoryHeader}\n` : '',
    boldOff, '................................\n', // Dotted line
    left,
  ];
  
  if (order.categoryHeader) {
    data.push('\n'); // Space after category header
  }

  for (const item of order.items) {
    const itemName = item.name.substring(0, 20).padEnd(20);
    const itemQty = ' x' + (item.qty || 1);
    data.push(boldOn, itemName, itemQty, boldOff, '\n');
    if (item.note) {
      data.push('  Note: ' + item.note + '\n');
    }
  }

  data.push(
    '\n',
    center,
    'Time: ' + dateStr + ' ' + timeStr + '\n',
    esc + 'm' // Cut
  );

  return data;
}

function generateBillCommands(order, settings) {
  const esc = '\u001B';
  const gs = '\u001D';
  const center = esc + 'a' + '\u0001';
  const left = esc + 'a' + '\u0000';
  const right = esc + 'a' + '\u0002';
  const boldOn = esc + 'E' + '\u0001';
  const boldOff = esc + 'E' + '\u0000';
  const sizeNormal = gs + '!' + '\u0000';
  const sizeLarge = gs + '!' + '\u0011'; // Double width + Double height
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Standard character width for thermal printers is 32-42. We'll use 32 as safe base.
  let data = [
    center,
    boldOn, (settings.resName || 'Tyde Cafe').toUpperCase() + '\n',
    boldOff, (settings.headerText || 'Nerul Ferry Terminal') + '\n',
    '--------------------------------\n',
    left,
    'Name: \n',
    '--------------------------------\n',
    // ROW 1: Date | Dine In (Bold)
    'Date: ' + dateStr, (order.tableName || '').padStart(32 - 13 - 10), boldOn, 'Dine In: ' + (order.tableName || '--'), boldOff, '\n',
    // ROW 2: Time | Bill No.
    timeStr, ('Bill No.: ' + (order.billNumber || '---')).padStart(32 - timeStr.length), '\n',
    // ROW 3: Cashier
    'Cashier: ' + (order.cashier || 'biller'), '\n',
    '--------------------------------\n',
    boldOn, 'Item          Qty Price Amount\n', boldOff,
    '--------------------------------\n',
  ];

  order.items.forEach(item => {
    const amt = (item.qty * item.price).toFixed(0);
    // Layout: 15 chars name, 3 chars qty, 6 chars price, 8 chars amt
    const namePart = (item.name.substring(0, 14)).padEnd(15);
    const qtyPart = (item.qty.toString()).padStart(3);
    const pricePart = (item.price.toFixed(0)).padStart(6);
    const amtPart = (amt).padStart(8);
    data.push(namePart, qtyPart, pricePart, amtPart, '\n');
  });

  const subtotal = (order.subtotal || 0).toFixed(2);
  const service = (order.serviceCharge || 0).toFixed(2);
  const roundOffNum = parseFloat(order.roundOff || 0);
  const roundStr = (roundOffNum >= 0 ? '+' : '') + roundOffNum.toFixed(2);
  const grandTotal = (order.grandTotal || 0).toFixed(2);
  const totalQtyItem = order.items.reduce((s, i) => s + i.qty, 0);

  data.push(
    '--------------------------------\n',
    // SUB TOTAL STACK
    '              Sub       ' + subtotal.padStart(8) + '\n',
    'Total Qty: ' + totalQtyItem.toString().padEnd(3), '  Total\n',
    
    // SERVICE CHARGE STACK
    'Service Charge          ' + service.padStart(8) + '\n',
    '(Optional)\n',
    
    '--------------------------------\n',
    '             Round off  ' + roundStr.padStart(8) + '\n',
    center, boldOn, sizeLarge, 'Grand Total  ' + (settings.currencySymbol || 'Rs.') + ' ' + grandTotal, boldOff, sizeNormal, left, '\n',
    '--------------------------------\n',
    center,
    (settings.footerText || 'Sea you soon - under the moon') + '\n',
    '\n\n\n\n\n',
    esc + 'm' // Cut
  );

  return data;
}
