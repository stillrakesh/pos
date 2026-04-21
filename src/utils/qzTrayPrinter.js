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

function generateCommandsFromTemplate(order, template, settings, docType = 'BILL') {
  const esc = '\x1B';
  const gs = '\x1D';
  const align = { left: esc+'a\x00', center: esc+'a\x01', right: esc+'a\x02' };
  const boldOn = esc+'E\x01';
  const boldOff = esc+'E\x00';
  const sizeNormal = gs+'!\x00';
  const sizeLarge = gs+'!\x11'; // Double Width & Height
  const sizeMedium = gs+'!\x01'; // Double Width

  const global = template.global || {};
  const marginTop = global.marginTop || 0;
  const marginBottom = global.marginBottom || 4;
  const marginLeft = global.marginLeft || 0;
  const sectionSpacing = global.sectionSpacing || 1;
  const leftPad = ' '.repeat(marginLeft);

  const charWidth = template.paperWidth === 58 ? 32 : 48;
  const availableCharWidth = charWidth - marginLeft;
  const sepChar = global.separatorChar || '=';
  const line = leftPad + sepChar.repeat(availableCharWidth) + '\n';

  let data = [];
  
  // Set custom line spacing (ESC 3 n)
  const lineSpacing = global.lineSpacing !== undefined ? global.lineSpacing : 30;
  data.push(esc + '3' + String.fromCharCode(lineSpacing));

  if (marginTop > 0) data.push('\n'.repeat(marginTop));

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Get active sections sorted by order
  const sections = (template.sections || []).filter(s => s.visible).sort((a,b) => a.order - b.order);

  const itemListSec = sections.find(s => s.type === 'itemList') || { data: {} };

  const wrapSize = (text, fontSize, fontWeight = 'normal') => {
    let result = '';
    const isBold = fontWeight === 'bold' || fontWeight === '900';
    if (isBold) result += boldOn;
    
    let sizeCmd = sizeNormal;
    if (fontSize >= 16) sizeCmd = sizeLarge;
    else if (fontSize >= 14) sizeCmd = sizeMedium;
    
    result += sizeCmd + text + sizeNormal;
    if (isBold) result += boldOff;
    return result;
  };

  // Helper to generate an array of raw strings (no ESC codes) for side-by-side printing
  const generateSectionStrings = (sec, availableWidth) => {
    let lines = [];
    const sepGap = global.separatorSpacing !== undefined ? global.separatorSpacing : 5;
    const lineSpacing = global.lineSpacing !== undefined ? global.lineSpacing : 30;
    const sepChar = global.separatorChar || '=';
    const divider = esc + '3' + String.fromCharCode(sepGap) + '\n' + sepChar.repeat(availableWidth) + '\n' + esc + '3' + String.fromCharCode(lineSpacing);
    
    switch (sec.type) {
      case 'header':
        if (sec.data.text) lines.push(...sec.data.text.split('\n'));
        if (sec.data.address) lines.push(...sec.data.address.split('\n'));
        if (sec.data.showGst && sec.data.gstNumber) lines.push('GSTIN: ' + sec.data.gstNumber);
        break;

      case 'orderInfo': {
        if (docType === 'KOT') {
           const isTakeaway = order.orderType === 'Takeaway' || order.orderType === 'Delivery' || (order.tableName && (order.tableName.startsWith('TAK-') || order.tableName.startsWith('DEL-') || order.tableName.startsWith('TA-')));
           
           const typeFs = sec.data.typeFontSize || sec.style.fontSize || 16;
           const typeFw = sec.data.typeFontWeight || sec.style.fontWeight || 'bold';
           const tableFs = sec.data.tableFontSize || sec.style.fontSize || 14;
           const tableFw = sec.data.tableFontWeight || sec.style.fontWeight || 'bold';
           const timeFs = sec.data.timeFontSize || 12;
           const timeFw = sec.data.timeFontWeight || 'normal';

           if (isTakeaway) {
             lines.push(wrapSize('Takeaway', typeFs, typeFw));
             let tokenLine = 'Token No: ' + (order.tokenNo || '--');
             if (order.customerName) {
                 tokenLine += ' | ' + order.customerName;
             }
             lines.push(wrapSize(tokenLine, tableFs, tableFw));
           } else {
             lines.push(wrapSize('Dine In', typeFs, typeFw));
             const tablePart = (order.tableName || '').replace('Table ', '');
             lines.push(wrapSize('Table No: ' + (tablePart || '--'), tableFs, tableFw));
           }
           
           lines.push(wrapSize(timeStr, timeFs, timeFw));
           break;
        }

        if (sec.style.textAlign === 'center') {
           if (sec.data.showDateTime) {
             lines.push(dateStr);
             lines.push(timeStr);
           }
           if (order.billNumber && sec.data.showBillNo) {
             lines.push('KOT - ' + order.billNumber.split('-').pop());
           }
           
           const isTakeaway = order.orderType === 'Takeaway' || order.orderType === 'Delivery' || (order.tableName && (order.tableName.startsWith('TAK-') || order.tableName.startsWith('DEL-') || order.tableName.startsWith('TA-')));
           if (isTakeaway) {
             lines.push(boldOn + 'Takeaway' + boldOff);
             if (order.tokenNo) lines.push(boldOn + 'Token No: ' + order.tokenNo + boldOff);
           } else {
             lines.push(boldOn + 'Dine In' + boldOff);
             const tablePart = (order.tableName || '').replace('Table ', '');
             if (tablePart) lines.push(boldOn + 'Table No: ' + tablePart + boldOff);
           }
           break;
        }

        const isTakeaway = order.orderType === 'Takeaway' || order.orderType === 'Delivery' || (order.tableName && (order.tableName.startsWith('TAK-') || order.tableName.startsWith('DEL-') || order.tableName.startsWith('TA-')));
        const typeStr = isTakeaway ? 'Takeaway' : 'Dine In';
        const tablePart = (order.tableName || '').replace('Table ', '');
        
        let l1 = '', r1 = '', l2 = '', l3 = '', r3 = '';
        if (sec.data.showDateTime) {
            l1 = `Date: ${dateStr}`;
            l2 = timeStr;
        }
        if (sec.data.showTableNo || sec.data.showOrderType) {
            r1 = `${typeStr}${sec.data.showTableNo && tablePart ? ': ' + tablePart : ''}`;
        }
        if (sec.data.showBillNo && order.billNumber) {
            r3 = `Bill No.: ${order.billNumber}`;
        }
        l3 = `Cashier: ${settings.cashierName || 'biller'}`;

        const leftColWidth = Math.floor(availableWidth * 0.5);
        const formattedR1 = r1.includes('Dine In') ? boldOn + r1 + boldOff : r1;
        
        if (l1 || r1) lines.push(l1.padEnd(leftColWidth) + formattedR1);
        if (l2) lines.push(l2);
        if (l3 || r3) lines.push(l3.padEnd(leftColWidth) + r3);
        if (order.categoryHeader) lines.push('Category: ' + order.categoryHeader);
        break;
      }

      case 'customerInfo':
        if (sec.data.showName && order.customerName) lines.push('Name: ' + order.customerName);
        if (sec.data.showMobile && order.customerPhone) lines.push('Mobile: ' + order.customerPhone);
        break;

      case 'itemList': {
        const wQty = sec.data.colQty || 4;
        const wPrice = sec.data.colPrice || 8;
        const wTotal = sec.data.colTotal || 8;
        const wNote = sec.data.colNote || 15;
        
        let headW = availableWidth - (sec.data.showQty?wQty:0) - (sec.data.showPrice?wPrice:0) - (sec.data.showTotal?wTotal:0) - (sec.data.showNoteCol?wNote:0) - 1;
        
        let headStr = '';
        if (sec.data.qtyBeforeName && sec.data.showQty) headStr += 'Qty'.padStart(wQty);
        headStr += 'Item'.padEnd(headW + 1);
        if (sec.data.showNoteCol) headStr += 'Special Note'.padStart(wNote);
        if (!sec.data.qtyBeforeName && sec.data.showQty) headStr += 'Qty'.padStart(wQty);
        if (sec.data.showPrice) headStr += 'Price'.padStart(wPrice);
        if (sec.data.showTotal) headStr += 'Amount'.padStart(wTotal);
        lines.push(wrapSize(headStr.trimEnd(), sec.data.headerFontSize, sec.data.headerFontWeight));
        lines.push(divider);

        let processedItems = order.items;
        if (sec.data.mergeDuplicates) {
           const merged = {};
           for (const it of order.items) {
             const key = it.name + (it.price||0);
             if (merged[key]) merged[key].qty += (it.qty||1);
             else merged[key] = {...it};
           }
           processedItems = Object.values(merged);
        }

        for (const item of processedItems) {
          const amt = (item.qty * item.price).toFixed(2);
          const namePart = (item.name.substring(0, headW)).padEnd(headW + 1);
          let rowStr = '';
          
          let formattedName = namePart;
          if (docType === 'KOT') {
              formattedName = boldOn + namePart + boldOff;
          }
          
          if (sec.data.qtyBeforeName && sec.data.showQty) rowStr += item.qty.toString().padStart(wQty);
          rowStr += formattedName;
          if (sec.data.showNoteCol) rowStr += '—'.padStart(wNote);
          if (!sec.data.qtyBeforeName && sec.data.showQty) rowStr += item.qty.toString().padStart(wQty);
          if (sec.data.showPrice) rowStr += item.price.toFixed(2).padStart(wPrice);
          if (sec.data.showTotal) rowStr += amt.padStart(wTotal);
          
          lines.push(rowStr.trimEnd());
          if (item.name.length > headW) {
             lines.push(item.name.substring(headW).trim());
          }
          if (sec.data.showNotes !== false && item.note) {
             lines.push('  Note: ' + item.note);
          }
        }
        break;
      }
      case 'charges': {
        const totalQty = order.items.reduce((sum, i) => sum + (i.qty || 1), 0);
        const subTotal = (order.subtotal || 0).toFixed(2);
        
        lines.push(divider);
        
        const wQty = itemListSec.data.colQty || 4;
        const wPrice = itemListSec.data.colPrice || 8;
        const wTotal = itemListSec.data.colTotal || 8;
        const qtyBefore = itemListSec.data.qtyBeforeName;
        const headW = availableWidth - (itemListSec.data.showQty?wQty:0) - (itemListSec.data.showPrice?wPrice:0) - (itemListSec.data.showTotal?wTotal:0) - 1;

        // 3-Line Sandwich Layout for Mid-Alignment
        
        // Line 1: Sub (Top)
        let row1 = '';
        if (qtyBefore) row1 += ' '.repeat(wQty);
        row1 += ' '.repeat(headW + 1);
        if (!qtyBefore) row1 += ' '.repeat(wQty);
        row1 += 'Sub'.padStart(wPrice);
        lines.push(wrapSize(row1.trimEnd(), sec.data.totalQtyFontSize));

        // Line 2: Total Qty + Amount (Mid)
        let row2 = '';
        if (qtyBefore) row2 += totalQty.toString().padStart(wQty);
        row2 += 'Total Qty:'.padStart(headW + 1);
        if (!qtyBefore) row2 += totalQty.toString().padStart(wQty);
        row2 += ' '.repeat(wPrice);
        row2 += subTotal.padStart(wTotal);
        lines.push(wrapSize(row2.trimEnd(), sec.data.totalQtyFontSize, 'bold'));

        // Line 3: Total (Bottom)
        let row3 = '';
        if (qtyBefore) row3 += ' '.repeat(wQty);
        row3 += ' '.repeat(headW + 1);
        if (!qtyBefore) row3 += ' '.repeat(wQty);
        row3 += 'Total'.padStart(wPrice);
        lines.push(wrapSize(row3.trimEnd(), sec.data.totalQtyFontSize));
        
        if (sec.data.showServiceCharge && order.serviceCharge > 0) {
          const sc = order.serviceCharge.toFixed(2);
          // Line 1: Service Charge (Top)
          let sc1 = '';
          if (qtyBefore) sc1 += ' '.repeat(wQty);
          sc1 += 'Service Charge'.padStart(headW + 1);
          if (!qtyBefore) sc1 += ' '.repeat(wQty);
          lines.push(wrapSize(sc1.trimEnd(), sec.data.serviceChargeFontSize));
          
          // Line 2: Amount (Mid)
          let sc2 = '';
          if (qtyBefore) sc2 += ' '.repeat(wQty);
          sc2 += ' '.repeat(headW + 1);
          if (!qtyBefore) sc2 += ' '.repeat(wQty);
          sc2 += ' '.repeat(wPrice);
          sc2 += sc.padStart(wTotal);
          lines.push(wrapSize(sc2.trimEnd(), sec.data.serviceChargeFontSize, 'bold'));

          // Line 3: (Optional) (Bottom)
          let sc3 = '';
          if (qtyBefore) sc3 += ' '.repeat(wQty);
          sc3 += '(Optional)'.padStart(headW + 1);
          if (!qtyBefore) sc3 += ' '.repeat(wQty);
          lines.push(wrapSize(sc3.trimEnd(), sec.data.serviceChargeFontSize));
        }
        if (sec.data.showGst && order.gstAmount > 0) {
          const gst = order.gstAmount.toFixed(2);
          let gstRow = '';
          if (qtyBefore) gstRow += ' '.repeat(wQty);
          gstRow += 'GST'.padStart(headW + 1);
          if (!qtyBefore) gstRow += ' '.repeat(wQty);
          gstRow += ' '.repeat(wPrice);
          gstRow += gst.padStart(wTotal);
          lines.push(wrapSize(gstRow.trimEnd(), sec.data.serviceChargeFontSize));
        }
        break;
      }

      case 'totalSummary': {
        const ro = (order.roundOff || 0).toFixed(2);
        const gt = (order.grandTotal || 0).toFixed(2);
        const wTotal = itemListSec.data.colTotal || 8;
        const mainW = availableWidth - wTotal;

        lines.push(divider);
        if (ro !== "0.00" && ro !== "-0.00") {
            lines.push(wrapSize('Round off'.padStart(mainW) + (Number(ro) > 0 ? '+' : '') + ro.padStart(wTotal), sec.data.roundOffFontSize));
        }
        lines.push(boldOn + 'Grand Total'.padStart(mainW) + '₹' + gt.padStart(wTotal - 1) + boldOff);
        lines.push(divider);
        break;
      }

      case 'footer':
        if (sec.data.text) lines.push(...sec.data.text.split('\n'));
        break;
    }
    return lines;
  };

  let i = 0;
  while (i < sections.length) {
    const sec = sections[i];

    // Handle Split Columns
    if (sec.style.layout === 'half-left' && i + 1 < sections.length && sections[i+1].style.layout === 'half-right') {
      const secRight = sections[i+1];
      const colWidth = Math.floor(charWidth / 2);
      
      const leftLines = generateSectionStrings(sec, colWidth - 1);
      const rightLines = generateSectionStrings(secRight, colWidth - 1);
      
      data.push(align.left, sizeNormal, boldOff); // Always normal text for columns
      const maxLen = Math.max(leftLines.length, rightLines.length);
      
      for (let j = 0; j < maxLen; j++) {
        const l = (leftLines[j] || '').padEnd(colWidth);
        const r = (rightLines[j] || '');
        data.push(leftPad + l + r + '\n');
      }
      data.push(line);
      if (sectionSpacing > 0 && i < sections.length - 1) data.push('\n'.repeat(sectionSpacing));
      i += 2;
      continue;
    }

    // Handle Full Width Sections (supports bold, sizes, alignments)
    const isBold = sec.style.fontWeight === 'bold';
    let sSize = sizeNormal;
    if (sec.style.fontSize >= 16) sSize = sizeLarge;
    else if (sec.style.fontSize >= 14) sSize = sizeMedium;

    data.push(align[sec.style.textAlign || 'left']);
    if (isBold) data.push(boldOn);
    data.push(sSize);

    const lines = generateSectionStrings(sec, availableCharWidth);
    for (const l of lines) {
      // apply left margin padding if not center or right aligned
      if (sec.style.textAlign === 'center' || sec.style.textAlign === 'right') {
         data.push(l + '\n');
      } else {
         data.push(leftPad + l + '\n');
      }
    }

    if (isBold) data.push(boldOff);
    if (lines.length > 0) {
       data.push(sizeNormal);
       if (['header', 'customerInfo', 'orderInfo'].includes(sec.type)) {
         const sepGap = global.separatorSpacing !== undefined ? global.separatorSpacing : 5;
         data.push(esc + '3' + String.fromCharCode(sepGap), '\n', line, esc + '3' + String.fromCharCode(lineSpacing));
       }
       if (sectionSpacing > 0 && i < sections.length - 1) data.push('\n'.repeat(sectionSpacing));
    }
    
    i++;
  }

  if (marginBottom > 0) data.push('\n'.repeat(marginBottom));
  else data.push('\n\n\n\n');
  data.push(esc + '2'); // Reset to default line spacing
  data.push(esc + 'm'); // Cut
  return data;
}

