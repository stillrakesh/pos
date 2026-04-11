import qz from 'qz-tray';
import { get, set } from 'idb-keyval';

// ─── QZ Tray State ──────────────────────────────────────────
let _connected = false;
let _selectedPrinter = null;
let _printerConfig = null;

// ─── Settings persistence key ───────────────────────────────
const QZ_SETTINGS_KEY = 'pos_qz_printer_config';

// ─── Connection ─────────────────────────────────────────────

/**
 * Connect to the QZ Tray desktop application via WebSocket.
 * QZ Tray must be installed and running on the machine.
 * @returns {Promise<boolean>} true if connected
 */
export async function connectQzTray() {
  if (_connected && qz.websocket.isActive()) return true;

  try {
    qz.security.setCertificatePromise((resolve) => {
      resolve();
    });

    qz.security.setSignatureAlgorithm('SHA512');

    qz.security.setSignaturePromise(() => (resolve) => {
      resolve();
    });

    await qz.websocket.connect();
    _connected = true;

    // Load saved printer preference
    const saved = await get(QZ_SETTINGS_KEY);
    if (saved?.printerName) {
      _selectedPrinter = saved.printerName;
      _printerConfig = qz.configs.create(saved.printerName, { forceRaw: true });
    }

    console.log('[QZ Tray] ✅ Connected to QZ Tray');
    return true;
  } catch (err) {
    _connected = false;
    console.warn('[QZ Tray] ❌ Connection failed:', err.message || err);
    return false;
  }
}

/**
 * Disconnect from QZ Tray gracefully.
 */
export async function disconnectQzTray() {
  try {
    if (qz.websocket.isActive()) {
      await qz.websocket.disconnect();
    }
    _connected = false;
  } catch (e) {
    // Ignore disconnect errors
  }
}

/**
 * Check if QZ Tray is currently connected.
 * @returns {boolean}
 */
export function isQzConnected() {
  try {
    return _connected && qz.websocket.isActive();
  } catch {
    return false;
  }
}

// ─── Printer Detection ──────────────────────────────────────

/**
 * Find all available printers visible to QZ Tray.
 * @returns {Promise<string[]>} Array of printer names
 */
export async function findPrinters() {
  if (!isQzConnected()) {
    const connected = await connectQzTray();
    if (!connected) throw new Error('QZ Tray is not running. Please install and launch QZ Tray.');
  }

  try {
    const printers = await qz.printers.find();
    return Array.isArray(printers) ? printers : [printers];
  } catch (err) {
    console.error('[QZ Tray] Printer detection failed:', err);
    throw new Error('Failed to detect printers. Check QZ Tray status.');
  }
}

/**
 * Get the system default printer name.
 * @returns {Promise<string>}
 */
export async function getDefaultPrinter() {
  if (!isQzConnected()) await connectQzTray();
  return qz.printers.getDefault();
}

/**
 * Select and save a printer for KOT/Bill printing.
 * @param {string} printerName - Exact printer name as returned by findPrinters()
 */
export async function selectPrinter(printerName) {
  _selectedPrinter = printerName;
  _printerConfig = qz.configs.create(printerName, { forceRaw: true });
  
  await set(QZ_SETTINGS_KEY, { printerName });
  console.log(`[QZ Tray] 🖨️ Printer selected: ${printerName}`);
}

/**
 * Get the currently selected printer name.
 * @returns {string|null}
 */
export function getSelectedPrinter() {
  return _selectedPrinter;
}

// ─── ESC/POS Receipt Formatting ─────────────────────────────

// ESC/POS Command constants
const ESC = '\x1B';
const GS = '\x1D';
const CMD = {
  INIT:         `${ESC}@`,          // Initialize printer
  BOLD_ON:      `${ESC}E\x01`,     // Bold ON
  BOLD_OFF:     `${ESC}E\x00`,     // Bold OFF
  CENTER:       `${ESC}a\x01`,     // Center alignment
  LEFT:         `${ESC}a\x00`,     // Left alignment
  DOUBLE_H:     `${GS}!\x10`,     // Double height text
  NORMAL_SIZE:  `${GS}!\x00`,     // Normal size text
  CUT:          `${GS}V\x41\x08`, // Partial cut with feed
  FEED:         '\n\n\n\n\n',      // Paper feed
  LINE:         '--------------------------------\n'
};

