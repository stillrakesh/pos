import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

// GET /api/devices — List all devices (Called by POS Settings)
router.get('/', (req, res) => {
  try {
    const devices = statements.getAllDevices();
    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/devices/register — Request connection (Called by Captain App on Startup)
router.post('/register', (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'ID and Name required' });
    
    statements.registerDevice({ id, name });
    const device = statements.getDeviceById({ id });
    
    res.json({ success: true, status: device.status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/devices/:id — Approve/Block (Called by POS Settings)
router.patch('/:id', (req, res) => {
  try {
    const { status } = req.body; // 'APPROVED' or 'BLOCKED'
    statements.updateDeviceStatus({ id: req.params.id, status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/devices/:id — Remove device
router.delete('/:id', (req, res) => {
  try {
    statements.deleteDevice({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
