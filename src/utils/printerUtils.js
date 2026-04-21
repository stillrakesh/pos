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
export const printPosToSerial = async (orderData, type = 'BILL', customSettings = null) => {
  // Load default settings
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
    separateKotStations: false,
    printerStations: []
  };

  try {
    if (customSettings) {
      settings = { ...settings, ...customSettings };
    } else {
      // Primary: load from localStorage pos_settings (where printTemplates are saved by BillDesigner)
      try {
        const localRaw = localStorage.getItem('pos_settings');
        if (localRaw) {
          const localSettings = JSON.parse(localRaw);
          settings = { ...settings, ...localSettings };
        }
      } catch (e) { }
      // Secondary: also merge idb-keyval prefs if present (legacy / printer name)
      const rawSettings = await get('pos_printer_settings');
      if (rawSettings) settings = { ...settings, ...rawSettings };
    }
  } catch (e) {
    console.warn('[Print] Settings load failed, using defaults');
  }

  // Map settings to qzTrayPrinter format (preserve all settings including printTemplates)
  const qzSettings = {
    ...settings,
    billHeader: settings.resName || settings.billHeader || 'Tyde Cafe',
    billFooter: settings.footerText || settings.billFooter || 'Thank You!',
    address: settings.headerText || settings.address || '',
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
      category: item.category || 'General'
    })),
    subtotal: orderData.subtotal || 0,
    discountAmt: orderData.discountAmt || 0,
    serviceCharge: orderData.serviceCharge || 0,
    gstAmount: orderData.gstAmount || 0,
    roundOff: orderData.roundOff || 0,
    grandTotal: orderData.grandTotal || orderData.total || 0,
  };

  // ─── Try QZ Tray (silent printing) ────────────────────────
  try {
    if (type === 'KOT' && (settings.separateKotByCategory || settings.separateKotStations)) {
      // Load KOT Stations from settings (backend/config source) or legacy groups
      const stations = settings.printerStations || settings.kotGroups || [];

      // Group items
      const grouped = {};

      normalizedOrder.items.forEach(item => {
        // Find if this item's category belongs to a station
        const station = stations.find(s => (s.categories || []).includes(item.category));
        const stationName = station ? station.name : 'MAIN KITCHEN';

        if (!grouped[stationName]) grouped[stationName] = [];
        grouped[stationName].push(item);
      });

      const groupNames = Object.keys(grouped);
      console.log(`[Print] Grouping KOT into ${groupNames.length} slips using stations:`, groupNames);

      for (const sName of groupNames) {
        const slipOrder = {
          ...normalizedOrder,
          items: grouped[sName],
          categoryHeader: sName.toUpperCase()
        };
        const res = await printViaQzTray(slipOrder, type, qzSettings);
        if (!res.success) throw new Error(res.message);
      }
      return;
    }

    const result = await printViaQzTray(normalizedOrder, type, qzSettings);

    if (!result.success) {
      throw new Error(result.message);
    }

    console.log(`[Print] ✅ ${type} printed silently via QZ Tray`);
    return;
  } catch (qzErr) {
    const msg = qzErr?.message || String(qzErr);

    // If QZ Tray is genuinely not running, fall back to browser print
    // If QZ Tray is not running, not configured, or connection failed, fall back to browser print
    if (
      msg.includes('not running') ||
      msg.includes('WebSocket') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('No printer selected') ||
      msg.includes('not connected')
    ) {
      console.warn('[Print] QZ Tray not available, falling back to browser print dialog...');

      if (type === 'KOT' && (settings.separateKotByCategory || settings.separateKotStations)) {
        const stations = settings.printerStations || settings.kotGroups || [];
        const grouped = {};
        normalizedOrder.items.forEach(item => {
          const station = stations.find(s => (s.categories || []).includes(item.category));
          const stationName = station ? station.name : 'MAIN KITCHEN';
          if (!grouped[stationName]) grouped[stationName] = [];
          grouped[stationName].push(item);
        });

        const slips = Object.keys(grouped).map(sName => ({
          ...normalizedOrder,
          items: grouped[sName],
          categoryHeader: sName.toUpperCase()
        }));

        fallbackBrowserPrint(slips, type, settings);
      } else {
        fallbackBrowserPrint([normalizedOrder], type, settings);
      }
      return;
    }

    // For other errors (printer offline, not configured), throw so the UI can show it
    throw new Error(msg);
  }
};

/**
 * Fallback: uses window.print() with a styled receipt.
 * Layout matches the reference thermal bill exactly.
 */
