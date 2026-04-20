// ⚠️ STABLE CORE - DO NOT MODIFY WITHOUT BACKUP
import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

const VALID_STATUSES = ['VACANT', 'DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING'];

// Normalize a raw DB table row to the canonical client shape
function normalizeTableRow(t) {
  let items = [];
  try { items = JSON.parse(t.order_items || '[]'); } catch(e) { items = []; }
  const cleanItems = (Array.isArray(items) ? items : []).map(i => ({
    name: String(i.name || ''), price: Number(i.price || 0),
    quantity: Number(i.quantity || i.qty || 1), qty: Number(i.qty || i.quantity || 1)
  }));
  
  const subtotal = cleanItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const scEnabled = Boolean(t.service_charge_enabled === 1 || t.service_charge_enabled === true);
  const scRate = Number(t.service_charge_rate || 5);
  const scAmount = scEnabled ? Math.floor(subtotal * scRate / 100) : 0;
  
  const taxable = subtotal + scAmount;
  const gstEnabled = Boolean(t.gst_enabled === 1 || t.gst_enabled === true);
  const gstRate = Number(t.gst_rate || 5);
  const gstAmount = gstEnabled ? Math.floor(taxable * gstRate / 100) : 0;
  const grandTotal = Math.round(taxable + gstAmount);

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

  let createdAtTs = null;
  if (t.created_at) { const d = new Date(t.created_at); if (!isNaN(d.getTime())) createdAtTs = d.getTime(); }
  
  return {
    ...t,
    id: String(t.id),
    tableId: String(t.id),
    table_number: String(t.table_number || t.id),
    name: String(t.name || t.table_number || `Table ${t.id}`),
    status: finalStatus,
    dbStatus: rawStatus,
    items: cleanItems, orders: cleanItems, order_items: cleanItems,
    pos: { x: t.x ?? 50, y: t.y ?? 50 },
    total: grandTotal, 
    orderValue: grandTotal, 
    subtotal: subtotal,
    createdAt: createdAtTs,
    gst_enabled: gstEnabled,
    gst_rate: gstRate,
    service_charge_enabled: scEnabled,
    service_charge_rate: scRate
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/tables — Return all tables
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const tables = statements.getAllTables().map(normalizeTableRow);
    res.json(tables);
  } catch (err) {
    console.error('[GET /api/tables] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch tables' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/tables/:id — Get a single table by ID
// ─────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'Table ID must be a number' 
      });
    }

    const table = statements.getTableById({ id });
    if (!table) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: `Table #${id} not found` 
      });
    }

    res.json({ success: true, table });
  } catch (err) {
    console.error(`[GET /api/tables/${req.params.id}] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to fetch table' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/tables — Add a new table
// ─────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { tables, table_number, status } = req.body;

    // BULK SYNC LOGIC (Called by POS on every state change)
    if (tables && Array.isArray(tables)) {
      tables.forEach(t => {
        const table_num = String(t.table_number || t.name || '').replace('Table ', '');
        const stat = t.status || 'AVAILABLE';
        const items = t.order_items || '[]';
        
        // Find if table exists
        const all = statements.getAllTables();
        const existing = all.find(et => String(et.table_number) === table_num);
        
        if (existing) {
          statements.updateTable({
            id: existing.id,
            status: stat.toUpperCase(),
            order_items: items,
            x: t.x || t.pos?.x,
            y: t.y || t.pos?.y,
            shape: t.shape,
            seats: t.seats,
            zone: t.zone || t.zoneLabel,
            gst_enabled: t.gst_enabled,
            gst_rate: t.gst_rate,
            service_charge_enabled: t.service_charge_enabled,
            service_charge_rate: t.service_charge_rate
          });
        } else {
          statements.insertTable({
            table_number: table_num,
            status: stat.toUpperCase(),
            order_items: items,
            x: t.x || t.pos?.x,
            y: t.y || t.pos?.y,
            shape: t.shape,
            seats: t.seats,
            zone: t.zone || t.zoneLabel,
            gst_enabled: t.gst_enabled,
            gst_rate: t.gst_rate,
            service_charge_enabled: t.service_charge_enabled,
            service_charge_rate: t.service_charge_rate
          });
        }
      });
      const io = req.app.get('io');
      if (io) {
        const allUpdated = statements.getAllTables().map(normalizeTableRow);
        io.emit('table_updated', allUpdated);
      }
      return res.json({ success: true, message: 'Bulk sync complete' });
    }

    const t_num = String(table_number || req.body.name || '').replace('Table ', '');
    if (!t_num && t_num !== '0') {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'table_number or name is required' 
      });
    }

    const result = statements.insertTable({
      table_number: t_num,
      status: status ? status.toUpperCase() : 'AVAILABLE',
      x: req.body.x ?? req.body.pos?.x,
      y: req.body.y ?? req.body.pos?.y,
      shape: req.body.shape,
      seats: req.body.seats,
      zone: req.body.zone || req.body.zoneLabel,
      gst_enabled: req.body.gst_enabled,
      gst_rate: req.body.gst_rate,
      service_charge_enabled: req.body.service_charge_enabled,
      service_charge_rate: req.body.service_charge_rate
    });

    const allTables = statements.getAllTables().map(normalizeTableRow);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('table_updated', allTables);
    }

    res.status(201).json(allTables);

  } catch (err) {
    // Handle UNIQUE constraint violation
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ 
        error: 'DUPLICATE', 
        message: `Table number "${req.body.table_number}" already exists` 
      });
    }
    console.error('[POST /api/tables] Error:', err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to create table' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/tables/:id — Update table status or number
// ─────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const rawId = req.params.id;
    let allTables = statements.getAllTables();
    let table = allTables.find(t => {
      const matchId = String(t.id);
      const matchNum = String(t.table_number).toUpperCase();
      const search = String(rawId).toUpperCase();
      return matchId === search || matchNum === search;
    });

    if (!table) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: `Table #${rawId} not found` 
      });
    }
    const id = table.id; 
    const { table_number, status, order_items } = req.body;

    const isStarting = (['AVAILABLE', 'VACANT', 'FREE', ''].includes(String(table.status || '').toUpperCase())) && (status && !['AVAILABLE', 'VACANT', 'FREE', ''].includes(status.toUpperCase()));

    statements.updateTable({
      id,
      table_number: table_number !== undefined ? String(table_number) : undefined,
      status: status ? status.toUpperCase() : undefined,
      order_items: order_items !== undefined ? (typeof order_items === 'string' ? order_items : JSON.stringify(order_items)) : undefined,
      created_at: isStarting ? new Date().toISOString() : undefined,
      x: req.body.x ?? req.body.pos?.x,
      y: req.body.y ?? req.body.pos?.y,
      shape: req.body.shape,
      seats: req.body.seats,
      zone: req.body.zone,
      gst_enabled: req.body.gst_enabled,
      gst_rate: req.body.gst_rate,
      service_charge_enabled: req.body.service_charge_enabled,
      service_charge_rate: req.body.service_charge_rate
    });

    const updated = statements.getTableById({ id });
    const normalizedUpdated = updated ? normalizeTableRow(updated) : null;

    const io = req.app.get('io');
    if (io) {
      const allTables = statements.getAllTables().map(normalizeTableRow);
      io.emit('table_updated', allTables);

      if (normalizedUpdated) {
        let canonicalStatus = 'vacant';
        const dbStat = String(normalizedUpdated.dbStatus || '').toUpperCase();
        if (['DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING', 'OCCUPIED', 'SAVED', 'PRINTED', 'RUNNING'].includes(dbStat)) {
          if (dbStat === 'DRAFT') canonicalStatus = 'draft';
          else if (dbStat === 'KOT_PENDING') canonicalStatus = 'kot_pending';
          else if (dbStat === 'KOT_PRINTED') canonicalStatus = 'kot_printed';
          else if (dbStat === 'BILLING' || dbStat === 'PRINTED') canonicalStatus = 'billing';
          else canonicalStatus = 'kot_pending';
        }
        io.emit('order_updated', {
          id:           normalizedUpdated.id,
          table_id:     normalizedUpdated.id,
          table_number: normalizedUpdated.table_number,
          items:        normalizedUpdated.items,
          total:        normalizedUpdated.total,
          status:       canonicalStatus,
          startedAt:    new Date().toISOString()
        });
      }
    }

    allTables = statements.getAllTables().map(normalizeTableRow);
    res.json(allTables);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ 
        error: 'DUPLICATE', 
        message: `Table number "${req.body.table_number}" already exists` 
      });
    }
    console.error(`[PUT /api/tables/${req.params.id}] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to update table' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/tables/:id — Delete a table
// ─────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'Table ID must be a number' 
      });
    }

    const existing = statements.getTableById({ id });
    if (!existing) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: `Table #${id} not found` 
      });
    }

    statements.deleteTable({ id });

    const io = req.app.get('io');
    if (io) {
      const allTables = statements.getAllTables().map(normalizeTableRow);
      io.emit('table_updated', allTables);
      io.emit('order_updated', { id: String(id), table_id: String(id), items: [], total: 0, status: 'vacant' });
    }

    const allTables = statements.getAllTables().map(normalizeTableRow);
    res.json(allTables);
  } catch (err) {
    console.error(`[DELETE /api/tables/${req.params.id}] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to delete table' 
    });
  }
});

export default router;
