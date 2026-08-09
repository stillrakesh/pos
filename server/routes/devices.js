import { Router } from 'express';
import { statements } from '../db.js';

const router = Router();

// GET /api/devices — List all devices (Called by POS Settings)
router.get('/', (req, res) => {
  try {
    const getDevices = req.app.get('getDevicesWithOnlineStatus');
    const devices = getDevices ? getDevices() : statements.getAllDevices();
    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/devices/activity/recent — Get recent activity across all devices
router.get('/activity/recent', (req, res) => {
  try {
    const activity = statements.getRecentActivity();
    res.json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/devices/:id/activity — Get activity for a specific device
router.get('/:id/activity', (req, res) => {
  try {
    const activity = statements.getDeviceActivity({ device_id: req.params.id });
    res.json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/devices/register — Request connection (Called by Captain App on Startup)
router.post('/register', (req, res) => {
  try {
    const { id, name, device_type, ip_address, os_info } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'ID and Name required' });
    
    const canonicalId = statements.registerDevice({ 
      id, 
      name, 
      device_type, 
      ip_address: ip_address || req.ip || '', 
      os_info 
    });
    const device = statements.getDeviceById({ id: canonicalId || id });
    
    res.json({ success: true, status: device?.status || 'APPROVED', id: canonicalId || id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/devices/:id/rename — Rename a device
router.patch('/:id/rename', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    
    statements.renameDevice({ id: req.params.id, name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/devices/:id — Approve/Block (Called by POS Settings)
router.patch('/:id', (req, res) => {
  try {
    const { status } = req.body; // 'APPROVED' or 'BLOCKED'
    const deviceId = req.params.id;
    
    statements.updateDeviceStatus({ id: deviceId, status });
    statements.logDeviceActivity({ device_id: deviceId, action: status, details: `Status updated to ${status}` });
    
    const io = req.app.get('io');
    const onlineDevices = req.app.get('onlineDevices');
    const getDevicesWithOnlineStatus = req.app.get('getDevicesWithOnlineStatus');

    if (io) {
      // Broadcast real-time status update to target device
      io.emit('device_status_changed', { deviceId, status });

      // If blocked, disconnect target device socket if online
      if (status === 'BLOCKED' && onlineDevices && onlineDevices.has(deviceId)) {
        const deviceConn = onlineDevices.get(deviceId);
        if (deviceConn && deviceConn.socketId) {
          const socket = io.sockets.sockets.get(deviceConn.socketId);
          if (socket) {
            socket.emit('device_status', { status: 'BLOCKED', message: 'This device has been blocked by the administrator.' });
            socket.disconnect(true);
          }
        }
      }

      // Broadcast updated device list to POS UI
      if (getDevicesWithOnlineStatus) {
        io.emit('device_list_updated', getDevicesWithOnlineStatus());
      }
    }
    
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
