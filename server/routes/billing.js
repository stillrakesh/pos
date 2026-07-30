import { Router } from 'express';
import { statements } from '../db.js';
import { runSyncCycle } from '../syncWorker.js';
import { clearShiftForTable } from '../shifts.js';
import { normalizeTable } from '../utils/normalization.js';

const router = Router();

// ─────────────────────────────────────────────────────────────
// POST /api/billing/settle — Settle a bill and archive it
// Body: { table_id, payment_mode, order_details }
// ─────────────────────────────────────────────────────────────
router.post('/settle', (req, res) => {
  try {
    const { table_id, payment_mode, order_details } = req.body;

    if (!table_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'table_id is required' });
    }

    const isVirtual = String(table_id).toUpperCase().startsWith('TA-') || String(table_id).toUpperCase().startsWith('DL-') || String(table_id).toUpperCase().startsWith('DEL-') || String(table_id).toUpperCase().startsWith('ONL-') || String(table_id).toUpperCase().startsWith('TAK-');
    
    const allTables = statements.getAllTables();
    let table = allTables.find(t => {
      const matchId = String(t.id);
      const matchNum = String(t.table_number).toUpperCase();
      const search = String(table_id).toUpperCase();
      return matchId === search || matchNum === search;
    });

    if (!table && !isVirtual) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Table #${table_id} not found` });
    }

    // Mark all active orders for this table as COMPLETED
    const tableNum = table ? table.table_number : String(table_id);
    const activeOrders = statements.getOrdersByTable({ table_number: tableNum });
    let changesMade = 0;

    const grandTotal = order_details?.grandTotal || order_details?.grand_total || 0;
    const paymentMethod = payment_mode || order_details?.paymentMethod || order_details?.payment_method || 'Unknown';
    const gstAmount = order_details?.gstAmount || order_details?.gst_amount || 0;
    const serviceCharge = order_details?.serviceCharge || order_details?.service_charge || 0;
    const tipAmount = order_details?.tipAmount || order_details?.tip_amount || 0;
    // Hoist itemsToSave so it's accessible both inside the if/else blocks AND in the socket emit below
    const itemsToSave = order_details?.cart || order_details?.orders || order_details?.items || [];

    if (activeOrders.length > 0) {
      activeOrders.forEach(order => {
        if (itemsToSave.length > 0) {
          statements.updateOrderCart({
            id: order.id,
            items: JSON.stringify(itemsToSave),
            notes: order_details?.note || order.notes || '',
            status: 'COMPLETED',
            gst_enabled: gstAmount > 0 ? 1 : 0,
            gst_rate: order_details?.gstRate || 0,
            service_charge_enabled: serviceCharge > 0 ? 1 : 0,
            service_charge_rate: order_details?.serviceChargeRate || 0,
            grand_total: grandTotal,
            payment_method: paymentMethod,
            gst_amount: gstAmount,
            service_charge: serviceCharge,
            tip_amount: tipAmount,
            bill_number: order_details?.billNumber || order_details?.bill_number || table?.bill_number || null,
            customer_name: order_details?.customerName || order_details?.customer_name || null,
            phone: order_details?.phone || order_details?.customerPhone || null
          });
          if (isVirtual) {
            statements.updateOrderDateToNow({ id: order.id });
          }
        } else {
          statements.updateOrderStatus({ id: order.id, status: 'COMPLETED' });
        }
      });
      changesMade = activeOrders.length;
    } else {
      // If no active order exists (e.g., immediate settlement of Pickup order), create it and mark it COMPLETED
      if (itemsToSave.length > 0) {
        const result = statements.insertOrder({
          table_number: tableNum,
          items: JSON.stringify(itemsToSave),
          notes: order_details?.note || '',
          status: 'COMPLETED',
          customer_name: order_details?.customerName || order_details?.customer_name || '',
          phone: order_details?.phone || order_details?.customerPhone || '',
          gst_enabled: gstAmount > 0 ? 1 : 0,
          gst_rate: order_details?.gstRate || 0,
          service_charge_enabled: serviceCharge > 0 ? 1 : 0,
          service_charge_rate: order_details?.serviceChargeRate || 0,
          gst_amount: gstAmount,
          service_charge: serviceCharge,
          discount_amount: order_details?.discountAmt || 0,
          discount_rate: order_details?.discountRate || 0
        });
        changesMade = 1;
        console.log(`  ✅ [SETTLE] Created missing order for ${tableNum} and marked COMPLETED. ID: ${result.lastInsertRowid}`);
      }
    }

    console.log(`  💰 [SETTLE] table=${tableNum} grandTotal=${grandTotal} serviceCharge=${serviceCharge} gstAmount=${gstAmount} tipAmount=${tipAmount} method=${paymentMethod}`);

    try {
      const result = statements.updateOrderPayment({
        table_number: tableNum,
        payment_method: paymentMethod,
        grand_total: grandTotal,
        gst_amount: gstAmount,
        service_charge: serviceCharge,
        tip_amount: tipAmount,
        bill_number: table ? table.bill_number : null,
        customer_name: order_details?.customerName || order_details?.customer_name || null,
        phone: order_details?.phone || order_details?.customerPhone || null
      });
      console.log(`  ✅ [SETTLE] updateOrderPayment changed ${result.changes} rows`);
    } catch(e) { console.error('  ❌ [SETTLE] updateOrderPayment failed:', e.message); }

    // Clear shift history for this table
    clearShiftForTable(tableNum);

    // Clear KDS tickets
    statements.clearTableKotTickets(tableNum);
    if (req.app.get('io')) req.app.get('io').emit('kds_updated');

    // Clear table if physical
    if (table) {
      statements.updateTable({
        id: table.id,
        status: 'AVAILABLE',
        order_items: '[]',
        created_at: null,
        bill_number: null,
        customer_name: '',
        phone: ''
      });
    }

    // Enqueue for cloud sync (one-way, local → cloud)
    try {
      const phone = order_details?.phone || order_details?.customerPhone || (table && table.phone) || '';
      const name = order_details?.customerName || order_details?.customer_name || (table && table.customer_name) || '';
      
      const uniqueOrderId = (activeOrders[0]?.id && typeof activeOrders[0].id === 'number' && activeOrders[0].id > 10000) 
        ? activeOrders[0].id 
        : Date.now();

      statements.enqueueSyncItem({
        type: 'order_settled',
        payload: {
          local_order_id: uniqueOrderId,
          table_number: table ? table.table_number : String(table_id),
          payment_method: paymentMethod || 'Cash',
          grand_total: grandTotal,
          items: itemsToSave,
          customer_name: name,
          phone: phone,
          gst_amount: gstAmount,
          service_charge: serviceCharge,
          discount_amount: order_details?.discountAmt || 0,
          tip_amount: tipAmount,
          type: order_details?.type || order_details?.orderType || (table && (table.type || table.zone)) || (isVirtual ? 'Takeaway' : 'Dine In'),
          split_payments: order_details?.splitPayments || [],
          subtotal: order_details?.subtotal || 0,
          created_at: new Date().toISOString()
        }
      });

      if (phone && phone.length >= 10) {
        statements.enqueueSyncItem({
          type: 'customer_updated',
          payload: { name, phone, amount_spent: grandTotal }
        });
      }

      // Trigger instant cloud push immediately after settlement
      runSyncCycle().catch(err => console.warn('Instant sync trigger warning:', err.message));
    } catch (syncErr) {
      console.warn('  ⚠️  Failed to enqueue sync item:', syncErr.message);
    }

    // --- Phase 2: CRM & Payments Logic ---
    try {
      const db = req.app.get('db');
      if (db) {
        const orderId = isVirtual ? null : (activeOrders[0]?.id || null);
        if (orderId) {
          // 1. Multi-Tender Payments
          if (order_details?.splitPayments && Array.isArray(order_details.splitPayments)) {
            for (const tender of order_details.splitPayments) {
              statements.insertPayment(orderId, tender.amount, tender.method);
            }
          } else {
            statements.insertPayment(orderId, grandTotal, paymentMethod || 'Cash');
          }
        }

        // 2. CRM Upsert & Loyalty
        const phone = order_details?.phone || order_details?.customerPhone || (table && table.phone) || '';
        const name = order_details?.customerName || order_details?.customer_name || (table && table.customer_name) || '';
        if (phone && phone.length >= 10) {
          statements.upsertCustomer(phone, name, grandTotal, order_details?.redeemedPoints || 0);
        }

        // 3. Inventory Deduction (Phase 3)
        if (itemsToSave && Array.isArray(itemsToSave)) {
          for (const item of itemsToSave) {
            if (item.id && item.qty) {
              statements.deductInventoryForMenuItem(item.id, item.qty);
            }
          }
        }
      }
    } catch (crmErr) {
      console.error('  ⚠️  Failed to process CRM/Payments:', crmErr.message);
    }

    const settledOrderPayload = {
      id: isVirtual ? table_id : (activeOrders[0]?.id || Date.now()),
      customerName: order_details?.customerName || order_details?.customer_name || (table && table.customer_name) || `Table ${tableNum}`,
      phone: order_details?.phone || order_details?.customerPhone || '',
      grandTotal: grandTotal,
      paymentMethod: paymentMethod,
      timestamp: new Date().toISOString(),
      status: 'completed',
      paymentStatus: 'PAID',
      type: order_details?.type || order_details?.orderType || (table && (table.type || table.zone)) || (isVirtual ? 'Takeaway' : 'Dine In'),
      cart: itemsToSave,
      tipAmount: tipAmount,
      gstAmount: gstAmount,
      serviceCharge: serviceCharge
    };

    // Emit real-time events
    const io = req.app.get('io');
    statements.clearTableKotTickets(tableNum, table ? table.id : table_id, table ? table.name : null);
    if (io) {
      const allTables = statements.getAllTables().map(normalizeTable);
      io.emit('table_updated', allTables);
      io.emit('kds_updated');
      io.emit('order_updated', {
        id: String(table ? table.id : table_id), 
        table_id: String(table ? table.id : table_id),
        table_number: tableNum,
        items: [], 
        total: 0, 
        status: 'vacant',
        settled_order: settledOrderPayload
      });
    }

    const updated = table ? statements.getTableById({ id: table.id }) : null;
    res.json({ success: true, message: 'Bill settled', table: updated, settled_order: settledOrderPayload });
  } catch (err) {
    console.error('[POST /api/billing/settle] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to settle bill' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/billing/clear/:table_id — Clear table (force reset)
// ─────────────────────────────────────────────────────────────
router.post('/clear/:table_id', (req, res) => {
  try {
    const id = parseInt(req.params.table_id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'table_id must be a number' });
    }

    const table = statements.getTableById({ id });
    if (!table) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Table #${id} not found` });
    }

    // Cancel active orders
    const activeOrders = statements.getOrdersByTable({ table_number: table.table_number });
    activeOrders.forEach(order => {
      statements.updateOrderStatus({ id: order.id, status: 'CANCELED' });
    });

    // Reset table
    statements.updateTable({ id, status: 'AVAILABLE', order_items: '[]', created_at: null, bill_number: null, customer_name: '', phone: '' });
    clearShiftForTable(table.table_number);
    statements.clearTableKotTickets(table.table_number);

    if (req.app.get('io')) req.app.get('io').emit('kds_updated');

    const updated = statements.getTableById({ id });
    if (updated && updated.order_items) {
      try { updated.order_items = JSON.parse(updated.order_items); } catch (e) { updated.order_items = []; }
    }

    const io = req.app.get('io');
    if (io) {
      const allTables = statements.getAllTables().map(normalizeTable);
      io.emit('table_updated', allTables);
    }

    res.json({ success: true, message: `Table #${id} cleared`, table: updated });
  } catch (err) {
    console.error(`[POST /api/billing/clear/${req.params.table_id}] Error:`, err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to clear table' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/billing/print-bill/:table_id — Trigger bill print
// ─────────────────────────────────────────────────────────────
router.post('/print-bill/:table_id', (req, res) => {
  try {
    const tableId = req.params.table_id;
    const allTables = statements.getAllTables();
    let targetTable = allTables.find(t => String(t.id) === String(tableId) || String(t.table_number).toUpperCase() === String(tableId).toUpperCase());

    if (!targetTable) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Table not found' });
    }

    const io = req.app.get('io');
    // Check for existing bill number or generate new one
    let billNumber = targetTable.bill_number;
    if (!billNumber) {
      billNumber = statements.getNextBillNumber();
      statements.updateTable({
        id: targetTable.id,
        bill_number: billNumber
      });
    }

    // Update database status to BILLING
    statements.updateTable({
      id: targetTable.id,
      status: 'BILLING'
    });

    if (io) {
      const allTables = statements.getAllTables().map(normalizeTable);
      io.emit('table_updated', allTables); // Broadcast for table grid updates
      
      const fullTable = normalizeTable(targetTable);
      io.emit('order_updated', {
        ...fullTable,
        id: String(targetTable.id),
        table_id: String(targetTable.id),
        table_number: String(targetTable.table_number),
        status: 'billing', // Use canonical lowercase status
        is_bill_print: true, // Flag for POS terminal to trigger bill print
        bill_number: billNumber // Return the locked bill number
      });
    }

    res.json({ success: true, message: 'Bill print requested' });
  } catch (err) {
    console.error('[POST /api/billing/print-bill] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to request bill print' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/billing/bill-number/:table_id — Get or generate bill number
// ─────────────────────────────────────────────────────────────
router.get('/bill-number/:table_id', (req, res) => {
  try {
    const tableId = req.params.table_id;
    const table = statements.getTableById({ id: tableId });
    if (!table) return res.status(404).json({ error: 'NOT_FOUND', message: 'Table not found' });

    let billNumber = table.bill_number;
    if (!billNumber) {
      billNumber = statements.getNextBillNumber();
      statements.updateTable({ id: table.id, bill_number: billNumber });
    }

    res.json({ success: true, bill_number: billNumber });
  } catch (err) {
    console.error('[GET /api/billing/bill-number] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get bill number' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/billing/history — Retrieve completed & cancelled order history
// ─────────────────────────────────────────────────────────────
router.get('/history', (req, res) => {
  try {
    const orders = statements.getHistoryOrders();
    const parsedOrders = orders.map(o => ({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || [])
    }));
    res.json({ success: true, orders: parsedOrders });
  } catch (err) {
    console.error('[GET /api/billing/history] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve billing history' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/billing/history/:id — Update payment method for settled order
// ─────────────────────────────────────────────────────────────
router.patch('/history/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { payment_method } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const result = statements.updateOrderPaymentMethod({ id, payment_method });
    if (result.changes === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Order not found' });
    }

    const io = req.app.get('io');
    if (io) io.emit('order_updated');

    res.json({ success: true, message: 'Payment method updated successfully' });
  } catch (err) {
    console.error('[PATCH /api/billing/history] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update payment method' });
  }
});

export default router;
