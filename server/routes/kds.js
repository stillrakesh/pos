import express from 'express';
import { statements } from '../db.js';
import { syncKdsTicket } from './orders.js';

const router = express.Router();

// GET /api/kds - Active tickets only
router.get('/', (req, res) => {
  try {
    const tickets = statements.getKotTickets();
    res.json(tickets);
  } catch (err) {
    console.error('Error fetching KDS tickets:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kds/all - All tickets today (for history)
router.get('/all', (req, res) => {
  try {
    const tickets = statements.getAllKotTickets();
    res.json(tickets);
  } catch (err) {
    console.error('Error fetching all KDS tickets:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kds/stats - Dashboard stats
router.get('/stats', (req, res) => {
  try {
    const stats = statements.getKotStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching KDS stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/kds
router.post('/', (req, res) => {
  try {
    const { table_number, items, status } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }

    const { id } = statements.insertKotTicket(table_number, items, status);
    
    const io = req.app.get('io');
    if (io) io.emit('kds_updated');

    res.json({ success: true, id });
  } catch (err) {
    console.error('Error creating KDS ticket:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper to normalize table names (e.g. 'Table A1' -> 'A1', 'a1' -> 'A1')
function normalizeTableNumber(num) {
  if (!num) return '';
  let s = String(num).trim().toUpperCase();
  if (s.startsWith('TABLE ')) {
    s = s.substring(6).trim();
  }
  return s;
}

// PUT /api/kds/sync/:table_number
router.put('/sync/:table_number', (req, res) => {
  try {
    const rawTableNumber = req.params.table_number;
    const { items } = req.body;
    const io = req.app.get('io');
    
    syncKdsTicket(rawTableNumber, items, io);
    res.json({ success: true, message: 'KDS synced successfully' });
  } catch (err) {
    console.error('Error syncing KDS ticket:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/kds/:id
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    statements.updateKotTicketStatus(id, status);
    
    const io = req.app.get('io');
    if (io) io.emit('kds_updated');

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating KDS ticket:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/kds/:id/item - Update individual item status within a ticket
router.patch('/:id/item', (req, res) => {
  try {
    const { id } = req.params;
    const { itemIndex, status } = req.body;

    // Fetch current ticket
    const allTickets = statements.getKotTickets();
    const ticket = allTickets.find(t => String(t.id) === String(id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const items = ticket.items || [];
    if (itemIndex < 0 || itemIndex >= items.length) return res.status(400).json({ error: 'Invalid item index' });

    // Update the specific item's status
    items[itemIndex] = { ...items[itemIndex], itemStatus: status };

    // Derive overall ticket status from items
    const allStatuses = items.map(i => i.itemStatus || 'NEW');
    let derivedStatus = 'NEW';
    if (allStatuses.every(s => s === 'SERVED')) {
      derivedStatus = 'SERVED';
    } else if (allStatuses.every(s => s === 'READY' || s === 'SERVED')) {
      derivedStatus = 'READY';
    } else if (allStatuses.some(s => s === 'PREPARING' || s === 'READY' || s === 'SERVED')) {
      derivedStatus = 'PREPARING';
    }

    statements.updateKotTicketItems(id, items, derivedStatus);

    const io = req.app.get('io');
    if (io) io.emit('kds_updated');

    res.json({ success: true, derivedStatus });
  } catch (err) {
    console.error('Error updating KDS item:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
