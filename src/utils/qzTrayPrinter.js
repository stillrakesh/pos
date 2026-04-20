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

// ─── Command Generators (ESC/POS) ────────────────────────────────

function generateCommandsFromTemplate(order, template, settings) {
  const esc = '\x1B';
  const gs = '\x1D';
  const align = { left: esc+'a\x00', center: esc+'a\x01', right: esc+'a\x02' };
  const boldOn = esc+'E\x01';
  const boldOff = esc+'E\x00';
  const sizeNormal = gs+'!\x00';
  const sizeLarge = gs+'!\x11'; // Double Width & Height
  const sizeMedium = gs+'!\x01'; // Double Width

  const charWidth = template.paperWidth === 58 ? 32 : 48;
  const line = '-'.repeat(charWidth) + '\n';

  let data = [];

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Get active sections sorted by order
  const sections = (template.sections || []).filter(s => s.visible).sort((a,b) => a.order - b.order);

  for (const sec of sections) {
    const sAlign = align[sec.style.textAlign || 'left'];
    const isBold = sec.style.fontWeight === 'bold';
    let sSize = sizeNormal;
    if (sec.style.fontSize >= 16) sSize = sizeLarge;
    else if (sec.style.fontSize >= 14) sSize = sizeMedium;

    data.push(sAlign);
    if (isBold) data.push(boldOn);
    data.push(sSize);

    switch (sec.type) {
      case 'header':
        if (sec.data.text) data.push(sec.data.text + '\n');
        data.push(sizeNormal); // reset size for address
        if (sec.data.address) data.push(sec.data.address + '\n');
        if (sec.data.showGst && sec.data.gstNumber) data.push('GSTIN: ' + sec.data.gstNumber + '\n');
        data.push(line);
        break;

      case 'orderInfo':
        data.push(sizeNormal);
        if (sec.data.showBillNo && order.billNumber) data.push('Bill No: ' + order.billNumber + '\n');
        
        let typeLine = '';
        const isTakeaway = order.orderType === 'Takeaway' || order.orderType === 'Delivery' || (order.tableName && (order.tableName.startsWith('TAK-') || order.tableName.startsWith('DEL-') || order.tableName.startsWith('TA-')));
        
        if (sec.data.showTableNo) {
          if (isTakeaway) {
            typeLine += 'Takeaway No: ' + (order.tableName || '--') + '  ';
          } else {
            typeLine += 'Table: ' + (order.tableName || '--') + '  ';
          }
        }
        if (sec.data.showOrderType) typeLine += 'Type: ' + (isTakeaway ? 'Takeaway' : 'Dine In');
        if (typeLine) data.push(typeLine.trim() + '\n');

        if (sec.data.showDateTime) data.push('Date: ' + dateStr + ' ' + timeStr + '\n');
        if (order.categoryHeader) data.push('Category: ' + order.categoryHeader + '\n');
        data.push(line);
        break;

      case 'customerInfo':
        data.push(sizeNormal);
        let hasCust = false;
        if (sec.data.showName && order.customerName) { data.push('Customer: ' + order.customerName + '\n'); hasCust = true; }
        if (sec.data.showMobile && order.customerPhone) { data.push('Mobile: ' + order.customerPhone + '\n'); hasCust = true; }
        if (hasCust) data.push(line);
        break;

      case 'itemList':
        data.push(sizeNormal);
        // Header
        let headW = charWidth - (sec.data.showQty?4:0) - (sec.data.showPrice?8:0) - (sec.data.showTotal?8:0) - 1;
        let headStr = 'ITEM'.padEnd(headW + 1);
        if (sec.data.showQty) headStr += 'QTY '.padStart(4);
        if (sec.data.showPrice) headStr += 'PRICE   '.padStart(8);
        if (sec.data.showTotal) headStr += 'AMT     '.padStart(8);
        data.push(boldOn, headStr.trimEnd() + '\n', boldOff, line);

        // Items
        for (const item of order.items) {
          const amt = (item.qty * item.price).toFixed(0);
          const namePart = (item.name.substring(0, headW)).padEnd(headW + 1);
          
          let rowStr = namePart;
          if (sec.data.showQty) rowStr += item.qty.toString().padStart(3) + ' ';
          if (sec.data.showPrice) rowStr += item.price.toFixed(0).padStart(7) + ' ';
          if (sec.data.showTotal) rowStr += amt.padStart(7);
          
          data.push(rowStr.trimEnd() + '\n');
          if (item.note) data.push('  Note: ' + item.note + '\n');
        }
        data.push(line);
        break;

      case 'charges':
        data.push(sizeNormal);
        const sub = (order.subtotal || 0).toFixed(2);
        data.push('Subtotal'.padEnd(charWidth - sub.length) + sub + '\n');
        if (sec.data.showServiceCharge && order.serviceCharge > 0) {
          const sc = order.serviceCharge.toFixed(2);
          data.push('Service Charge'.padEnd(charWidth - sc.length) + sc + '\n');
        }
        if (sec.data.showGst && order.gstAmount > 0) {
          const gst = order.gstAmount.toFixed(2);
          data.push('GST'.padEnd(charWidth - gst.length) + gst + '\n');
        }
        data.push(line);
        break;

      case 'totalSummary':
        const gt = (order.grandTotal || 0).toFixed(2);
        const spaces = Math.max(1, charWidth - 5 - gt.length);
        data.push(sizeLarge, 'TOTAL' + ' '.repeat(spaces) + gt + '\n', sizeNormal, line);
        break;

      case 'footer':
        data.push(sizeNormal);
        if (sec.data.text) data.push(sec.data.text + '\n');
        break;
    }

    if (isBold) data.push(boldOff);
  }

  data.push('\n\n\n\n', esc + 'm'); // Cut
  return data;
}