/**
 * Format a KOT receipt as ESC/POS raw commands.
 * @param {Object} orderData - { tableName, orderId, orderType, items: [{name, qty, note}], notes }
 * @param {Object} settings - { billHeader }
 * @returns {string[]} Array of raw print data strings
 */
export function formatKotReceipt(orderData, settings = {}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const data = [];

  // Initialize
  data.push(CMD.INIT);
  
  // Header - centered
  data.push(CMD.CENTER);
  data.push(`${dateStr}  ${timeStr}\n`);
  data.push(CMD.BOLD_ON);
  data.push(CMD.DOUBLE_H);
  data.push(`KOT\n`);
  data.push(CMD.NORMAL_SIZE);
  data.push(CMD.BOLD_OFF);
  data.push(`${settings.billHeader || 'TYDE CAFE'}\n`);
  data.push(`${orderData.orderType || 'Dine In'}\n`);
  data.push(CMD.BOLD_ON);
  data.push(`Table: ${orderData.tableName}\n`);
  data.push(CMD.BOLD_OFF);
  if (orderData.orderId) data.push(`Order: ${orderData.orderId}\n`);
  data.push(CMD.LINE);

  // Items - left aligned
  data.push(CMD.LEFT);
  data.push(CMD.BOLD_ON);
  data.push('Item              Note      Qty\n');
  data.push(CMD.BOLD_OFF);
  data.push(CMD.LINE);

  for (const item of orderData.items) {
    const nameStr = (item.name || '').substring(0, 16).padEnd(18, ' ');
    const noteStr = (item.note || '--').substring(0, 8).padEnd(10, ' ');
    const qtyStr = String(item.qty || item.quantity || 1).padStart(3, ' ');
    data.push(CMD.BOLD_ON);
    data.push(`${nameStr}${noteStr}${qtyStr}\n`);
    data.push(CMD.BOLD_OFF);
  }

  data.push(CMD.LINE);

  // Notes section (if any)
  if (orderData.notes) {
    data.push(CMD.CENTER);
    data.push(`NOTE: ${orderData.notes}\n`);
    data.push(CMD.LINE);
  }

  // Total items count
  const totalQty = orderData.items.reduce((sum, i) => sum + (i.qty || i.quantity || 1), 0);
  data.push(CMD.CENTER);
  data.push(`Total Items: ${totalQty}\n`);
  
  // Feed and cut
  data.push(CMD.FEED);
  data.push(CMD.CUT);

  return data;
}

/**
 * Format a Bill receipt as ESC/POS raw commands.
 * @param {Object} orderData - Full order data with items, totals, customer info
 * @param {Object} settings - Bill settings from the app
 * @returns {string[]} Array of raw print data strings
 */
export function formatBillReceipt(orderData, settings = {}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const data = [];

  data.push(CMD.INIT);
  data.push(CMD.CENTER);

  // Business header
  data.push(CMD.BOLD_ON);
  data.push(CMD.DOUBLE_H);
  data.push(`${settings.billHeader || 'TYDE CAFE'}\n`);
  data.push(CMD.NORMAL_SIZE);
  data.push(CMD.BOLD_OFF);
  if (settings.address) data.push(`${settings.address}\n`);
  if (settings.gstin && settings.showGst) data.push(`GSTIN: ${settings.gstin}\n`);
  if (settings.fssai && settings.showFssai) data.push(`FSSAI: ${settings.fssai}\n`);
  data.push(CMD.LINE);

  // Customer info
  data.push(CMD.LEFT);
  if (orderData.customerName) data.push(`Customer: ${orderData.customerName}\n`);
  if (orderData.customerPhone) data.push(`Phone: ${orderData.customerPhone}\n`);
  if (orderData.customerName || orderData.customerPhone) data.push(CMD.LINE);

  // Order meta
  data.push(`Date: ${dateStr}  ${timeStr}\n`);
  data.push(`${orderData.orderType || 'Dine In'}: ${orderData.tableName || ''}\n`);
  if (orderData.billNumber) data.push(`Bill No: ${orderData.billNumber}\n`);
  data.push(CMD.LINE);

  // Items header
  data.push('Item           Qty  Price   Amt\n');
  data.push(CMD.LINE);

  for (const item of orderData.items) {
    const n = (item.name || '').substring(0, 14).padEnd(15, ' ');
    const q = String(item.qty || item.quantity || 1).padStart(3, ' ');
    const p = String(item.price || 0).padStart(6, ' ');
    const a = String((item.qty || item.quantity || 1) * (item.price || 0)).padStart(6, ' ');
    data.push(`${n}${q}${p}${a}\n`);
  }

  data.push(CMD.LINE);

  // Totals
  const subtotal = orderData.subtotal || orderData.items.reduce((sum, i) => (i.qty || i.quantity || 1) * (i.price || 0) + sum, 0);
  data.push(`Sub Total:       ${String(subtotal).padStart(12, ' ')}\n`);
  if (orderData.discountAmt > 0) data.push(`Discount:       -${String(orderData.discountAmt).padStart(12, ' ')}\n`);
  if (orderData.serviceCharge > 0) data.push(`Srv. Charge:     ${String(orderData.serviceCharge).padStart(12, ' ')}\n`);

  data.push(CMD.BOLD_ON);
  data.push(`GRAND TOTAL:     ${String(orderData.grandTotal || subtotal).padStart(12, ' ')}\n`);
  data.push(CMD.BOLD_OFF);
  data.push(CMD.LINE);

  // Footer
  data.push(CMD.CENTER);
  data.push(`${settings.billFooter || 'Thank You!'}\n`);
  data.push(CMD.FEED);
  data.push(CMD.CUT);

  return data;
}

