import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

const VALID_STATUSES = ['AVAILABLE', 'OCCUPIED'];

// ─────────────────────────────────────────────────────────────
// GET /api/tables — Return all tables
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const tables = statements.getAllTables().map(t => {
      try { t.order_items = JSON.parse(t.order_items); } catch(e) { t.order_items = []; }
      return t;
    });

    res.json({
      success: true,
      count: tables.length,
      tables
    });
  } catch (err) {
    console.error('[GET /api/tables] Error:', err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to fetch tables' 
    });
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
            zone: t.zone || t.zoneLabel
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
            zone: t.zone || t.zoneLabel
          });
        }
      });
      const io = req.app.get('io');
      if (io) io.emit('table_updated', { bulk: true }); 
      return res.json({ success: true, message: 'Bulk sync complete' });
    }

    // SINGLE TABLE ADD LOGIC
    if (!table_number && table_number !== 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'table_number is required' 
      });
    }

    if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: `status must be one of: ${VALID_STATUSES.join(', ')}` 
      });
    }

    const result = statements.insertTable({
      table_number: String(table_number),
      status: status ? status.toUpperCase() : 'AVAILABLE',
      x: req.body.x,
      y: req.body.y,
      shape: req.body.shape,
      seats: req.body.seats,
      zone: req.body.zone
    });

    const table = statements.getTableById({ id: result.lastInsertRowid });
    
    const io = req.app.get('io');
    if (io) io.emit('table_updated', table);

    res.status(201).json({
      success: true,
      table
    });
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

    const { table_number, status, order_items } = req.body;

    if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: `status must be one of: ${VALID_STATUSES.join(', ')}` 
      });
    }

    statements.updateTable({
      id,
      table_number: table_number !== undefined ? String(table_number) : undefined,
      status: status ? status.toUpperCase() : undefined,
      order_items: order_items !== undefined ? (typeof order_items === 'string' ? order_items : JSON.stringify(order_items)) : undefined,
      x: req.body.x,
      y: req.body.y,
      shape: req.body.shape,
      seats: req.body.seats,
      zone: req.body.zone
    });

    const updated = statements.getTableById({ id });
    if (updated && updated.order_items) {
      try { updated.order_items = JSON.parse(updated.order_items); } catch(e) { updated.order_items = []; }
    }

    // 📢 Emit Real-time Update
    const io = req.app.get('io');
    if (io) io.emit('table_updated', updated);

    res.json({
      success: true,
      table: updated
    });
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
    if (io) io.emit('table_updated', { id, deleted: true });

    res.json({
      success: true,
      message: `Table #${id} (${existing.table_number}) deleted`
    });
  } catch (err) {
    console.error(`[DELETE /api/tables/${req.params.id}] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to delete table' 
    });
  }
});

export default router;
