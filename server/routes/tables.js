import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

const VALID_STATUSES = ['AVAILABLE', 'OCCUPIED'];

// ─────────────────────────────────────────────────────────────
// GET /api/tables — Return all tables
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const tables = statements.getAllTables();

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
    const { table_number, status } = req.body;

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
      status: status ? status.toUpperCase() : 'AVAILABLE'
    });

    const table = statements.getTableById({ id: result.lastInsertRowid });

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

    const { table_number, status } = req.body;

    if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: `status must be one of: ${VALID_STATUSES.join(', ')}` 
      });
    }

    statements.updateTable({
      id,
      table_number: table_number !== undefined ? String(table_number) : undefined,
      status: status ? status.toUpperCase() : undefined
    });

    const updated = statements.getTableById({ id });

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
