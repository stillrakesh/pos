import { get, set } from 'idb-keyval';

/**
 * High-fidelity ESC/POS Printing Engine
 * Handles Bill and KOT generation with specific fiscal and branding logic.
 */
export const printPosToSerial = async (orderData, type = 'BILL') => {
  let seqNumber = 1;
  try {
    const key = type === 'BILL' ? 'pos_bill_sequence' : 'pos_kot_sequence';
    seqNumber = await get(key) || 1;
    await set(key, seqNumber + 1);
  } catch (e) {
    console.error("Sequence error", e);
  }
  const formattedSeq = seqNumber.toString().padStart(4, '0');

  // Load latest settings from store
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
    use24HourFormat: true
  };

  try {
    const rawSettings = await get('pos_printer_settings');
    if (rawSettings) settings = { ...settings, ...rawSettings };
  } catch (e) { console.error("Settings load failed", e); }

  try {
    if (!('serial' in navigator)) throw new Error('Web Serial API not supported.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const writer = port.writable.getWriter();
    const textEncoder = new TextEncoder();

    const init = new Uint8Array([0x1B, 0x40]);
    const boldOn = new Uint8Array([0x1B, 0x45, 1]);
    const boldOff = new Uint8Array([0x1B, 0x45, 0]);
    const centerAlign = new Uint8Array([0x1B, 0x61, 1]);
    const leftAlign = new Uint8Array([0x1B, 0x61, 0]);
    const cutPaper = new Uint8Array([0x1D, 0x56, 0x41, 0x08]);

    const wT = async (text) => await writer.write(textEncoder.encode(text));

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = settings.use24HourFormat 
       ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
       : now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (type === 'KOT') {
      await writer.write(init);
      await writer.write(centerAlign);
      await wT(`${settings.kotHeader}\n`);
      await wT(`${dateStr} ${timeStr}\n`);
      
      const orderIdDisplay = settings.highlightOrderId === 'last4' ? String(orderData.id).slice(-4) : String(orderData.id).slice(-6);
      await wT(`KOT - ${orderIdDisplay}\n`);
      
      await writer.write(boldOn);
      await wT(`${orderData.orderType?.toUpperCase() || 'DINE IN'}\n`);
      await wT(`Table No: ${orderData.tableName || '--'}\n`);
      await writer.write(boldOff);
      await wT("--------------------------------\n");
      await writer.write(leftAlign);
      await wT(`Item`.padEnd(20, ' ') + `Qty`.padStart(12, ' ') + `\n`);
      await wT("--------------------------------\n");

      for (const item of orderData.items) {
        await writer.write(boldOn);
        await wT(`${item.name.substring(0, 19).padEnd(20, ' ')}`);
        await wT(`${item.qty.toString().padStart(12, ' ')}\n`);
        await writer.write(boldOff);
        
        if (item.note) await wT(` * Note: ${item.note}\n`);
        
        if (item.addons && item.addons.length > 0) {
          for (const addon of item.addons) {
            await wT(`  + ${addon.name}\n`);
          }
        }
      }
      await wT("--------------------------------\n\n\n\n\n");
      await writer.write(cutPaper);
    } else {
      // FULL BILL FLOW
      await writer.write(init);
      await writer.write(centerAlign);
      if (settings.showRetailOnTop) await wT(`RETAIL INVOICE\n`);
      
      if (settings.showResName) {
        if (settings.showResNameBold) await writer.write(boldOn);
        await wT(`${settings.resName.toUpperCase()}\n`);
        if (settings.showResNameBold) await writer.write(boldOff);
      }
      
      if (settings.showHeadlineBold) await writer.write(boldOn);
      await wT(`${settings.headerText}\n`);
      if (settings.showHeadlineBold) await writer.write(boldOff);
      
      await wT("--------------------------------\n");
      await writer.write(leftAlign);
      
      if (!settings.hideEmptyCustLabels || orderData.customerName) {
        await wT(`Name: ${orderData.customerName || '________________'}\n`);
      }
      
      await wT(`Date: ${dateStr}      Table: ${orderData.tableName || '--'}\n`);
      await wT(`Time: ${timeStr}      Bill No: ${formattedSeq}\n`);
      
      if (settings.showBillerName) await wT(`Cashier: biller\n`);
      await wT("--------------------------------\n");
      await wT(`Item`.padEnd(12, ' ') + `Qty`.padStart(4, ' ') + `Price`.padStart(8, ' ') + `Amt`.padStart(8, ' ') + `\n`);
      await wT("--------------------------------\n");

      let totalQty = 0;
      for (const item of orderData.items) {
        if (settings.hideZeroPriceItems && item.price === 0) continue;
        
        totalQty += item.qty;
        const subtotal = item.price * item.qty;
        await wT(`${item.name.substring(0, 11).padEnd(12, ' ')}${item.qty.toString().padStart(4, ' ')}${item.price.toFixed(2).padStart(8, ' ')}${subtotal.toFixed(2).padStart(8, ' ')}\n`);
        
        if (settings.printHSNCode && item.hsn) await wT(`  HSN: ${item.hsn}\n`);

        if (item.addons && item.addons.length > 0) {
          for (const addon of item.addons) {
            if (settings.showAddonSeparateRow) {
              const qtyStr = settings.showAddonMultiplication ? `(${item.qty}x${addon.qty || 1})` : '';
              const priceStr = settings.showAddonPrice ? (addon.price * (addon.qty || 1)).toFixed(2) : '';
              await wT(`  + ${addon.name.substring(0, 15)} ${qtyStr.padEnd(8, ' ')} ${priceStr.padStart(8, ' ')}\n`);
            }
          }
        }
      }
      await wT("--------------------------------\n");
      
      const subtotalVal = orderData.items.reduce((acc, i) => acc + (i.price * i.qty), 0);
      
      // Charge Display Checks (Per order type)
      let chargesStr = "";
      const oType = orderData.orderType?.toLowerCase() || 'dine in';
      
      if (oType === 'dine in' && settings.showServiceChargeDineIn && orderData.serviceCharge) {
        chargesStr += `Srv. Chg`.padStart(24, ' ') + `${orderData.serviceCharge.toFixed(2).padStart(8, ' ')}\n`;
      }
      if (oType === 'delivery' && settings.showDeliveryChargeDelivery && orderData.deliveryCharge) {
        chargesStr += `Del. Chg`.padStart(24, ' ') + `${orderData.deliveryCharge.toFixed(2).padStart(8, ' ')}\n`;
      }

      const totalBeforeRound = subtotalVal + (orderData.serviceCharge || 0) + (orderData.deliveryCharge || 0) - (orderData.discountAmt || 0);
      const finalTotal = Math.round(totalBeforeRound);
      const roundOff = (finalTotal - totalBeforeRound).toFixed(2);

      await wT(`Total Qty: ${totalQty}`.padEnd(16, ' ') + `${settings.subTotalLbl.padStart(8, ' ')}${subtotalVal.toFixed(2).padStart(8, ' ')}\n`);
      if (chargesStr) await wT(chargesStr);
      
      await wT("--------------------------------\n");
      await wT(`Round off`.padStart(24, ' ') + `${roundOff.padStart(8, ' ')}\n`);
      
      await writer.write(boldOn);
      await wT(`GRAND TOTAL`.padEnd(16, ' ') + `Rs.${finalTotal.toFixed(2).padStart(13, ' ')}\n`);
      await writer.write(boldOff);
      await wT("================================\n");
      
      if (settings.printInvoiceBarcode) {
        await writer.write(centerAlign);
        await wT(`|||| || | ||| ||\n`); // Fake ascii barcode representing intent
        await wT(`BC_${formattedSeq}\n`);
      }

      await writer.write(centerAlign);
      if (settings.showFooterBold) await writer.write(boldOn);
      await wT(`${settings.footerText}\n`);
      if (settings.showFooterBold) await writer.write(boldOff);
      
      await wT("\n\n\n\n\n");
      await writer.write(cutPaper);
    }

    writer.releaseLock();
    await port.close();
  } catch (err) {
    console.error("Critical Print Fail:", err);
    throw err;
  }
};
