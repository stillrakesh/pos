import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

// Helper to get full formatted menu for broadcast
// Emits { categories: string[], items: MenuItem[] } — flat array per spec
const getFullMenu = () => {
  const items = statements.getAllMenu();
  const cleaned = items.map(item => ({ ...item, available: item.available === 1 }));
  const categories = [...new Set(cleaned.map(i => i.category).filter(Boolean))].sort();
  return { categories, items: cleaned };
};

// ─────────────────────────────────────────────────────────────
// GET /api/menu/categories — Simple string array for Captain App
// ─────────────────────────────────────────────────────────────
router.get('/categories', (req, res) => {
  try {
    const items = statements.getAllMenu();
    const cats = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
    res.json(cats.length ? cats : ['Main Course', 'Starters', 'Snacks', 'Drinks', 'Desserts']);
  } catch (err) {
    res.json(['Main Course', 'Starters', 'Snacks', 'Drinks', 'Desserts']);
  }
});

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
    let { items, name, category, price, available, inStock, type } = req.body;
    
    // Support POS frontend alias
    if (available === undefined && inStock !== undefined) {
      available = inStock;
    }

    // BULK MENU SYNC
    if (items && Array.isArray(items)) {
      items.forEach(mi => {
        const itemName = mi.name?.trim();
        const itemCat = (mi.category || mi.cat || 'Uncategorised').trim();
        const itemPrice = parseFloat(mi.price) || 0;
        
        // Find if exists by name (menu items usually unique by name/cat)
        const all = statements.getAllMenu();
        const existing = all.find(e => e.name === itemName);
        
        const itemAvailable = mi.available !== undefined ? mi.available : (mi.inStock !== undefined ? mi.inStock : true);
        
        if (existing) {
          statements.updateMenuItem({
            id: existing.id,
            category: itemCat,
            price: itemPrice,
            available: itemAvailable !== false,
            type: mi.type || 'Veg'
          });
        } else {
          statements.insertMenuItem({
            name: itemName,
            category: itemCat,
            price: itemPrice,
            available: itemAvailable !== false,
            type: mi.type || 'Veg'
          });
        }
      });
      return res.json({ success: true, message: 'Menu bulk sync complete' });
    }

    // SINGLE ITEM ADD
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
      available,
      type: type || 'Veg'
    });

    const item = statements.getMenuById({ id: result.lastInsertRowid });
    if (item) item.available = item.available === 1;

    const io = req.app.get('io');
    if (io) io.emit('menu_updated', getFullMenu());

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

    let { name, category, price, available, inStock } = req.body;
    
    // Support POS frontend alias
    if (available === undefined && inStock !== undefined) {
      available = inStock;
    }

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

    const io = req.app.get('io');
    if (io) io.emit('menu_updated', getFullMenu());

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

    const io = req.app.get('io');
    if (io) io.emit('menu_updated', getFullMenu());

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
