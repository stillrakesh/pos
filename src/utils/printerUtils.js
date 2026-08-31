import { get, set } from 'idb-keyval';
import apiService from '../services/apiService';



const SETTINGS_KEY = 'pos_printer_settings';

/**
 * Filter items for Auto-Print KOT based on disabled printer stations in localStorage.
 * 
 * Uses 'captain_auto_print_disabled_stations' — an array of station NAMES that are disabled.
 * Looks up which categories belong to disabled stations via settings.printerStations.
 * Items whose category belongs to a disabled station are excluded from auto-print.
 * 
 * @param {Array} items - order items (each should have a .category)
 * @param {Array} menuItems - full menu for category lookup fallback
 * @param {Object} settings - POS settings containing printerStations
 */
export const filterItemsForAutoPrint = (items = [], menuItems = [], settings = null) => {
  const disabledStr = localStorage.getItem('captain_auto_print_disabled_stations');
  if (!disabledStr) return items; // No disabled stations = print everything

  try {
    const disabledStations = JSON.parse(disabledStr);
    if (!Array.isArray(disabledStations) || disabledStations.length === 0) {
      return items; // Nothing disabled
    }

    // Get the station list from settings
    const stations = settings?.printerStations || [];
    if (stations.length === 0) return items; // No stations configured

    // Build a Set of all categories that belong to disabled stations
    const disabledCategories = new Set();
    for (const station of stations) {
      if (disabledStations.includes(station.name)) {
        for (const cat of (station.categories || [])) {
          disabledCategories.add(cat);
        }
      }
    }

    if (disabledCategories.size === 0) return items; // No categories to exclude

    return items.filter(item => {
      let itemCategory = item.category;
      if (!itemCategory && menuItems?.length) {
        const menuItem = menuItems.find(m => 
          String(m.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase() ||
          String(m.id) === String(item.id || item.item_id)
        );
        if (menuItem) itemCategory = menuItem.category;
      }
      itemCategory = itemCategory || 'General';

      return !disabledCategories.has(itemCategory);
    });
  } catch (e) {
    return items;
  }
};

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
    roundOff: (orderData.roundOff !== undefined && orderData.roundOff !== null && parseFloat(orderData.roundOff) !== 0) 
      ? orderData.roundOff 
      : ((orderData.grandTotal || orderData.total || 0) - ((orderData.subtotal || 0) - (orderData.discountAmt || 0) + (orderData.serviceCharge || 0) + (orderData.gstAmount || 0))),
    grandTotal: orderData.grandTotal || orderData.total || 0,
    isVoid: orderData.isVoid || false,
    isDelta: orderData.isDelta || false,
    timestamp: orderData.timestamp || null
  };

  const printerName = await getSelectedPrinter();

  if (type === 'KOT') {
    // --- KOT Exclusion Logic ---
    const excludedCats = settings.excludedKotCategories || [];
    const kotItems = normalizedOrder.items.filter(item => !excludedCats.includes(item.category));
    
    console.log(`[Print] 🖨️ Printing KOT. Items: ${kotItems.length} (Filtered from ${normalizedOrder.items.length})`);
    
    if (kotItems.length === 0) {
      console.log('[Print] ⏭️ Skipping KOT print: No eligible items left after exclusion filtering.');
      return;
    }

    const kotOrder = { ...normalizedOrder, items: kotItems };

    if (settings.separateKotByCategory || settings.separateKotStations) {
      const stations = settings.printerStations || settings.kotGroups || [];
      const grouped = {};

      kotItems.forEach(item => {
        const station = stations.find(s => (s.categories || []).includes(item.category));
        const stationName = station ? station.name : 'MAIN KITCHEN';
        if (!grouped[stationName]) grouped[stationName] = [];
        grouped[stationName].push(item);
      });

      const slips = Object.keys(grouped).map(sName => {
        const station = stations.find(s => s.name === sName);
        return {
          ...normalizedOrder,
          items: grouped[sName],
          categoryHeader: sName.toUpperCase(),
          targetPrinter: station ? (station.printerName || station.ip || printerName) : printerName
        };
      });

      console.log(`[Print] KOT split into ${slips.length} slips based on stations/categories`);
      for (const slip of slips) {
        await doPrint([slip], type, settings, slip.targetPrinter);
      }
    } else {
      await doPrint([kotOrder], type, settings, printerName);
    }
  } else {
    console.log('[Print] 🧾 Printing BILL:', normalizedOrder.billNumber || normalizedOrder.orderId);
    await doPrint([normalizedOrder], type, settings, printerName);
  }
};

