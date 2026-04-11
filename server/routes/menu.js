import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/menu — Return available items grouped by category
//   ?all=true → include unavailable items (for admin/POS)
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    const items = showAll ? statements.getAllMenu() : statements.getAvailableMenu();

    // Convert available int → boolean for clean mobile consumption
    const cleaned = items.map(item => ({
      ...item,
      available: item.available === 1
    }));

    // Group by category for fast mobile rendering
    const grouped = {};
    for (const item of cleaned) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    res.json({
      success: true,
      count: cleaned.length,
      categories: Object.keys(grouped),
      menu: grouped
    });
  } catch (err) {
    console.error('[GET /api/menu] Error:', err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to fetch menu' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/menu/:id — Get a single menu item
// ─────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'Menu item ID must be a number' 
      });
    }

    const item = statements.getMenuById({ id });
    if (!item) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: `Menu item #${id} not found` 
      });
    }

    item.available = item.available === 1;

    res.json({ success: true, item });
  } catch (err) {
    console.error(`[GET /api/menu/${req.params.id}] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to fetch menu item' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/menu — Add a new menu item
// ─────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { name, category, price, available } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'name is required and must be a non-empty string' 
      });
    }

    if (price == null || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'price is required and must be a non-negative number' 
      });
    }

    const result = statements.insertMenuItem({
      name: name.trim(),
      category: category ? category.trim() : 'Uncategorised',
      price,
      available
    });

    const item = statements.getMenuById({ id: result.lastInsertRowid });
    if (item) item.available = item.available === 1;

    res.status(201).json({
      success: true,
      item
    });
  } catch (err) {
    console.error('[POST /api/menu] Error:', err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to create menu item' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/menu/:id — Update a menu item
// ─────────────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'Menu item ID must be a number' 
      });
    }

    const existing = statements.getMenuById({ id });
    if (!existing) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: `Menu item #${id} not found` 
      });
    }

    const { name, category, price, available } = req.body;

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'price must be a non-negative number' 
      });
    }

    statements.updateMenuItem({
      id,
      name: name !== undefined ? String(name).trim() : undefined,
      category: category !== undefined ? String(category).trim() : undefined,
      price,
      available
    });

    const updated = statements.getMenuById({ id });
    if (updated) updated.available = updated.available === 1;

    res.json({
      success: true,
      item: updated
    });
  } catch (err) {
    console.error(`[PUT /api/menu/${req.params.id}] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to update menu item' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/menu/:id — Delete a menu item
// ─────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'Menu item ID must be a number' 
      });
    }

    const existing = statements.getMenuById({ id });
    if (!existing) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: `Menu item #${id} not found` 
      });
    }

    statements.deleteMenuItem({ id });

    res.json({
      success: true,
      message: `Menu item "${existing.name}" deleted`
    });
  } catch (err) {
    console.error(`[DELETE /api/menu/${req.params.id}] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to delete menu item' 
    });
  }
});

export default router;
