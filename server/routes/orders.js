// ⚠️ STABLE CORE - DO NOT MODIFY WITHOUT BACKUP
import { Router } from 'express';
import { statements } from '../db.js'; // used for order CRUD + table status updates

const router = Router();

// ─────────────────────────────────────────────────────────────
// POST /api/orders — Create a new order from captain app
// ─────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { table_number, table_id, items, notes } = req.body;

    // Accept table_id OR table_number (Captain sends table_id)
    const resolvedTableNum = table_number || table_id;

    // --- Validation ---
    if (!resolvedTableNum && resolvedTableNum !== 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'table_number or table_id is required' 
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'items must be a non-empty array' 
      });
    }

    // --- Validation & Enrichment ---
    const allMenu = statements.getAllMenu();
    const normalizedItems = items.map(i => {
      const name = String(i.name || '').trim();
      // Lookup category from DB if missing
      const dbItem = allMenu.find(m => 
        m.name.toLowerCase().trim() === name.toLowerCase() || 
        String(m.id) === String(i.id || i.item_id)
      );
      
      return {
        name:     name,
        quantity: Number(i.quantity || i.qty || 1),
        price:    Number(i.price || dbItem?.price || 0),
        category: i.category || dbItem?.category || 'General'
      };
    }).filter(i => i.name);

    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No valid items provided' });
    }

    // --- Resolve target table ---
    const allTables = statements.getAllTables();
    let targetTable = allTables.find(t => {
      const matchId = String(t.id);
      const matchNum = String(t.table_number).toUpperCase();
      const searchId = table_id ? String(table_id).toUpperCase() : null;
      const searchNum = table_number ? String(table_number).toUpperCase() : null;

      return (
        (searchId && matchId === searchId) || 
        (searchId && matchNum === searchId) ||
        (searchNum && matchNum === searchNum) || 
        (searchNum && matchId === searchNum)
      );
    });

    if (!targetTable) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Table not found` });
    }

    // --- Insert order record ---
    const result = statements.insertOrder({
      table_number: String(targetTable.table_number),
      items: JSON.stringify(normalizedItems),
      notes: notes || '',
      status: 'NEW'
    });

    const order = statements.getOrderById({ id: result.lastInsertRowid });
    if (order) order.items = JSON.parse(order.items);

    const io = req.app.get('io');

    // --- Merge items into table, update status OCCUPIED ---
    try {
      const existing = (() => {
        try { return JSON.parse(targetTable.order_items || '[]'); } catch (e) { return []; }
      })();
      
      // Merge: same name → add quantity
      const mergedMap = new Map();
      existing.forEach(item => {
        const qty = Number(item.quantity || item.qty || 1);
        mergedMap.set(item.name, { ...item, quantity: qty, qty });
      });
      normalizedItems.forEach(item => {
        const addQty = Number(item.quantity || 1);
        if (mergedMap.has(item.name)) {
          const current = mergedMap.get(item.name);
          const newQty = current.quantity + addQty;
          mergedMap.set(item.name, { ...current, quantity: newQty, qty: newQty });
        } else {
          mergedMap.set(item.name, { ...item, quantity: addQty, qty: addQty });
        }
      });
      
      const mergedItems = Array.from(mergedMap.values());
      const isNew = String(targetTable.status).toUpperCase() !== 'OCCUPIED';
      statements.updateTable({
        id:          targetTable.id,
        status:      'OCCUPIED',
        order_items: JSON.stringify(mergedItems),
        created_at:  isNew ? new Date().toISOString() : targetTable.created_at
      });

      if (io) {
        const total = mergedItems.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
        // Emit order_updated (canonical running status)
        io.emit('order_updated', {
          id:           String(targetTable.id),
          table_id:     String(targetTable.id),
          table_number: String(targetTable.table_number),
          order_id:     order?.id,
          items:        mergedItems,
          new_items:    normalizedItems,
          total,
          status:       'kot_pending',
          startedAt:    new Date().toISOString(),
          is_new_kot:   true
        });
        // Also emit full table_updated so both POS and Captain reflect new state
        const updatedTables = statements.getAllTables().map(normalizeTableRow);
        io.emit('table_updated', updatedTables);
      }
    } catch (tableErr) {
      console.warn('[POST /api/orders] Table update warn:', tableErr.message);
    }

    // Enqueue for cloud sync (non-blocking)
    try { statements.enqueueSyncItem({ type: 'order_created', payload: order }); } catch (e) {}

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('[POST /api/orders] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create order' });
  }
});

// Helper: minimal normalize for broadcast (avoids circular import)
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
    dbStatus: rawStatus,
    items: cleanItems, orders: cleanItems, order_items: cleanItems,
    pos: { x: t.x ?? 50, y: t.y ?? 50 },
    total, orderValue: total
  };
}
// ─────────────────────────────────────────────────────────────
// PUT /api/orders/:tableId — POS updates a table's cart
// ─────────────────────────────────────────────────────────────
router.put('/:tableId', (req, res) => {
  try {
    const { tableId } = req.params;
    const { items, status } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'items must be an array' });
    }

    const allTables = statements.getAllTables();
    let targetTable = allTables.find(t => String(t.id) === String(tableId) || String(t.table_number).toUpperCase() === String(tableId).toUpperCase());
    
    if (!targetTable) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Merge incoming items into existing table items — deduplicate by name
    const existingItems = (() => {
      try { return JSON.parse(targetTable.order_items || '[]'); } catch(e) { return []; }
    })();

    const mergedMap = new Map();
    existingItems.forEach(item => {
      const qty = Number(item.quantity || item.qty || 1);
      mergedMap.set(item.name, { ...item, quantity: qty, qty });
    });
    items.forEach(item => {
      const qty = Number(item.quantity || item.qty || 1);
      if (mergedMap.has(item.name)) {
        const current = mergedMap.get(item.name);
        mergedMap.set(item.name, { ...current, quantity: current.quantity + qty, qty: current.quantity + qty });
      } else {
        mergedMap.set(item.name, { ...item, quantity: qty, qty });
      }
    });
    
    const finalItems = Array.from(mergedMap.values());
    const total = finalItems.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
    const dbStatus = status ? status.toUpperCase() : 'OCCUPIED';
    const isStarting = (['AVAILABLE', 'VACANT', 'FREE', ''].includes(String(targetTable.status || '').toUpperCase())) && (dbStatus && !['AVAILABLE', 'VACANT', 'FREE', ''].includes(dbStatus.toUpperCase()));

    statements.updateTable({
      id: targetTable.id,
      status: dbStatus,
      order_items: JSON.stringify(finalItems),
      created_at: isStarting ? new Date().toISOString() : undefined
    });

    const io = req.app.get('io');
    if (io) {
      const updatedTables = statements.getAllTables().map(normalizeTableRow);
      io.emit('table_updated', updatedTables);
      
      let canonicalStatus = 'vacant';
      if (['DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING', 'OCCUPIED', 'SAVED', 'PRINTED', 'RUNNING'].includes(dbStatus)) {
        if (dbStatus === 'DRAFT') canonicalStatus = 'draft';
        else if (dbStatus === 'KOT_PENDING') canonicalStatus = 'kot_pending';
        else if (dbStatus === 'KOT_PRINTED') canonicalStatus = 'kot_printed';
        else if (dbStatus === 'BILLING' || dbStatus === 'PRINTED') canonicalStatus = 'billing';
        else canonicalStatus = 'kot_pending';
      }

      io.emit('order_updated', {
        id: String(targetTable.id),
        table_id: String(targetTable.id),
        table_number: String(targetTable.table_number),
        items: finalItems,
        total,
        status: canonicalStatus,
        startedAt: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Order updated successfully', items: finalItems });
  } catch (err) {
    console.error(`[PUT /api/orders/${req.params.tableId}] Error:`, err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update order' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/orders — List orders, optionally filtered by status
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, table_number, limit = 100, offset = 0 } = req.query;

    let orders;

    if (status) {
      const validStatuses = ['NEW', 'PREPARING', 'READY', 'SERVED', 'PRINTED', 'COMPLETED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({ 
          error: 'VALIDATION_ERROR', 
          message: `status must be one of: ${validStatuses.join(', ')}` 
        });
      }
      orders = statements.getOrdersByStatus({ status: status.toUpperCase() });
    } else if (table_number) {
      orders = statements.getOrdersByTable({ table_number: String(table_number) });
    } else {
      orders = statements.getAllOrders({ 
        limit: Math.min(parseInt(limit) || 100, 500), 
        offset: parseInt(offset) || 0 
      });
    }

    // Parse items JSON for each order
    orders = orders.map(order => ({
      ...order,
      items: JSON.parse(order.items)
    }));

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    console.error('[GET /api/orders] Error:', err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to fetch orders' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/orders/:id — Get a single order by ID
// ─────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'Order ID must be a number' 
      });
    }

    const order = statements.getOrderById({ id });
    if (!order) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: `Order #${id} not found` 
      });
    }

    order.items = JSON.parse(order.items);

    res.json({
      success: true,
      order
    });
  } catch (err) {
    console.error(`[GET /api/orders/${req.params.id}] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to fetch order' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/orders/:id — Update order status (real-time)
// ─────────────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const validStatuses = ['NEW', 'PREPARING', 'READY', 'SERVED', 'PRINTED', 'COMPLETED'];

    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: `status is required and must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Verify order exists
    const existing = statements.getOrderById({ id });
    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update
    statements.updateOrderStatus({ id, status: status.toUpperCase() });

    // Return updated order
    const updated = statements.getOrderById({ id });
    if (updated) updated.items = JSON.parse(updated.items);

    // 📢 Emit Socket Event
    const io = req.app.get('io');
    if (io) {
      io.emit('order_updated', updated);
    }

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error(`[PATCH /api/orders/${req.params.id}] Error:`, err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Keep PUT for backward compatibility (it calls the same logic internally)
router.put('/:id/status', (req, res) => {
  // Transfer to PATCH logic essentially
  const id = parseInt(req.params.id);
  const { status } = req.body;
  
  statements.updateOrderStatus({ id, status: status.toUpperCase() });
  const updated = statements.getOrderById({ id });
  if (updated) updated.items = JSON.parse(updated.items);
  
  const io = req.app.get('io');
  if (io) io.emit('order_updated', updated);

  res.json({ success: true, order: updated });
});

export default router;