// ─── Print Execution ────────────────────────────────────────

/**
 * Send a print job via QZ Tray. Falls back to error with guidance.
 * @param {Object} orderData - Order/KOT data
 * @param {'KOT'|'BILL'} type - Print type
 * @param {Object} settings - App settings (billHeader, etc.)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function printViaQzTray(orderData, type = 'KOT', settings = {}) {
  // 1. Ensure connection
  if (!isQzConnected()) {
    const ok = await connectQzTray();
    if (!ok) {
      return {
        success: false,
        message: 'QZ Tray is not running. Please install and start QZ Tray, then try again.'
      };
    }
  }

  // 2. Ensure printer is selected
  if (!_printerConfig || !_selectedPrinter) {
    // Try loading saved config
    const saved = await get(QZ_SETTINGS_KEY);
    if (saved?.printerName) {
      _selectedPrinter = saved.printerName;
      _printerConfig = qz.configs.create(saved.printerName, { forceRaw: true });
    } else {
      return {
        success: false,
        message: 'No printer configured. Go to Settings → Printer Setup to select a thermal printer.'
      };
    }
  }

  // 3. Format receipt
  let printData;
  try {
    if (type === 'KOT') {
      printData = formatKotReceipt(orderData, settings);
    } else {
      printData = formatBillReceipt(orderData, settings);
    }
  } catch (err) {
    return { success: false, message: `Receipt format error: ${err.message}` };
  }

  // 4. Send to printer
  try {
    await qz.print(_printerConfig, printData);
    console.log(`[QZ Tray] ✅ ${type} printed to ${_selectedPrinter}`);
    return { 
      success: true, 
      message: `${type} sent to ${_selectedPrinter}` 
    };
  } catch (err) {
    console.error(`[QZ Tray] ❌ Print failed:`, err);

    // Specific error handling
    if (err?.message?.includes('not found') || err?.message?.includes('not available')) {
      return {
        success: false,
        message: `Printer "${_selectedPrinter}" not found. Is it powered on and connected?`
      };
    }
    if (err?.message?.includes('offline')) {
      return {
        success: false,
        message: `Printer "${_selectedPrinter}" is offline. Check USB/network connection.`
      };
    }
    return { 
      success: false, 
      message: `Print error: ${err.message || 'Unknown error. Check printer connection.'}` 
    };
  }
}

/**
 * Quick test print — sends a small test receipt to the selected printer.
 * @param {Object} settings - App settings
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testPrint(settings = {}) {
  const testData = {
    tableName: 'TEST',
    orderType: 'Test Print',
    orderId: 'TEST-001',
    items: [
      { name: 'Test Item 1', qty: 2, note: '' },
      { name: 'Test Item 2', qty: 1, note: 'spicy' }
    ],
    notes: 'This is a test print from TYDE POS'
  };

  return printViaQzTray(testData, 'KOT', settings);
}
