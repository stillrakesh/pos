import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/customers?phone=XYZ
// If phone is provided, searches by phone. Otherwise returns all customers.
router.get('/', (req, res) => {
  try {
    const { phone } = req.query;
    const db = getDb();
    
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

export default router;
