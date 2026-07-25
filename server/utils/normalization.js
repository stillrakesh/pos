/**
 * Centralized normalization logic for table rows.
 * Standardizes the DB format into the canonical format used by POS and Captain App.
 */
export function normalizeTable(t) {
  if (!t) return null;

  let itemsArr = [];
  try {
    // Handle both column names (order_items vs items) and types
    const rawItems = t.order_items || t.items || '[]';
    const parsed = typeof rawItems === 'string' ? JSON.parse(rawItems || '[]') : rawItems;
    itemsArr = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    itemsArr = [];
  }

  // Normalize every item
  const cleanItems = itemsArr.map(i => ({
    name:     String(i.name || 'Unknown Item'),
    price:    Number(i.price || 0),
    quantity: Number(i.qty !== undefined ? i.qty : (i.quantity !== undefined ? i.quantity : 1)),
    qty:      Number(i.qty !== undefined ? i.qty : (i.quantity !== undefined ? i.quantity : 1)),
    note:     String(i.note || i.notes || '')
  }));

  const subtotal = cleanItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  
  // Discount Calculation
  const discountAmount = Number(t.discount_amount || 0);
  const discountRate = Number(t.discount_rate || 0);
  const finalDiscount = discountAmount > 0 ? discountAmount : (subtotal * discountRate / 100);

  // Tax & Service Charge Calculation
  const scEnabled = Boolean(t.service_charge_enabled === 1 || t.service_charge_enabled === true);
  const scRate = Number(t.service_charge_rate || 5);
  const scAmount = scEnabled ? ((subtotal - finalDiscount) * scRate / 100) : 0;
  
  const taxable = subtotal - finalDiscount + scAmount;
  const gstEnabled = Boolean(t.gst_enabled === 1 || t.gst_enabled === true);
  const gstRate = Number(t.gst_rate || 5);
  const gstAmount = gstEnabled ? (taxable * gstRate / 100) : 0;
  const grandTotal = Math.ceil(taxable + gstAmount);

  // Convert ISO/SQL string to numeric timestamp for POS TimeElapsed component
  let createdAtTs = null;
  if (t.created_at && String(t.created_at).trim() !== '') {
    const d = new Date(t.created_at);
    if (!isNaN(d.getTime())) createdAtTs = d.getTime();
  }

  // Map raw DB status to canonical frontend status
  const rawStatus = String(t.status || '').toUpperCase();
  let canonicalStatus = 'vacant';
  const hasItems = cleanItems.length > 0;
  const isActive = ['DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING', 'OCCUPIED', 'SAVED', 'PRINTED', 'RUNNING'].includes(rawStatus);
  const isRunning = isActive || hasItems;

  if (isRunning) {
    if (rawStatus === 'DRAFT') canonicalStatus = 'draft';
    else if (rawStatus === 'BILLING' || rawStatus === 'PRINTED') canonicalStatus = 'billing';
    else if (rawStatus === 'KOT_PRINTED') canonicalStatus = 'kot_printed';
    else canonicalStatus = 'kot_pending'; // Default for KOT_PENDING, OCCUPIED, RUNNING, etc.
  }

  return {
    ...t,
    id:           String(t.id),
    tableId:      String(t.id),
    table_number: String(t.table_number || t.name || t.id),
    number:       String(t.table_number || t.name || t.id), // For Captain App
    type:         t.zone || 'Main',
    status:       canonicalStatus,
    orderCount:   cleanItems.length,
    orderValue:   grandTotal,
    total:        grandTotal, // For POS UI
    activeItems:  cleanItems,
    order_items:  cleanItems, // Keep for backward compat
    items:        cleanItems, // For Captain App
    createdAt:    createdAtTs,
    customerName: t.customer_name || t.customerName || '',
    customer_name: t.customer_name || t.customerName || '',
    phone:        t.phone || t.customerPhone || '',
    // Add subtotal for bill calculation
    subtotal:     subtotal,
    gstAmount:    gstAmount,
    scAmount:     scAmount,
    discountAmount: finalDiscount,
    discountRate: discountRate,
    // Floor position for Designer
    pos: {
      x: Number(t.x ?? 50),
      y: Number(t.y ?? 50)
    },
    scale:        Number(t.scale ?? 1.0),
    capacity: Number(t.seats || 4) // For Captain App
  };
}
