import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/auth/status — Check if security is enabled
// ─────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  try {
    const config = statements.getConfig({ key: 'pos_settings' }) || {};
    res.json({ 
      success: true, 
      enabled: config.captainSecurityEnabled === true,
      pinLength: config.captainSecurityPin ? String(config.captainSecurityPin).length : 4
    });
  } catch (err) {
    console.error('[GET /api/auth/status]', err);
    res.status(500).json({ error: 'Failed to check security status' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/pro-status — Check if Captain Pro is enabled
// ─────────────────────────────────────────────────────────────
router.get('/pro-status', (req, res) => {
  try {
    const config = statements.getConfig({ key: 'pos_settings' }) || {};
    res.json({ 
      success: true, 
      enabled: config.captainProEnabled === true,
      pinLength: config.captainProPin ? String(config.captainProPin).length : 4
    });
  } catch (err) {
    console.error('[GET /api/auth/pro-status]', err);
    res.status(500).json({ error: 'Failed to check pro status' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify — Verify PIN
// ─────────────────────────────────────────────────────────────
router.post('/verify', (req, res) => {
  try {
    const { pin } = req.body;
    const config = statements.getConfig({ key: 'pos_settings' }) || {};

    if (!config.captainSecurityEnabled) {
      return res.json({ success: true, message: 'Captain security not enabled' });
    }

    if (config.captainSecurityPin && String(pin) === String(config.captainSecurityPin)) {
      res.json({ success: true, message: 'Authentication successful' });
    } else {
      res.status(401).json({ success: false, error: 'Invalid PIN' });
    }
  } catch (err) {
    console.error('[POST /api/auth/verify]', err);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-pro — Verify Pro PIN
// ─────────────────────────────────────────────────────────────
router.post('/verify-pro', (req, res) => {
  try {
    const { pin } = req.body;
    const config = statements.getConfig({ key: 'pos_settings' }) || {};

    if (!config.captainProEnabled) {
      return res.status(403).json({ success: false, error: 'Captain Pro not enabled' });
    }

    if (config.captainProPin && String(pin) === String(config.captainProPin)) {
      res.json({ success: true, message: 'Pro authentication successful' });
    } else {
      res.status(401).json({ success: false, error: 'Invalid Pro PIN' });
    }
  } catch (err) {
    console.error('[POST /api/auth/verify-pro]', err);
    res.status(500).json({ error: 'Failed to verify Pro PIN' });
  }
});

export default router;
