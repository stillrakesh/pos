import { get, set } from 'idb-keyval';

const SETTINGS_KEY = 'pos_printer_settings';

export async function findPrinters() {
  if (window.electronAPI) {
    try {
      const printers = await window.electronAPI.getPrinters();
      return printers.map(p => p.name);
    } catch (e) {
      console.error('Failed to get printers from Electron:', e);
      return [];
    }
  }
  return [];
}

export async function selectPrinter(printerName) {
  const current = await get(SETTINGS_KEY) || {};
  await set(SETTINGS_KEY, { ...current, printerName });
  console.log('[Print] Printer selected:', printerName);
}

export async function getSelectedPrinter() {
  const prefs = await get(SETTINGS_KEY);
  return prefs?.printerName || null;
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  TYDE POS — Unified Printing Engine (Phase 3B - Direct Electron)
 *  
 *  Priority: Electron Silent Print → Browser Print (fallback)
 * ═══════════════════════════════════════════════════════════════
 */

export const printPosToSerial = async (orderData, type = 'BILL', customSettings = null) => {
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
      try {
        const localRaw = localStorage.getItem('pos_settings');
        if (localRaw) {
          const localSettings = JSON.parse(localRaw);
          settings = { ...settings, ...localSettings };
        }
      } catch (e) { }
      const rawSettings = await get('pos_printer_settings');
      if (rawSettings) settings = { ...settings, ...rawSettings };
    }
  } catch (e) {
    console.warn('[Print] Settings load failed, using defaults');
  }

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

  const printerName = await getSelectedPrinter();

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

    await doPrint(slips, type, settings, printerName);
  } else {
    await doPrint([normalizedOrder], type, settings, printerName);
  }
};

async function doPrint(orders, type, settings, printerName) {
  const html = generatePrintHTML(orders, type, settings);

  if (window.electronAPI) {
    try {
      const result = await window.electronAPI.printHtml(html, printerName);
      if (!result.success) {
        console.warn('[Print] Silent print failed, falling back to browser print:', result.message);
        fallbackToBrowser(html);
      } else {
        console.log(`[Print] ✅ ${type} printed silently via Electron`);
      }
    } catch (e) {
      console.error('[Print] Electron print error:', e);
      fallbackToBrowser(html);
    }
  } else {
    console.warn('[Print] Electron API not found, falling back to browser print.');
    fallbackToBrowser(html);
  }
}

function fallbackToBrowser(html) {
  // Strip the auto-print script if already present, then re-inject cleanly
  const stripped = html
    .replace(/<script>window\.onload.*?<\/script>/gs, '')
    .replace('</body></html>', '');
  const fullHtml = stripped + '<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800);};</script></body></html>';
  const win = window.open('', '_blank', 'width=420,height=900');
  if (win) { win.document.write(fullHtml); win.document.close(); win.focus(); }
}

// Pure function — returns HTML string. Do NOT open any window here.
function generatePrintHTML(orders, type, settings) {
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

  const ordersArray = Array.isArray(orders) ? orders : [orders];

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #fff;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }
  body { display: block; }
  .wrap {
    width: 255px;
    max-width: 100%;
    margin: 0;
    overflow: hidden;
  }
  .receipt {
    font-family: Verdana, Geneva, Tahoma, sans-serif;
    font-size: 13px;
    color: #000;
    width: 100%;
    padding: 0;
    line-height: 1.4;
    -webkit-font-smoothing: none;
    text-rendering: crispEdges;
    word-wrap: break-word;
    overflow: hidden;
  }
  /* Separators */
  .sb { border: 0; border-top: ${boldLine}; margin: 4px 0; }
  .st { border: 0; border-top: ${thinLine};  margin: 3px 0; }
  /* Header */
  .hdr { text-align: center; margin-bottom: 3px; }
  /* Two-col info rows — table-based, NO flexbox */
  .ir { width: 100%; border-collapse: collapse; }
  .ir td { padding: 0; vertical-align: top; }
  .ir .l { text-align: left; }
  .ir .r { text-align: right; white-space: nowrap; padding-left: 4px; }
  /* Item table — Strict fixed layout */
  .t { width: 100%; table-layout: fixed; border-collapse: collapse; }
  .t th {
    font-size: 13px; font-weight: normal;
    text-align: left; padding: 4px 0;
    border-top: ${boldLine}; border-bottom: ${boldLine};
  }
  .t td { font-size: 13px; padding: 3px 0; vertical-align: top; }
  
  /* KOT Fixed Columns (75 / 25) */
  .kot-item { width: 75%; overflow: hidden; word-wrap: break-word; text-align: left; }
  .kot-qty  { width: 25%; text-align: center; }
  
  /* Bill Fixed Columns (45 / 13 / 22 / 20) */
  .ci { width: 45%; overflow: hidden; word-wrap: break-word; text-align: left; }
  .cq { width: 13%; text-align: center; }
  .cp { width: 22%; text-align: right; padding-right: 3px; }
  .ca { width: 20%; text-align: left; padding-left: 4px; }
  /* Grand total row */
  .gt td {
    font-size: 14px; font-weight: 700; padding: 5px 0;
    border-top: ${boldLine}; border-bottom: ${boldLine};
  }
  .footer { text-align: center; font-size: 12px; margin-top: 10px; }
  @media print {
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; width: 100%; }
    .wrap { width: 255px; margin: 0; }
    .receipt { padding: 0; font-size: 12px; }
    .pb { page-break-after: always; }
  }