// ─── ESC/POS byte builder ────────────────────────────────────────────────────
// 80mm thermal paper = 48 characters wide at standard font.
function buildEscPos(orders, type, settings) {
  const ESC = 0x1b;
  const GS  = 0x1d;
  const W   = 48; // characters wide for 80mm paper
  const bytes = [];

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const push  = (...b) => bytes.push(...b);
  const txt   = (str) => { for (const ch of String(str ?? '')) bytes.push(ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 63); };
  const nl    = ()    => bytes.push(0x0a);
  const init  = ()    => push(ESC, 0x40);
  const cut   = ()    => push(GS, 0x56, 0x42, 0x00);
  const bold  = (on)  => push(ESC, 0x45, on ? 1 : 0);
  const align = (a)   => push(ESC, 0x61, a);   // 0=left 1=center 2=right
  const dblH  = (on)  => push(GS, 0x21, on ? 0x01 : 0x00); // double height only
  const dblWH = (on)  => push(GS, 0x21, on ? 0x11 : 0x00); // double width+height
  const line  = (c, n = W) => { txt(c.repeat(n)); nl(); };

  // Right-align a value in a field of given width
  const rpad  = (val, w)   => String(val).slice(-w).padStart(w);
  // Left-align a label truncated to width
  const lpad  = (val, w)   => String(val).padEnd(w).slice(0, w);
  // Two-column row: left label, right value filling the full line
  const row2  = (label, val, width = W) => {
    const v = String(val);
    const l = String(label).padEnd(width - v.length).slice(0, width - v.length);
    txt(l + v); nl();
  };

  const cur     = settings.currencySymbol || '\u20b9';

  init();
  const ordersArray = Array.isArray(orders) ? orders : [orders];

  ordersArray.forEach((order, idx) => {
    const orderDate = order.timestamp ? new Date(order.timestamp) : new Date();
    const dateStr = orderDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = orderDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const isTakeaway = 
      /takeaway|take\s*away|pick\s*up|delivery/i.test(order.orderType || '') ||
      (order.tableName && /^(TAK|TA|DEL|DL)-/i.test(order.tableName));
    const tableLabel = (order.tableName || '--')
      .replace(/^table\s*/i, '')
      .replace(/^Takeaway\s*0*/i, 'TK')
      .replace(/^Delivery\s*0*/i, 'DL');

    // ── KOT ────────────────────────────────────────────────────────────────────
    if (type === 'KOT') {
      align(1);
      
      if (order.isVoid) {
        dblWH(true); bold(true);
        txt('*** VOID TICKET ***'); nl();
        dblWH(false); bold(false);
      } else if (order.isDelta) {
        dblWH(true); bold(true);
        txt('*** NEW ITEMS ***'); nl();
        dblWH(false); bold(false);
      }
      
      dblWH(true); bold(true);
      txt(isTakeaway ? 'TAKEAWAY' : 'DINE IN'); nl();
      dblWH(false);
      if (order.categoryHeader) { bold(true); txt(order.categoryHeader); nl(); }
      bold(true);
      txt(isTakeaway
        ? `Token: ${tableLabel}${order.customerName ? ' | ' + order.customerName : ''}`
        : `Table No: ${tableLabel}`);
      nl();
      bold(false);
      txt(`${dateStr}  ${timeStr}`); nl();
      align(0);
      line('-');
      // Header
      bold(true);
      txt(lpad('ITEM', W - 6) + rpad('QTY', 6)); nl();
      bold(false);
      line('-');
      // Items
      (order.items || []).forEach(item => {
        const name = String(item.name || '');
        const qty  = `x${item.qty || 1}`;
        // Wrap long names
        if (name.length <= W - 6) {
          txt(lpad(name, W - 6) + rpad(qty, 6)); nl();
        } else {
          // First line: truncated name
          txt(lpad(name.slice(0, W - 6), W - 6) + rpad(qty, 6)); nl();
          // Continuation: rest of name indented
          let rest = name.slice(W - 6);
          while (rest.length > 0) { txt('  ' + lpad(rest.slice(0, W - 2), W - 2)); nl(); rest = rest.slice(W - 2); }
        }
        const note = item.note || item.notes || item.special_note || item.specialNote;
        if (note) { bold(false); txt(`  >> ${note}`); nl(); }
      });
      line('-');
      nl();

    // ── BILL ───────────────────────────────────────────────────────────────────
    } else {
      // Header
      align(1);
      dblWH(true); bold(true);
      txt('Tyde Cafe'); nl();
      dblWH(false); bold(false);
      if (settings.address || settings.headerText) {
        txt(settings.address || settings.headerText); nl();
      }
      align(0);
      line('=');

      // Info rows
      row2(`Date: ${dateStr}`, timeStr);
      if (isTakeaway) {
        row2('Type: Takeaway', `Token: ${tableLabel}`);
      } else {
        row2('Table:', tableLabel);
      }
      if (order.billNumber) row2('Bill No:', order.billNumber);
      if (order.customerName) row2('Name:', order.customerName);

      line('=');
      // Column header: ITEM(22) QTY(4) RATE(9) AMT(10) + 3 spaces = 48
      bold(true);
      txt(lpad('ITEM', 22) + rpad('QTY', 4) + rpad('RATE', 9) + rpad('AMT', 10)); nl();
      bold(false);
      line('-');

      // Items
      (order.items || []).forEach(item => {
        const name = String(item.name || '');
        const qty  = String(item.qty || 1);
        const rate = (item.price || 0).toFixed(2);
        const amt  = ((item.qty || 1) * (item.price || 0)).toFixed(2);

        if (name.length <= 22) {
          txt(lpad(name, 22) + rpad(qty, 4) + rpad(rate, 9) + rpad(amt, 10)); nl();
        } else {
          txt(lpad(name.slice(0, 22), 22) + rpad(qty, 4) + rpad(rate, 9) + rpad(amt, 10)); nl();
          let rest = name.slice(22);
          while (rest.length > 0) { txt('  ' + lpad(rest.slice(0, 20), 20)); nl(); rest = rest.slice(20); }
        }
        if (item.note) { txt(`  >> ${item.note}`); nl(); }
      });

      line('-');
      const totalQty = (order.items || []).reduce((s, i) => s + (i.qty || 0), 0);
      row2(`Total Qty: ${totalQty}`, `Sub Total: ${cur}${(order.subtotal || 0).toFixed(2)}`);

      if ((order.serviceCharge || 0) > 0) {
        row2('Service Charge (Optional)', `${cur}${order.serviceCharge.toFixed(2)}`);
      }
      if ((order.gstAmount || 0) > 0) {
        row2('GST', `${cur}${order.gstAmount.toFixed(2)}`);
      }
      if (order.roundOff != null && parseFloat(order.roundOff) !== 0) {
        row2('Round Off', `${parseFloat(order.roundOff) >= 0 ? '+' : ''}${parseFloat(order.roundOff).toFixed(2)}`);
      }

      line('=');
      // Grand total — double height for impact
      bold(true); dblH(true);
      row2('GRAND TOTAL', `${cur}${(order.grandTotal || 0).toFixed(2)}`);
      dblH(false); bold(false);
      line('=');

      // Footer
      align(1);
      txt('Sea you soon under the moon'); nl();
      nl();
      align(0);
    }

    if (idx < ordersArray.length - 1) { nl(); nl(); cut(); }
  });

  nl(); nl(); nl();
  cut();
  return bytes;
}


