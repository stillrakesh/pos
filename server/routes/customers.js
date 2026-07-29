import { Router } from 'express';
import { getDb, statements } from '../db.js';

const router = Router();

// GET /api/customers?phone=XYZ
// If phone is provided, searches by phone. Otherwise returns all customers.
router.get('/', (req, res) => {
  try {
    const { phone } = req.query;
    const db = getDb();

    // Reconcile customer visits/total_spent with actual completed orders in DB
    try {
      statements.reconcileCustomerStats();
    } catch (recErr) {
      console.warn('Customer reconciliation warning:', recErr.message);
    }
    
    if (phone) {
      const stmt = db.prepare('SELECT * FROM customers WHERE phone = ?');
      stmt.bind([phone]);
      if (stmt.step()) {
        const customer = stmt.getAsObject();
        stmt.free();
        res.json({ success: true, customer });
      } else {
        stmt.free();
        res.json({ success: false, message: 'Customer not found' });
      }
    } else {
      const results = [];
      const stmt = db.prepare('SELECT * FROM customers ORDER BY total_spent DESC');
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      res.json({ success: true, customers: results });
    }
  } catch (err) {
    console.error("Error fetching customers:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:phone/history - Fetch customer order history
router.get('/:phone/history', (req, res) => {
  try {
    const { phone } = req.params;
    const db = getDb();
    
    // Fetch Customer Profile
    const custStmt = db.prepare('SELECT * FROM customers WHERE phone = ?');
    custStmt.bind([phone]);
    let customer = null;
    if (custStmt.step()) {
      customer = custStmt.getAsObject();
    }
    custStmt.free();

    // Fetch Orders for this phone number
    const orderStmt = db.prepare(`SELECT * FROM orders WHERE phone = ? OR customer_name = ? ORDER BY id DESC`);
    orderStmt.bind([phone, customer?.name || '']);
    const orders = [];
    while (orderStmt.step()) {
      const obj = orderStmt.getAsObject();
      let items = [];
      try { items = JSON.parse(obj.items || '[]'); } catch(e){}
      orders.push({ ...obj, items });
    }
    orderStmt.free();

    res.json({ success: true, customer, orders });
  } catch (err) {
    console.error("Error fetching customer history:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers - Create or update customer
router.post('/', (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number required' });
    }
    
    const db = getDb();
    const cleanPhone = String(phone).trim();
    const cleanName = String(name || 'Guest').trim();
    
    const existing = db.prepare('SELECT * FROM customers WHERE phone = ?');
    existing.bind([cleanPhone]);
    const exists = existing.step();
    existing.free();
    
    if (exists) {
      db.run('UPDATE customers SET name = ? WHERE phone = ?', [cleanName, cleanPhone]);
    } else {
      db.run(
        `INSERT INTO customers (name, phone, visits, total_spent, loyalty_points, last_visit) VALUES (?, ?, 0, 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        [cleanName, cleanPhone]
      );
    }
    
    res.json({ success: true, message: 'Customer saved successfully' });
  } catch (err) {
    console.error("Error saving customer:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
