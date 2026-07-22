import express from 'express';

export default function createInventoryRouter(statements) {
  const router = express.Router();
  // GET all inventory items
  router.get('/items', (req, res) => {
    try {
      const items = statements.getAllInventoryItems();
      res.json({ success: true, items });
    } catch (err) {
      console.error('[GET /api/inventory/items] Error:', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
  });

  // POST create inventory item
  router.post('/items', (req, res) => {
    try {
      const { name, unit, current_stock, low_stock_threshold, cost_per_unit } = req.body;
      const result = statements.insertInventoryItem(name, unit, current_stock, low_stock_threshold, cost_per_unit);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      console.error('[POST /api/inventory/items] Error:', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
  });

  // PUT update inventory item
  router.put('/items/:id', (req, res) => {
    try {
      const { name, unit, current_stock, low_stock_threshold, cost_per_unit } = req.body;
      statements.updateInventoryItem(req.params.id, name, unit, current_stock, low_stock_threshold, cost_per_unit);
      res.json({ success: true });
    } catch (err) {
      console.error('[PUT /api/inventory/items/:id] Error:', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
  });

  // DELETE inventory item
  router.delete('/items/:id', (req, res) => {
    try {
      statements.deleteInventoryItem(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error('[DELETE /api/inventory/items/:id] Error:', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
  });

  // GET all recipes
  router.get('/recipes', (req, res) => {
    try {
      const recipes = statements.getAllRecipes();
      res.json({ success: true, recipes });
    } catch (err) {
      console.error('[GET /api/inventory/recipes] Error:', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
  });

  // POST upsert recipe mapping
  router.post('/recipes', (req, res) => {
    try {
      const { menu_item_id, inventory_item_id, quantity_required } = req.body;
      statements.upsertRecipe(menu_item_id, inventory_item_id, quantity_required);
      res.json({ success: true });
    } catch (err) {
      console.error('[POST /api/inventory/recipes] Error:', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
  });

  // DELETE recipe mapping
  router.delete('/recipes/:menu_item_id/:inventory_item_id', (req, res) => {
    try {
      statements.removeRecipeItem(req.params.menu_item_id, req.params.inventory_item_id);
      res.json({ success: true });
    } catch (err) {
      console.error('[DELETE /api/inventory/recipes/:ids] Error:', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
  });

  // POST stock adjustment (manual IN/OUT)
  router.post('/adjust', (req, res) => {
    try {
      const { inventory_item_id, change_type, quantity } = req.body;
      statements.logInventoryTransaction(inventory_item_id, change_type, quantity);
      res.json({ success: true });
    } catch (err) {
      console.error('[POST /api/inventory/adjust] Error:', err);
      res.status(500).json({ success: false, error: 'SERVER_ERROR' });
    }
  });

  return router;
};