export function generateKotCommands(order, settings) {
  const templates = settings.printTemplates || [];
  let template = templates.find(t => t.type === 'kot' && t.isDefault) || templates.find(t => t.type === 'kot');
  
  if (!template) {
    template = { paperWidth: 80, sections: [{ id: 's1', type: 'header', visible: true, order: 1, style: { textAlign: 'center', fontSize: 16, fontWeight: 'bold' }, data: { text: 'KOT' } }, { id: 's2', type: 'orderInfo', visible: true, order: 2, style: { textAlign: 'left', fontSize: 14, fontWeight: 'bold' }, data: { showTableNo: true, showOrderType: true, showDateTime: true } }, { id: 's3', type: 'itemList', visible: true, order: 3, style: { textAlign: 'left', fontSize: 14, fontWeight: 'bold' }, data: { showQty: true, showPrice: false, showTotal: false } }] };
  }

  return generateCommandsFromTemplate(order, template, settings, 'KOT');
}

export function generateBillCommands(order, settings) {
  const templates = settings.printTemplates || [];
  let template = templates.find(t => t.type === 'bill' && t.isDefault) || templates.find(t => t.type === 'bill');
  
  if (!template) {
    template = { paperWidth: 80, sections: [{ id: 's1', type: 'header', visible: true, order: 1, style: { textAlign: 'center', fontSize: 14, fontWeight: 'bold' }, data: { text: 'TYDE CAFE', address: '' } }, { id: 's2', type: 'orderInfo', visible: true, order: 2, style: { textAlign: 'left', fontSize: 12, fontWeight: 'normal' }, data: { showBillNo: true, showTableNo: true, showOrderType: true, showDateTime: true } }, { id: 's3', type: 'itemList', visible: true, order: 3, style: { textAlign: 'left', fontSize: 12, fontWeight: 'normal' }, data: { showQty: true, showPrice: true, showTotal: true } }, { id: 's4', type: 'charges', visible: true, order: 4, style: { textAlign: 'right', fontSize: 12, fontWeight: 'normal' }, data: { showGst: true, showServiceCharge: true } }, { id: 's5', type: 'totalSummary', visible: true, order: 5, style: { textAlign: 'right', fontSize: 14, fontWeight: 'bold' }, data: {} }] };
  }

  return generateCommandsFromTemplate(order, template, settings, 'BILL');
}
