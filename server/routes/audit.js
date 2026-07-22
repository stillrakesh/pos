import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// POST /api/audit
router.post('/', (req, res) => {
  try {
    const { user, action, details } = req.body;
    const db = getDb();
    
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user, action, details, created_at)
      VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `);
    stmt.run([
      user || 'System',
      action,
      JSON.stringify(details || {})
    ]);
    stmt.free();
    
    res.json({ success: true });
  } catch (err) {
    console.error("Error logging audit:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const results = [];
    const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100');
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    res.json({ success: true, logs: results });
  } catch (err) {
    console.error("Error fetching audit logs:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