function fallbackBrowserPrint(orderData, type, settings) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const templates = settings.printTemplates || [];
  const docType = type === 'KOT' ? 'kot' : 'bill';
  const tmpl = templates.find(t => t.type === docType && t.isDefault) || templates.find(t => t.type === docType);
  const glob = tmpl?.global || {};
  const paperMm = tmpl?.paperWidth || 80;
  const paperPx = paperMm === 58 ? 220 : 300;
  const padL = Math.max((glob.marginLeft || 0) * 6, 10);
  const padR = Math.max((glob.marginRight || 0) * 6, 10);
  const padT = (glob.marginTop || 0) * 4;
  const padB = (glob.marginBottom || 4) * 4;
  const sepChar = glob.separatorChar || '=';
  const isDotted = sepChar === '.' || sepChar === '-';
  const boldLine = isDotted ? '1.5px dotted #000' : '2px solid #000';
  const thinLine = '1px solid #000';

  const orders = Array.isArray(orderData) ? orderData : [orderData];

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { display: flex; justify-content: center; }
  .receipt {
    font-family: Verdana, Geneva, Tahoma, sans-serif;
    font-size: 13px;
    color: #000;
    width: 100%;
    max-width: ${paperPx}px;
    padding: ${padT}px ${padR}px ${padB}px ${padL}px;
    line-height: 1.35;
    -webkit-font-smoothing: none;
    text-rendering: crispEdges;
  }
  /* Separators */
  .sb { border: 0; border-top: ${boldLine}; margin: 4px 0; }
  .st { border: 0; border-top: ${thinLine};  margin: 3px 0; }
  /* Header */
  .hdr { text-align: center; margin-bottom: 3px; }
  /* Two-col info rows */
  .ir { display: flex; justify-content: space-between; }
  .ir .l { }
  .ir .r { text-align: right; white-space: nowrap; padding-left: 6px; }
  /* Item table */
  .t { width: 100%; border-collapse: collapse; }
  .t th {
    font-size: 13px; font-weight: normal;
    text-align: left; padding: 4px 0;
    border-top: ${boldLine}; border-bottom: ${boldLine};
  }
  .t td { font-size: 13px; padding: 3px 0; vertical-align: top; }
  /* Fixed column widths — shared by header, body AND totals rows */
  .ci { padding-right: 4px; }
  .cq { width: 22px; text-align: right; padding-right: 6px; }
  .cp { width: 52px; text-align: right; padding-right: 12px; }
  .ca { width: 54px; text-align: right; }
  /* Grand total row */
  .gt td {
    font-size: 14px; font-weight: 700; padding: 5px 0;
    border-top: ${boldLine}; border-bottom: ${boldLine};
  }
  .footer { text-align: center; font-size: 12px; margin-top: 10px; }
  @media print {
    @page { margin: 0; size: ${paperMm}mm auto; }
    body { display: block; }
    .receipt { margin: 0 auto; width: 100%; max-width: 100%; }
    .pb { page-break-after: always; }
  }
