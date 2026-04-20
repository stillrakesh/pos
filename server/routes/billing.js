import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

// Normalize raw DB row → canonical client shape (running/vacant)
function normalizeTableRow(t) {
  let items = [];
  try { items = JSON.parse(t.order_items || '[]'); } catch(e) { items = []; }
  const cleanItems = (Array.isArray(items) ? items : []).map(i => ({
    name: String(i.name || ''), price: Number(i.price || 0),
    quantity: Number(i.quantity || i.qty || 1), qty: Number(i.qty || i.quantity || 1)
  }));
  const total = cleanItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const rawStatus = String(t.status || '').toUpperCase();
  const hasItems = cleanItems.length > 0;
  const isActive = ['DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING', 'OCCUPIED', 'SAVED', 'PRINTED', 'RUNNING'].includes(rawStatus);
  const isRunning = isActive || hasItems;

  let finalStatus = 'vacant';
  if (isRunning) {
    if (rawStatus === 'DRAFT') finalStatus = 'draft';
    else if (rawStatus === 'KOT_PENDING') finalStatus = 'kot_pending';
    else if (rawStatus === 'KOT_PRINTED') finalStatus = 'kot_printed';
    else if (rawStatus === 'BILLING' || rawStatus === 'PRINTED') finalStatus = 'billing';
    else finalStatus = 'kot_pending'; 
  }

  return {
    ...t,
    id: String(t.id), tableId: String(t.id),
    table_number: String(t.table_number || t.id),
    name: String(t.name || t.table_number || `Table ${t.id}`),
    status: finalStatus,
    items: cleanItems, orders: cleanItems, order_items: cleanItems,
    pos: { x: t.x ?? 50, y: t.y ?? 50 },
    total, orderValue: total
  };
}

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

    const isVirtual = String(table_id).toUpperCase().startsWith('TA-') || String(table_id).toUpperCase().startsWith('DEL-') || String(table_id).toUpperCase().startsWith('ONL-');
    
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
    activeOrders.forEach(order => {
      statements.updateOrderStatus({ id: order.id, status: 'COMPLETED' });
    });

    // Clear table if physical
    if (table) {
      statements.updateTable({
        id: table.id,
        status: 'AVAILABLE',
        order_items: '[]',
        created_at: ''
      });
    }

    // Enqueue for cloud sync (one-way, local → cloud)
    try {
      statements.enqueueSyncItem({
        type: 'payment_done',
        payload: {
          table_id,
          table_number: table ? table.table_number : table_id,
          payment_mode: payment_mode || 'unknown',
          order_details: order_details || {},
          settled_at: new Date().toISOString()
        }
      });
    } catch (syncErr) {
      console.warn('  ⚠️  Failed to enqueue sync item:', syncErr.message);
    }

    // Emit real-time events
    const io = req.app.get('io');
    if (io) {
      const allTables = statements.getAllTables().map(normalizeTableRow);
      io.emit('table_updated', allTables);
      io.emit('order_updated', {
        id: String(table ? table.id : table_id), 
        table_id: String(table ? table.id : table_id),
        table_number: tableNum,
        items: [], total: 0, status: 'vacant'
      });
    }

    const updated = table ? statements.getTableById({ id: table.id }) : null;
    res.json({ success: true, message: 'Bill settled', table: updated });
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
      statements.updateOrderStatus({ id: order.id, status: 'COMPLETED' });
    });

    // Reset table
    statements.updateTable({ id, status: 'AVAILABLE', order_items: '[]' });

    const updated = statements.getTableById({ id });
    if (updated && updated.order_items) {
      try { updated.order_items = JSON.parse(updated.order_items); } catch (e) { updated.order_items = []; }
    }

    const io = req.app.get('io');
    if (io) {
      const allTables = statements.getAllTables().map(t => {
        try { t.order_items = JSON.parse(t.order_items); } catch(e) { t.order_items = []; }
        return t;
      });
      io.emit('table_updated', allTables);
    }

    res.json({ success: true, message: `Table #${id} cleared`, table: updated });
  } catch (err) {
    console.error(`[POST /api/billing/clear/${req.params.table_id}] Error:`, err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to clear table' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/billing/categories — Return distinct menu categories
// ─────────────────────────────────────────────────────────────
router.get('/categories', (req, res) => {
  try {
    const items = statements.getAllMenu();
    const cats = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
    res.json({ success: true, categories: cats });
  } catch (err) {
    console.error('[GET /api/billing/categories] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch categories' });
  }
});

export default router;
