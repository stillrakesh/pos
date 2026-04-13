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
    roundOff: orderData.roundOff || 0,
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
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const html = `<html><head>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Verdana:wght@400;700&display=swap');
      
      body { 
        font-family: 'Verdana', sans-serif; 
        width: 240px; 
        margin: 0; 
        padding: 0 5px; 
        color: #000;
        line-height: 1.1;
      }
      .center { text-align: center; }
      .bold { font-weight: 700; }
      .line { border-top: 1.5px solid #000; margin: 4px 0; }
      .thick-line { border-top: 2.2px solid #000; margin: 4px 0; }
      
      .flex-row { 
        display: flex; 
        justify-content: space-between; 
        align-items: flex-start;
        font-size: 13px;
        margin: 3px 0;
      }

      .item-table { 
        width: 100%; 
        border-collapse: collapse; 
        font-size: 13px; 
        margin: 5px 0;
      }
      .item-table th { 
        border-top: 1.5px solid #000;
        border-bottom: 1.5px solid #000; 
        padding: 5px 0;
        text-align: left; 
      }
      .item-table td { 
        padding: 4px 0;
        vertical-align: top;
      }
      
      .col-item { width: 115px; }
      .col-qty { width: 25px; text-align: center; }
      .col-price { width: 45px; text-align: right; }
      .col-amt { width: 55px; text-align: right; }
      
      .totals-area { 
        margin-top: 5px; 
        font-size: 13px; 
      }
      
      .totals-stack {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      
      .grand-total-row { 
        font-size: 14px; 
        padding: 6px 0; 
        border-top: 1.8px solid #000; 
        border-bottom: 1.8px solid #000; 
        margin-top: 6px;
        display: flex;
        justify-content: space-between;
      }
      
      @media print { 
        @page { margin: 0; size: 80mm auto; } 
      }
    </style></head><body>
    ${type === 'KOT' ? `
      <div class="center" style="margin-top: 5px;">
        <div style="font-size:13px">Running Table</div>
        <div style="font-size:13px">${dateStr} ${timeStr}</div>
        <div style="font-size:13px">KOT - ${orderData.orderId || '---'}</div>
        <div class="bold" style="font-size: 14px; margin-top: 4px;">${orderData.orderType || 'Dine In'}</div>
        <div class="bold" style="font-size: 14px;">Table No: ${orderData.tableName}</div>
      </div>
      <div style="border-top: 1.5px dotted black; margin: 8px 0;"></div>
      <table class="item-table" style="margin-top: 5px;">
        <thead>
          <tr class="bold">
            <th style="width: 140px; text-align: left;">Item</th>
            <th style="width: 60px; text-align: right;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${orderData.items.map(item => `
            <tr>
              <td style="padding: 5px 0;">
                <span class="bold" style="font-size: 14px;">${item.name}</span>
                ${item.note ? `<br/><span style="font-size: 12px; font-style: italic; color: #333;">* Note: ${item.note}</span>` : ''}
              </td>
              <td style="text-align: right; font-size: 15px;" class="bold">${item.qty}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="border-top: 1.5px dotted black; margin-top: 10px;"></div>
    ` : `
      <div class="center" style="margin-top: 5px;">
        <div class="bold" style="font-size: 14px;">${settings.resName || 'Tyde Cafe'}</div>
        <div style="font-size: 13px;">${settings.headerText || 'Nerul Ferry Terminal'}</div>
      </div>
      
      <div class="line" style="margin-top: 10px;"></div>
      <div style="font-size: 13px; margin: 5px 0;">Name: ______________________</div>
      <div class="line"></div>
      
      <!-- 2-COLUMN HEADER (3 ROWS) -->
      <div class="flex-row">
        <span>Date: ${dateStr}</span>
        <span class="bold">Dine In: ${orderData.tableName}</span>
      </div>
      <div class="flex-row">
        <span>${timeStr}</span>
        <span>Bill No.: ${orderData.billNumber || '---'}</span>
      </div>
      <div class="flex-row">
        <span>Cashier: ${orderData.cashier || 'biller'}</span>
        <span></span>
      </div>
      
      <div class="line" style="margin-bottom: 0;"></div>
      <table class="item-table">
        <thead>
          <tr class="bold">
            <th class="col-item">Item</th>
            <th class="col-qty">Qty</th>
            <th class="col-price">Price</th>
            <th class="col-amt">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${orderData.items.map(item => `
            <tr>
              <td class="col-item">${item.name}</td>
              <td class="col-qty">${item.qty}</td>
              <td class="col-price">${item.price.toFixed(0)}</td>
              <td class="col-amt">${(item.qty * item.price).toFixed(0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="line" style="margin-top: 0;"></div>
      
      <div class="totals-area">
        <!-- SUB TOTAL ROW -->
        <div class="totals-stack">
          <div style="flex: 1; padding-left: 50px; display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="line-height: 1;">Sub<br/>Total</div>
            <div class="col-amt">${(orderData.subtotal || 0).toFixed(2)}</div>
          </div>
        </div>
        
        <div class="flex-row">
          <span>Total Qty: ${orderData.items.reduce((s, i) => s + i.qty, 0)}</span>
          <span></span>
        </div>
        
        <!-- SERVICE CHARGE ROW -->
        <div class="totals-stack">
          <div style="flex: 1; display: flex; justify-content: space-between; align-items: flex-start;">
             <div style="line-height: 1.1;">Service Charge<br/><span style="font-size: 11px;">(Optional)</span></div>
             <div class="col-amt">${(orderData.serviceCharge || 0).toFixed(2)}</div>
          </div>
        </div>
        
        <div class="line" style="margin-top: 10px; border-top-width: 1px;"></div>
        
        <div class="flex-row" style="justify-content: flex-end; font-size: 11px; margin-top: 4px;">
          <span style="margin-right: 15px;">Round off</span>
          <span class="col-amt">${(orderData.roundOff || 0) >= 0 ? '+' : ''}${parseFloat(orderData.roundOff || 0).toFixed(2)}</span>
        </div>
        
        <div class="grand-total-row bold">
          <span>Grand Total</span>
          <span style="font-size: 16px;">${settings.currencySymbol || '₹'}${ (orderData.grandTotal || 0).toFixed(2) }</span>
        </div>
      </div>
      
      <div class="center" style="font-size: 13px; margin-top: 15px; margin-bottom: 10px;">
        ${settings.footerText || 'Sea you soon — under the moon'}
      </div>
    `}
    <div style="height: 20px;"></div>
    <script>
      window.onload = () => {
        window.print();
        setTimeout(() => window.close(), 500);
      };
    </script>
    </body></html>`;

  const printWindow = window.open('', '_blank', 'width=350,height=800');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  }
}
