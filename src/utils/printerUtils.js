import { get, set } from 'idb-keyval';
import {
  connectQzTray,
  isQzConnected,
  findPrinters,
  selectPrinter,
  getSelectedPrinter,
  printViaQzTray
} from './qzTrayPrinter';

/**
 * ═══════════════════════════════════════════════════════════════
 *  TYDE POS — Unified Printing Engine
 *  
 *  Priority: QZ Tray (silent) → Browser Print (fallback)
 *  
 *  QZ Tray = ZERO popups, sends ESC/POS raw commands directly
 *  to the thermal printer via the QZ Tray desktop service.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * The main print function called by KOT and Bill buttons.
 * Uses QZ Tray for silent thermal printing — no browser popups.
 * 
 * @param {Object} orderData - Order object with items, tableName, etc.
 * @param {string} type - 'BILL' or 'KOT'
 */
export const printPosToSerial = async (orderData, type = 'BILL') => {
  // Load settings
  let settings = {
    resName: 'Tyde Cafe',
    headerText: 'Nerul Ferry Terminal',
    footerText: 'Sea you soon - under the moon',
    showResName: true,
    showResNameBold: true,
    showHeadlineBold: false,
    showFooterBold: false,
    showRetailOnTop: false,
    showBillerName: true,
    showCustInfo: true,
    hideEmptyCustLabels: true,
    subTotalLbl: 'Sub Total',
    showAddonPrice: true,
    showAddonSeparateRow: true,
    showAddonMultiplication: true,
    highlightOrderId: 'last4',
    kotHeader: 'Running Table',
    printHSNCode: false,
    printInvoiceBarcode: false,
    showServiceChargeDineIn: true,
    showDeliveryChargeDelivery: true,
    dateTimeFormat: 'DD/MM/YYYY',
    use24HourFormat: true,
    billHeader: 'Tyde Cafe',
    billFooter: 'Sea you soon - under the moon',
    address: 'Nerul Ferry Terminal',
  };

  try {
    const rawSettings = await get('pos_printer_settings');
    if (rawSettings) settings = { ...settings, ...rawSettings };
  } catch (e) {
    console.warn('[Print] Settings load failed, using defaults');
  }

  // Map settings to qzTrayPrinter format
  const qzSettings = {
    billHeader: settings.resName || settings.billHeader || 'Tyde Cafe',
    billFooter: settings.footerText || settings.billFooter || 'Thank You!',
    address: settings.headerText || settings.address || '',
    showGst: settings.showGst || false,
    gstin: settings.gstin || '',
    showFssai: settings.showFssai || false,
    fssai: settings.fssai || '',
  };

  // Normalize order data for the QZ formatter
  const normalizedOrder = {
    tableName: orderData.tableName || orderData.table || '--',
    orderType: orderData.orderType || 'Dine In',
    orderId: orderData.id || orderData.orderId || '',
    billNumber: orderData.billNumber || '',
    customerName: orderData.customerName || '',
    customerPhone: orderData.customerPhone || '',
    notes: orderData.notes || orderData.specialNote || '',
    items: (orderData.items || []).map(item => ({
      name: item.name || 'Unknown',
      qty: item.qty || item.quantity || 1,
      price: item.price || 0,
      note: item.note || item.specialNote || '',
    })),
    subtotal: orderData.subtotal || 0,
    discountAmt: orderData.discountAmt || 0,
    serviceCharge: orderData.serviceCharge || 0,
    grandTotal: orderData.grandTotal || orderData.total || 0,
  };

  // ─── Try QZ Tray (silent printing) ────────────────────────
  try {
    const result = await printViaQzTray(normalizedOrder, type, qzSettings);

    if (result.success) {
      console.log(`[Print] ✅ ${type} printed silently via QZ Tray`);
      return;
    }

    // QZ connected but print failed (printer issue)
    console.warn(`[Print] QZ Tray error: ${result.message}`);
    throw new Error(result.message);
  } catch (qzErr) {
    const msg = qzErr?.message || String(qzErr);
    
    // If QZ Tray is genuinely not running, fall back to browser print
    if (msg.includes('not running') || msg.includes('WebSocket') || msg.includes('ECONNREFUSED')) {
      console.warn('[Print] QZ Tray not available, falling back to browser print dialog...');
      fallbackBrowserPrint(normalizedOrder, type, settings);
      return;
    }

    // For other errors (printer offline, not configured), throw so the UI can show it
    throw new Error(msg);
  }
};

/**
 * Fallback: uses window.print() with a styled receipt.
 * This WILL show a browser print dialog but at least works without QZ Tray.
 */
function fallbackBrowserPrint(orderData, type, settings) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = settings.use24HourFormat
    ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  let html = `<html><head><style>
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; }
    h2 { margin: 4px 0; font-size: 16px; }
    @media print { @page { margin: 0; size: 80mm auto; } }
  </style></head><body>`;

  if (type === 'KOT') {
    html += `<div class="center"><p>${dateStr} ${timeStr}</p>`;
    html += `<h2>KOT</h2>`;
    html += `<p class="bold">${orderData.orderType || 'Dine In'}</p>`;
    html += `<p class="bold">Table: ${orderData.tableName}</p></div>`;
    html += `<div class="line"></div>`;
    for (const item of orderData.items) {
      html += `<div class="row"><span class="bold">${item.name}</span><span>${item.qty}</span></div>`;
      if (item.note) html += `<div style="font-size:10px;padding-left:8px">* ${item.note}</div>`;
    }
    html += `<div class="line"></div>`;
  } else {
    html += `<div class="center">`;
    html += `<h2>${settings.resName || 'Tyde Cafe'}</h2>`;
    html += `<p>${settings.headerText || ''}</p></div>`;
    html += `<div class="line"></div>`;
    html += `<p>${dateStr} ${timeStr} | Table: ${orderData.tableName}</p>`;
    html += `<div class="line"></div>`;
    for (const item of orderData.items) {
      const amt = (item.qty * item.price).toFixed(2);
      html += `<div class="row"><span>${item.name}</span><span>${item.qty} x ${item.price} = ${amt}</span></div>`;
    }
    html += `<div class="line"></div>`;
    const total = orderData.grandTotal || orderData.items.reduce((s, i) => s + i.qty * i.price, 0);
    html += `<div class="row bold"><span>GRAND TOTAL</span><span>Rs.${total.toFixed(2)}</span></div>`;
    html += `<div class="line"></div>`;
    html += `<div class="center"><p>${settings.footerText || 'Thank You!'}</p></div>`;
  }

  html += `</body></html>`;

  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }
}