</style></head><body><div class="receipt">
${orders.map((order, idx) => {
    const isTakeaway = order.orderType === 'Takeaway' || order.orderType === 'Delivery' ||
      (order.tableName && /^(TAK|TA|DEL|DL)-/i.test(order.tableName));
    const totalQty = (order.items || []).reduce((s, i) => s + (i.qty || 0), 0);

    /* ── KOT layout ── */
    if (type === 'KOT') {
      return `<div class="${idx < orders.length - 1 ? 'pb' : ''}">
      <div class="hdr">
        <div style="font-size:15px;font-weight:700;">${isTakeaway ? 'Takeaway' : 'Dine In'}</div>
        <div style="font-size:13px;font-weight:700;">
          ${isTakeaway
          ? `Token No: ${order.tableName || '--'}${order.customerName ? ' | ' + order.customerName : ''}`
          : `Table No: ${(order.tableName || '--').replace(/^table\s*/i, '')}`}
        </div>
        ${order.categoryHeader ? `<div style="font-size:12px;margin-top:2px;">${order.categoryHeader}</div>` : ''}
        <div style="font-size:12px;margin-top:2px;">${timeStr}</div>
      </div>
      <div style="border-top:1.5px dotted #000; margin: 4px 0;"></div>
      <table class="t">
        <thead><tr>
          <th class="ci" style="font-weight:400; border:none;">Item</th>
          <th class="ca" style="text-align:right; font-weight:400; border:none;">Qty</th>
        </tr></thead>
        <tbody>
          ${(order.items || []).map(item => `
          <tr>
            <td class="ci"><strong>${item.name}</strong>${item.note ? `<br/><span style="font-size:11px;font-style:italic;padding-left:5px;">Note: ${item.note}</span>` : ''}</td>
            <td class="ca" style="font-size:14px;font-weight:700;text-align:right;">x${item.qty}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
    }

    /* ── BILL layout ── */
    const tableLabel = (order.tableName || '--').replace(/^table\s*/i, '');
    return `<div class="${idx < orders.length - 1 ? 'pb' : ''}">

    <div class="hdr">
      <div style="font-size:15px;font-weight:700;">${settings.resName || 'Tyde Cafe'}</div>
      ${(settings.headerText || settings.address) ? `<div style="font-size:12px;">${settings.headerText || settings.address}</div>` : ''}
    </div>
    <hr class="sb"/>

    <div style="font-size:13px;margin-bottom:2px;">Name: ${order.customerName || ''}</div>
    <hr class="sb" style="margin-bottom:4px;"/>

    ${isTakeaway ? `
      <div class="ir"><span class="l">Date: ${dateStr}</span><span class="r" style="font-weight:700;">Takeaway</span></div>
      <div class="ir"><span class="l">${timeStr}</span><span class="r">Token: ${(order.tableName || '--').replace(/Takeaway/i, 'TK')}${order.customerName ? ' | ' + order.customerName : ''}</span></div>
      <div class="ir" style="margin-bottom:3px;"><span class="l">Cashier: biller</span><span class="r">Bill No.: ${order.billNumber || '---'}</span></div>
    ` : `
      <div class="ir"><span class="l">Date: ${dateStr}</span><span class="r" style="font-weight:700;">Dine In: ${tableLabel}</span></div>
      <div class="ir"><span class="l">${timeStr}</span><span class="r">Bill No.: ${order.billNumber || '---'}</span></div>
      <div class="ir" style="margin-bottom:3px;"><span class="l">Cashier: biller</span><span class="r"></span></div>
    `}

    <table class="t">
      <thead><tr>
        <th class="ci">Item</th>
        <th class="cq" style="text-align:center;">Qty</th>
        <th class="cp" style="text-align:center;">Price</th>
        <th class="ca">Amount</th>
      </tr></thead>
      <tbody>
        ${(order.items || []).map(item => `
        <tr>
          <td class="ci">${item.name}${item.note ? `<br/><span style="font-size:11px;font-style:italic;">Note: ${item.note}</span>` : ''}</td>
          <td class="cq">${item.qty}</td>
          <td class="cp">${(item.price || 0).toFixed(2)}</td>
          <td class="ca">${((item.qty || 0) * (item.price || 0)).toFixed(2)}</td>
        </tr>`).join('')}

        <!-- Total Qty row: label in Item col (right), number in Qty col -->
        <tr>
          <td class="ci" style="border-top:${boldLine};padding-top:4px;text-align:right;padding-right:6px;">Total Qty:</td>
          <td class="cq" style="border-top:${boldLine};padding-top:4px;text-align:center;">${totalQty}</td>
          <td class="cp" style="border-top:${boldLine};padding-top:4px;line-height:1.15;vertical-align:top;text-align:center; padding-left:0;">Sub<br/>Total</td>
          <td class="ca" style="border-top:${boldLine};padding-top:4px;">${(order.subtotal || 0).toFixed(2)}</td>
        </tr>
        ${(order.serviceCharge || 0) > 0 ? `
        <!-- Service Charge: 13px, right-aligned under Total Qty, (Optional) on new line -->
        <tr>
          <td class="ci" style="text-align:right;padding-right:6px;font-size:13px;line-height:1.4;">
            Service Charge<br/>(Optional)
          </td>
          <td class="cq"></td>
          <td class="cp"></td>
          <td class="ca">${(order.serviceCharge).toFixed(2)}</td>
        </tr>` : ''}
        ${(order.gstAmount || 0) > 0 ? `
        <tr>
          <td class="ci" style="text-align:right;padding-right:6px;">GST</td>
          <td class="cq"></td>
          <td class="cp"></td>
          <td class="ca">${(order.gstAmount).toFixed(2)}</td>
        </tr>` : ''}

        <!-- Bold separator row -->
        <tr><td colspan="4" style="border-top:${boldLine};padding:0;height:1px;font-size:0;line-height:0;"></td></tr>

        <!-- Round off: extremely small font, sits between bold separator and Grand Total -->
        <tr style="font-size:6px;color:#555;">
          <td class="ci" colspan="2"></td>
          <td class="cp" style="text-align:right;white-space:nowrap;">Round off</td>
          <td class="ca" style="white-space:nowrap;">${(order.roundOff || 0) >= 0 ? '+' : ''}${parseFloat(order.roundOff || 0).toFixed(2)}</td>
        </tr>
      </tbody>
      <tfoot>
        <!-- Grand Total: border-bottom only (no top border — round off is directly above) -->
        <tr>
          <td colspan="4" style="padding:4px 0 5px;font-size:14px;font-weight:700;border-bottom:${boldLine};">
            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <span>Grand Total</span>
              <span>${settings.currencySymbol || '\u20b9'}${(order.grandTotal || 0).toFixed(2)}</span>
            </div>
          </td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">${settings.footerText || settings.billFooter || 'Sea you soon \u2014 under the moon'}</div>
  </div>`;
  }).join('')}
</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800);};</script>
</body></html>`;

  const win = window.open('', '_blank', 'width=420,height=900');
  if (win) { win.document.write(html); win.document.close(); win.focus(); }
}