</style></head><body><div class="wrap"><div class="receipt">
${ordersArray.map((order, idx) => {
    const isTakeaway = order.orderType === 'Takeaway' || order.orderType === 'Delivery' ||
      (order.tableName && /^(TAK|TA|DEL|DL)-/i.test(order.tableName));
    const totalQty = (order.items || []).reduce((s, i) => s + (i.qty || 0), 0);

    /* ── KOT layout ── */
    if (type === 'KOT') {
      return `<div class="${idx < ordersArray.length - 1 ? 'pb' : ''}">
      <div class="hdr">
        <div style="font-size:15px;font-weight:700;">${isTakeaway ? 'Takeaway' : 'Dine In'}</div>
        <div style="font-size:13px;font-weight:700;">
          ${isTakeaway
          ? `Token: ${(order.tableName || '--').replace(/Takeaway\s*/i, 'TK')}${order.customerName ? ' | ' + order.customerName : ''}`
          : `Table No: ${(order.tableName || '--').replace(/^table\s*/i, '')}`}
        </div>
        ${order.categoryHeader ? `<div style="font-size:12px;margin-top:2px;">${order.categoryHeader}</div>` : ''}
        <div style="font-size:12px;margin-top:2px;">${timeStr}</div>
      </div>
      <div style="border-top:1.5px dotted #000; margin: 4px 0;"></div>
      <table class="t">
        <thead><tr>
          <th class="kot-item" style="text-align:left; border-top:none; border-bottom:1.5px dotted #000;">Item</th>
          <th class="kot-qty"  style="text-align:center; border-top:none; border-bottom:1.5px dotted #000;">Qty</th>
        </tr></thead>
        <tbody>
          ${(order.items || []).map(item => `
          <tr>
            <td class="kot-item"><strong>${item.name}</strong>${item.note ? `<br/><span style="font-size:11px;font-style:italic;padding-left:5px;">Note: ${item.note}</span>` : ''}</td>
            <td class="kot-qty" style="font-size:14px;font-weight:700;">x${item.qty}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
    }

    /* ── BILL layout ── */
    const tableLabel = (order.tableName || '--').replace(/^table\s*/i, '');
    return `<div class="${idx < ordersArray.length - 1 ? 'pb' : ''}">

    <div class="hdr">
      <div style="font-size:15px;font-weight:700;">${settings.resName || 'Tyde Cafe'}</div>
      ${(settings.headerText || settings.address) ? `<div style="font-size:12px;">${settings.headerText || settings.address}</div>` : ''}
    </div>
    <hr class="sb"/>

    <div style="font-size:13px;margin-bottom:2px;">Name: ${order.customerName || ''}</div>
    <hr class="sb" style="margin-bottom:4px;"/>

    ${isTakeaway ? `
      <table class="ir"><tr><td class="l">Date: ${dateStr}</td><td class="r" style="font-weight:700;">Takeaway</td></tr></table>
      <table class="ir"><tr><td class="l">${timeStr}</td><td class="r">Token: ${(order.tableName || '--').replace(/Takeaway\s*/i, 'TK')}${order.customerName ? ' | ' + order.customerName : ''}</td></tr></table>
      <table class="ir" style="margin-bottom:3px;"><tr><td class="l">Cashier: biller</td><td class="r">Bill No.: ${order.billNumber || '---'}</td></tr></table>
    ` : `
      <table class="ir"><tr><td class="l">Date: ${dateStr}</td><td class="r" style="font-weight:700;">Dine In: ${tableLabel}</td></tr></table>
      <table class="ir"><tr><td class="l">${timeStr}</td><td class="r">Bill No.: ${order.billNumber || '---'}</td></tr></table>
      <table class="ir" style="margin-bottom:3px;"><tr><td class="l">Cashier: biller</td><td class="r"></td></tr></table>
    `}

    <table class="t">
      <thead><tr>
        <th class="ci" style="text-align:left;">Item</th>
        <th class="cq" style="text-align:center;">Qty</th>
        <th class="cp" style="text-align:right; padding-right:3px;">Price</th>
        <th class="ca" style="text-align:left; padding-left:4px;">Amt</th>
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
          <td class="cp" style="text-align:right;white-space:nowrap;padding-right:3px;">Round off</td>
          <td class="ca" style="white-space:nowrap;text-align:left;padding-left:4px;">${(order.roundOff || 0) >= 0 ? '+' : ''}${parseFloat(order.roundOff || 0).toFixed(2)}</td>
        </tr>
      </tbody>
      <tfoot>
        <!-- Grand Total: border-bottom only (no top border — round off is directly above) -->
        <tr>
          <td class="ci" colspan="2" style="padding:4px 10px 5px 0;font-size:14px;font-weight:700;border-bottom:${boldLine};text-align:right;">Grand Total</td>
          <td class="ca" colspan="2" style="padding:4px 0 5px;font-size:14px;font-weight:700;border-bottom:${boldLine};text-align:right;">${settings.currencySymbol || '\u20b9'}${(order.grandTotal || 0).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">${settings.footerText || settings.billFooter || 'Sea you soon \u2014 under the moon'}</div>
  </div>`;
  }).join('')}
</div></div>
</body></html>`;

  return html;
}


