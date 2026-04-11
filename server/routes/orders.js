import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

// ─────────────────────────────────────────────────────────────
// POST /api/orders — Create a new order from captain app
// ─────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { table_number, items, notes } = req.body;

    // --- Validation ---
    if (!table_number && table_number !== 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'table_number is required' 
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'items must be a non-empty array' 
      });
    }

    // Validate each item has required fields
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || typeof item.name !== 'string') {
        return res.status(400).json({ 
          error: 'VALIDATION_ERROR', 
          message: `items[${i}].name is required and must be a string` 
        });
      }
      if (item.quantity == null || typeof item.quantity !== 'number' || item.quantity < 1) {
        return res.status(400).json({ 
          error: 'VALIDATION_ERROR', 
          message: `items[${i}].quantity is required and must be a positive number` 
        });
      }
      if (item.price == null || typeof item.price !== 'number' || item.price < 0) {
        return res.status(400).json({ 
          error: 'VALIDATION_ERROR', 
          message: `items[${i}].price is required and must be a non-negative number` 
        });
      }
    }

    // --- Insert ---
    const result = statements.insertOrder({
      table_number: String(table_number),
      items: JSON.stringify(items),
      notes: notes || '',
      status: 'NEW'
    });

    // Fetch the newly created order to return it
    const order = statements.getOrderById({ id: result.lastInsertRowid });
    if (order) order.items = JSON.parse(order.items);

    res.status(201).json({
      success: true,
      order
    });
  } catch (err) {
    console.error('[POST /api/orders] Error:', err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to create order' 
    });
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
      const validStatuses = ['NEW', 'PRINTED', 'COMPLETED'];
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
// PUT /api/orders/:id/status — Update order status
// ─────────────────────────────────────────────────────────────
router.put('/:id/status', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'Order ID must be a number' 
      });
    }

    const { status } = req.body;
    const validStatuses = ['NEW', 'PRINTED', 'COMPLETED'];

    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: `status is required and must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Verify order exists
    const existing = statements.getOrderById({ id });
    if (!existing) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: `Order #${id} not found` 
      });
    }

    // Update
    statements.updateOrderStatus({ id, status: status.toUpperCase() });

    // Return updated order
    const updated = statements.getOrderById({ id });
    if (updated) updated.items = JSON.parse(updated.items);

    res.json({
      success: true,
      order: updated
    });
  } catch (err) {
    console.error(`[PUT /api/orders/${req.params.id}/status] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to update order status' 
    });
  }
});

export default router;
