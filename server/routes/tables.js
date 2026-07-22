import { Router } from 'express';
import { statements } from '../db.js';
import { clearShiftForTable } from '../shifts.js';
import { normalizeTable } from '../utils/normalization.js';
import { syncKdsTicket } from './orders.js';

const router = Router();

const VALID_STATUSES = ['VACANT', 'DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING'];


// ─────────────────────────────────────────────────────────────
// GET /api/tables — Return all tables
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const tables = statements.getAllTables().map(normalizeTable);
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
            service_charge_rate: t.service_charge_rate,
            scale: t.scale
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
            service_charge_rate: t.service_charge_rate,
            scale: t.scale
          });
        }
      });
      const io = req.app.get('io');
      if (io) {
        const allUpdated = statements.getAllTables().map(normalizeTable);
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
      zone: req.body.zone || req.body.zoneLabel || req.body.type,
      gst_enabled: req.body.gst_enabled,
      gst_rate: req.body.gst_rate,
      service_charge_enabled: req.body.service_charge_enabled,
      service_charge_rate: req.body.service_charge_rate,
      scale: req.body.scale || 1.0
    });

    const allTables = statements.getAllTables().map(normalizeTable);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('table_updated', allTables);
    }

    res.status(201).json({ success: true, data: allTables });

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
router.put('/:id', handleTableUpdate);
router.patch('/:id', handleTableUpdate);

function handleTableUpdate(req, res) {
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

    const occupiedStatuses = ['DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING', 'OCCUPIED', 'RUNNING', 'SAVED', 'PRINTED', 'PREPARING', 'READY', 'SERVED'];
    const currentStatus = String(table.status || '').toUpperCase();
    const nextStatus = status ? status.toUpperCase() : currentStatus;

    const isAlreadyOccupied = occupiedStatuses.includes(currentStatus);
    const willBeOccupied = occupiedStatuses.includes(nextStatus);

    let createdAt = table.created_at;
    if (!isAlreadyOccupied && willBeOccupied) {
      createdAt = new Date().toISOString();
    } else if (!willBeOccupied) {
      createdAt = null;
    }

    statements.updateTable({
      id,
      table_number: table_number !== undefined ? String(table_number) : undefined,
      status: status ? status.toUpperCase() : undefined,
      order_items: order_items !== undefined ? (typeof order_items === 'string' ? order_items : JSON.stringify(order_items)) : undefined,
      created_at: createdAt,
      x: req.body.x ?? req.body.pos?.x,
      y: req.body.y ?? req.body.pos?.y,
      shape: req.body.shape,
      seats: req.body.seats,
      zone: req.body.zone || req.body.type,
      covers: req.body.covers,
      gst_enabled: req.body.gst_enabled,
      gst_rate: req.body.gst_rate,
      service_charge_enabled: req.body.service_charge_enabled,
      service_charge_rate: req.body.service_charge_rate,
      scale: req.body.scale
    });

    if (status && (status.toUpperCase() === 'AVAILABLE' || status.toUpperCase() === 'VACANT')) {
      clearShiftForTable(table.table_number);
      statements.clearTableKotTickets(table.table_number);
      const io = req.app.get('io');
      if (io) io.emit('kds_updated');
    } else if (order_items !== undefined) {
      try {
        const itemsArr = typeof order_items === 'string' ? JSON.parse(order_items || '[]') : order_items;
        const io = req.app.get('io');
        syncKdsTicket(table.table_number, itemsArr, io);
      } catch (e) {}
    }

    const updated = statements.getTableById({ id });
    const normalizedUpdated = updated ? normalizeTable(updated) : null;

    const io = req.app.get('io');
    if (io) {
      const allTables = statements.getAllTables().map(normalizeTable);
      io.emit('table_updated', allTables);

      if (normalizedUpdated) {
        io.emit('order_updated', normalizedUpdated);
      }
    }

    const allTablesFinal = statements.getAllTables().map(normalizeTable);
    res.json(allTablesFinal);
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
}

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
      const allTables = statements.getAllTables().map(normalizeTable);
      io.emit('table_updated', allTables);
      io.emit('order_updated', { id: String(id), table_id: String(id), items: [], total: 0, status: 'vacant' });
    }

    const allTables = statements.getAllTables().map(normalizeTable);
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