async function doPrint(orders, type, settings, printerName) {
  const html  = generatePrintHTML(orders, type, settings);
  const bytes = buildEscPos(orders, type, settings);

  // Check if silent printing is explicitly disabled by user
  const silentDisabled = localStorage.getItem('pos_silent_print_disabled') === 'true';
  if (silentDisabled) {
    console.log('[Print] Silent printing disabled by user — opening browser dialog.');
    fallbackToBrowser(html);
    return;
  }

  // ─── Priority 1: Electron webContents.print({ silent: true }) ────────────────
  // This is the PRIMARY method — works on both Windows and macOS.
  // Uses Electron's native print API, no lp or PowerShell needed.
  if (window.electronAPI?.printSilent && printerName) {
    try {
      const result = await window.electronAPI.printSilent(html, printerName);
      if (result.success) {
        console.log('[Print] ✅ Silent print succeeded (Electron native).');
        return;
      }
      console.warn('[Print] ⚠️ Silent print failed:', result.message, '— trying raster method...');
    } catch (e) {
      console.warn('[Print] ⚠️ Silent print error:', e.message);
    }
  }

  // ─── Priority 2: HTML raster via Electron capturePage + lp (macOS) ──────────
  if (window.electronAPI?.printHtml && printerName) {
    try {
      const result = await window.electronAPI.printHtml(html, printerName);
      if (result.success) {
        console.log('[Print] ✅ HTML raster print succeeded.');
        return;
      }
      console.warn('[Print] ⚠️ HTML raster print failed:', result.message, '— trying ESC/POS...');
    } catch (e) {
      console.warn('[Print] ⚠️ HTML raster error:', e.message);
    }
  }

  // ─── Priority 3: ESC/POS Raw USB (lp on macOS, PowerShell on Windows) ───────
  if (window.electronAPI?.printRawUsb && printerName) {
    try {
      const result = await window.electronAPI.printRawUsb(bytes, printerName);
      if (result.success) {
        console.log('[Print] ✅ Raw USB print succeeded.');
        return;
      }
      console.warn('[Print] ⚠️ Raw USB failed:', result.message);
    } catch (e) {
      console.warn('[Print] ⚠️ USB error:', e.message);
    }
  }

  // ─── Priority 4: Network TCP (ESC/POS direct to printer IP:9100) ────────────
  if (window.electronAPI?.printRawTcp) {
    try {
      let printerIp = null, printerPort = 9100;
      try {
        const { get: idbGet } = await import('idb-keyval');
        const prefs = await idbGet('pos_printer_settings');
        if (prefs?.printerIp) { printerIp = prefs.printerIp; printerPort = prefs.printerPort || 9100; }
      } catch {}
      if (!printerIp) {
        try {
          const list = await apiService.fetchPrinters();
          const np = list.find(p => p.type === 'network' && p.ip);
          if (np) { printerIp = np.ip; printerPort = np.port || 9100; }
        } catch {}
      }
      if (printerIp) {
        const result = await window.electronAPI.printRawTcp(bytes, printerIp, printerPort);
        if (result.success) { console.log('[Print] ✅ TCP print succeeded.'); return; }
        console.warn('[Print] ⚠️ TCP failed:', result.message);
      }
    } catch (e) { console.warn('[Print] TCP error:', e.message); }
  }

  // ─── Last resort: browser print dialog ──────────────────────────────────────
  console.warn('[Print] All silent methods failed — opening browser print dialog.');
  fallbackToBrowser(html);
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
  // Separator styles per spec
  const boldLine  = '2px solid #000';       // Bill separators
  const kotLine   = '1.5px dotted #000';    // KOT separators
  const thinLine  = '1px solid #000';

  const ordersArray = Array.isArray(orders) ? orders : [orders];
  const cur = settings.currencySymbol || '₹';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  /* ── Reset ─────────────────────────────────────────── */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #fff;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }
  body { display: block; }

  /* ── Outer wrapper — fits all thermal printers including Windows drivers ── */
  .wrap {
    width: 260px;           /* Safe for 80mm thermal: fits even with driver margins */
    max-width: 100%;
    margin: 0;
    padding: 0 3px;         /* 3px each side — minimal for thermal paper */
    height: auto !important;
    overflow: visible !important;
    display: block !important;
  }

   /* ── Receipt inner ── */
  .receipt {
    font-family: Verdana, Geneva, Tahoma, sans-serif;
    font-size: 13px;
    color: #000;
    width: 100%;
    box-sizing: border-box;
    line-height: 1.3;
    -webkit-font-smoothing: none;
    text-rendering: optimizeSpeed;
    word-wrap: break-word;
    overflow: visible;
    display: block;
  }

  /* ── Separators ── */
  .sb      { border: 0; border-top: ${boldLine};  margin: 2px 0; }
  .st      { border: 0; border-top: ${thinLine};  margin: 2px 0; }
  .sb-kot  { border: 0; border-top: ${kotLine};   margin: 2px 0; }

  /* ── Header ── */
  .hdr { text-align: center; margin-bottom: 0px; }

  /* ── Two-col info rows (table-based, NO flexbox) ── */
  .ir     { width: 100%; border-collapse: collapse; }
  .ir td  { padding: 0; vertical-align: top; }
  .ir .l  { text-align: left; }
  .ir .r  { text-align: right; white-space: nowrap; padding-left: 4px; }

  /* ── Item table — strict fixed layout ── */
  .t { width: 100%; table-layout: fixed; border-collapse: collapse; }
  .t th {
    font-size: 13px; font-weight: normal;
    text-align: left; padding: 4px 0;
  }
  .t td { font-size: 13px; padding: 3px 0; vertical-align: top; }

  /* ── KOT columns: 75% item / 25% qty ── */
  .kot-item { width: 75%; word-wrap: break-word; text-align: left; overflow: visible; }
  .kot-qty  { width: 25%; text-align: center; }

  /* ── Bill columns: 43% item / 10% qty / 25% price / 22% amount ── */
  .ci { width: 43%; word-wrap: break-word; text-align: left; overflow: visible; }
  .cq { width: 10%; text-align: center; }
  .cp { width: 25%; text-align: center; }
  .ca { width: 22%; text-align: left; padding-left: 4px; }

  /* ── Grand total row ── */
  .gt td {
    font-size: 14px; font-weight: 700; padding: 5px 0;
    border-top: ${boldLine}; border-bottom: ${boldLine};
  }

  /* ── Footer ── */
  .footer { text-align: center; font-size: 12px; margin-top: 0px; padding-bottom: 0px; }

  /* ── Page break for multi-slip KOT ── */
  .pb { page-break-after: always; }

  /* ── Print media ── */
  @media print {
    @page { margin: 0; size: 72mm auto; }
    html, body { margin: 0; padding: 0; width: 100%; }
    .wrap {
      width: 260px;
      box-sizing: border-box;
      margin: 0 auto;
      padding: 0 3px;
      height: auto !important;
      overflow: visible !important;
      display: block !important;
    }
    .receipt {
      font-size: 13px;
      line-height: 1.4;
      overflow: visible !important;
      display: block !important;
    }
  }
</style></head><body><div class="wrap"><div class="receipt">
${ordersArray.map((order, idx) => {
    const orderDate = order.timestamp ? new Date(order.timestamp) : new Date();
    const dateStr = orderDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = orderDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const isTakeaway = 
      /takeaway|take\s*away|pick\s*up|delivery/i.test(order.orderType || '') ||
      (order.tableName && /^(TAK|TA|DEL|DL)-/i.test(order.tableName));
    const totalQty = (order.items || []).reduce((s, i) => s + (i.qty || 0), 0);
    const tableLabel = (order.tableName || '--')
      .replace(/^table\s*/i, '')
      .replace(/^Takeaway\s*0*/i, 'TK')
      .replace(/^Delivery\s*0*/i, 'DL');

    /* ── KOT ─────────────────────────────────────────────── */
    if (type === 'KOT') {
      return `<div class="${idx < ordersArray.length - 1 ? 'pb' : ''}">
      <div class="hdr">
        <div style="font-size:16px;font-weight:700;">${isTakeaway ? 'Takeaway' : 'Dine In'}</div>
        <div style="font-size:13px;font-weight:700;margin-top:2px;">
          ${isTakeaway
            ? `Token: ${tableLabel}${order.customerName ? ' | ' + order.customerName : ''}`
            : `Table No: ${tableLabel}`}
        </div>
        <div style="font-size:12px;margin-top:2px;">${dateStr} &nbsp; ${timeStr}</div>
      </div>
      <hr class="sb-kot"/>
      <table class="t">
        <thead><tr>
          <th class="kot-item" style="text-align:left; border-top:none; border-bottom:${kotLine};">Item</th>
          <th class="kot-qty"  style="text-align:center; border-top:none; border-bottom:${kotLine};">Qty</th>
        </tr></thead>
        <tbody>
          ${(order.items || []).map(item => `
          <tr>
            <td class="kot-item"><strong>${item.name}</strong>${item.note ? `<br/><span style="font-size:11px;font-style:italic;padding-left:5px;">Note: ${item.note}</span>` : ''}</td>
            <td class="kot-qty" style="font-size:14px;font-weight:700;">x${item.qty}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <hr class="sb-kot" style="margin-top:2px;"/>
    </div>`;
    }

    /* ── BILL ─────────────────────────────────────────────── */
    return `<div class="${idx < ordersArray.length - 1 ? 'pb' : ''}">
    <div class="hdr">
      <div style="font-size:15px;font-weight:700;">Tyde Cafe</div>
      ${(settings.headerText || settings.address) ? `<div style="font-size:12px;">${settings.headerText || settings.address}</div>` : ''}
    </div>
    <hr class="sb"/>

    ${order.customerName ? `<div style="font-size:13px;margin-bottom:2px;">Name: ${order.customerName}</div><hr class="sb"/>` : ''}

    ${isTakeaway ? `
      <table class="ir"><tr><td class="l">Date: ${dateStr}</td><td class="r" style="font-weight:700;">Takeaway</td></tr></table>
      <table class="ir"><tr><td class="l">${timeStr}</td><td class="r">Token: ${tableLabel}</td></tr></table>
      <table class="ir" style="margin-bottom:3px;"><tr><td class="l">Cashier: biller</td><td class="r">Bill No.: ${order.billNumber || '---'}</td></tr></table>
    ` : `
      <table class="ir"><tr><td class="l">Date: ${dateStr}</td><td class="r" style="font-weight:700;">Dine In: ${tableLabel}</td></tr></table>
      <table class="ir"><tr><td class="l">${timeStr}</td><td class="r">Bill No.: ${order.billNumber || '---'}</td></tr></table>
      <table class="ir" style="margin-bottom:3px;"><tr><td class="l">Cashier: biller</td><td class="r"></td></tr></table>
    `}

    <table class="t">
      <thead><tr>
        <th class="ci" style="text-align:left;border-top:${boldLine};border-bottom:${boldLine};">Item</th>
        <th class="cq" style="text-align:center;border-top:${boldLine};border-bottom:${boldLine};">Qty</th>
        <th class="cp" style="text-align:center;border-top:${boldLine};border-bottom:${boldLine};">Price</th>
        <th class="ca" style="text-align:left;border-top:${boldLine};border-bottom:${boldLine};">Amount</th>
      </tr></thead>
      <tbody>
        ${(order.items || []).map(item => `
        <tr>
          <td class="ci">${item.name}${item.note ? `<br/><span style="font-size:11px;font-style:italic;">Note: ${item.note}</span>` : ''}</td>
          <td class="cq">${item.qty}</td>
          <td class="cp">${(item.price || 0).toFixed(2)}</td>
          <td class="ca">${((item.qty || 0) * (item.price || 0)).toFixed(2)}</td>
        </tr>`).join('')}

        <!-- Total Qty + Subtotal -->
        <tr>
          <td class="ci" style="border-top:${thinLine};padding-top:4px;text-align:right;padding-right:6px;">Total Qty:</td>
          <td class="cq" style="border-top:${thinLine};padding-top:4px;text-align:center;">${totalQty}</td>
          <td class="cp" style="border-top:${thinLine};padding-top:4px;text-align:center;line-height:1.15;vertical-align:top;">Sub<br/>Total</td>
          <td class="ca" style="border-top:${thinLine};padding-top:4px;">${(order.subtotal || 0).toFixed(2)}</td>
        </tr>

        ${(order.serviceCharge || 0) > 0 ? `
        <tr>
          <td class="ci" style="text-align:right;padding-right:6px;font-size:13px;line-height:1.4;">Service Charge<br/>(Optional)</td>
          <td class="cq"></td><td class="cp"></td>
          <td class="ca">${(order.serviceCharge).toFixed(2)}</td>
        </tr>` : ''}

        ${(order.discountAmt || 0) > 0 ? `
        <tr>
          <td class="ci" style="text-align:right;padding-right:6px;font-size:13px;line-height:1.4;">Discount</td>
          <td class="cq"></td><td class="cp"></td>
          <td class="ca">${(order.discountRate && order.discountRate > 0) ? order.discountRate : (order.subtotal > 0 ? Math.round((order.discountAmt / order.subtotal) * 100) : 0)}%</td>
        </tr>` : ''}

        ${(order.gstAmount || 0) > 0 ? `
        <tr>
          <td class="ci" style="text-align:right;padding-right:6px;">GST</td>
          <td class="cq"></td><td class="cp"></td>
          <td class="ca">${(order.gstAmount).toFixed(2)}</td>
        </tr>` : ''}

        <!-- Bold separator before grand total -->
        <tr><td colspan="4" style="border-top:${boldLine};padding:0;height:1px;font-size:0;line-height:0;"></td></tr>

        <!-- Round off (tiny) -->
        ${Math.abs(parseFloat(order.roundOff || 0)) > 0.01 ? `
        <tr style="font-size:9px;color:#555;">
          <td class="ci" colspan="2"></td>
          <td class="cp" style="text-align:right;white-space:nowrap;padding-right:3px;">Round off</td>
          <td class="ca" style="white-space:nowrap;padding-left:4px;">${parseFloat(order.roundOff || 0) >= 0 ? '+' : ''}${parseFloat(order.roundOff || 0).toFixed(2)}</td>
        </tr>` : ''}
      </tbody>
      <tfoot>
        <!-- Grand Total -->
        <tr>
          <td class="ci" colspan="2" style="padding:5px 10px 5px 0;font-size:14px;font-weight:700;border-bottom:${boldLine};text-align:right;">Grand Total</td>
          <td class="ca" colspan="2" style="padding:5px 0;font-size:14px;font-weight:700;border-bottom:${boldLine};text-align:right;">${cur}${(order.grandTotal || 0).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">Sea you soon under the moon</div>
  </div>`;
  }).join('')}
</div></div>
</body></html>`;

  return html;
}