function generateKotCommands(order, settings) {
  const templates = settings.printTemplates || [];
  let template = templates.find(t => t.type === 'kot' && t.isDefault) || templates.find(t => t.type === 'kot');
  
  if (!template) {
    // Fallback if no template exists
    template = { paperWidth: 80, sections: [{ id: 's1', type: 'header', visible: true, order: 1, style: { textAlign: 'center', fontSize: 16, fontWeight: 'bold' }, data: { text: 'KOT' } }, { id: 's2', type: 'orderInfo', visible: true, order: 2, style: { textAlign: 'left', fontSize: 14, fontWeight: 'bold' }, data: { showTableNo: true, showOrderType: true, showDateTime: true } }, { id: 's3', type: 'itemList', visible: true, order: 3, style: { textAlign: 'left', fontSize: 14, fontWeight: 'bold' }, data: { showQty: true, showPrice: false, showTotal: false } }] };
  }

  return generateCommandsFromTemplate(order, template, settings);
}

function generateBillCommands(order, settings) {
  const templates = settings.printTemplates || [];
  let template = templates.find(t => t.type === 'bill' && t.isDefault) || templates.find(t => t.type === 'bill');
  
  if (!template) {
    // Fallback
    template = { paperWidth: 80, sections: [{ id: 's1', type: 'header', visible: true, order: 1, style: { textAlign: 'center', fontSize: 14, fontWeight: 'bold' }, data: { text: 'TYDE CAFE', address: '' } }, { id: 's2', type: 'orderInfo', visible: true, order: 2, style: { textAlign: 'left', fontSize: 12, fontWeight: 'normal' }, data: { showBillNo: true, showTableNo: true, showOrderType: true, showDateTime: true } }, { id: 's3', type: 'itemList', visible: true, order: 3, style: { textAlign: 'left', fontSize: 12, fontWeight: 'normal' }, data: { showQty: true, showPrice: true, showTotal: true } }, { id: 's4', type: 'charges', visible: true, order: 4, style: { textAlign: 'right', fontSize: 12, fontWeight: 'normal' }, data: { showGst: true, showServiceCharge: true } }, { id: 's5', type: 'totalSummary', visible: true, order: 5, style: { textAlign: 'right', fontSize: 14, fontWeight: 'bold' }, data: {} }] };
  }

  return generateCommandsFromTemplate(order, template, settings);
}
