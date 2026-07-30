// ⚠️ STABLE CORE - DO NOT MODIFY WITHOUT BACKUP
/**
 * TYDE POS — Single Backend Server
 * ──────────────────────────────────
 * Single source of truth for POS and Captain App.
 * Real-time sync via Socket.IO.
 * LAN-accessible on all network interfaces.
 */

import express from 'express';
import cors from 'cors';
import os from 'os';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import { initDatabase, forceSave } from './db.js';
import { statements } from './db.js';
import { loadSigningFiles } from './qzSigning.js';
import { startSyncWorker } from './syncWorker.js';
import { normalizeTable } from './utils/normalization.js';

// Route modules
import ordersRouter, { syncKdsTicket }   from './routes/orders.js';
import tablesRouter   from './routes/tables.js';
import menuRouter     from './routes/menu.js';
import billingRouter  from './routes/billing.js';
import devicesRouter  from './routes/devices.js';
import signingRouter  from './routes/signing.js';
import analyticsRouter from './routes/analytics.js';
import authRouter     from './routes/auth.js';
import customersRouter from './routes/customers.js';
import auditRouter    from './routes/audit.js';
import inventoryRouter from './routes/inventory.js';
import kdsRouter      from './routes/kds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────
// App + HTTP + Socket.IO
// ─────────────────────────────────────────────────────────────
import { logShift, clearShiftForTable, setIo, getActiveShifts } from './shifts.js';
const app        = express();
const httpServer = createServer(app);
const PORT       = process.env.PORT || 3101;

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

setIo(io);
app.set('io', io);

// In-memory cache of the latest pickup orders so new connections get current state
let cachedPickupOrders = [];

io.on('connection', (socket) => {
  console.log('DEVICE CONNECTED:', socket.id);
  
  // Broadcast updated active connected sockets count
  try {
    io.emit('device_count_updated', { count: io.sockets.sockets.size });
  } catch (e) {}

  socket.on('disconnect', () => {
    console.log('DEVICE DISCONNECTED:', socket.id);
    try {
      io.emit('device_count_updated', { count: io.sockets.sockets.size });
    } catch (e) {}
  });

  if (socket.recovered) {
    console.log('DEVICE RECOVERED (skipping initial payload):', socket.id);
  } else {
    try {
      const tables = statements.getAllTables().map(normalizeTable);
      socket.emit('table_updated', tables);

      // Send current menu on connect so Captain always has fresh data
      const menuItems = statements.getAllMenu().map(i => ({ ...i, available: i.available === 1 }));
      const categories = [...new Set(menuItems.map(i => i.category).filter(Boolean))].sort();
      socket.emit('menu_updated', { categories, items: menuItems });
      socket.emit('shift_history_updated', getActiveShifts());

      // ✅ Replay cached pickup orders immediately to the new connection
      if (cachedPickupOrders.length > 0) {
        socket.emit('pickup_orders_updated', cachedPickupOrders);
      }
    } catch (err) {
      console.warn('Could not send initial state:', err.message);
    }
  }

  socket.on('captain_new_pickup_order', (payload) => {
    try {
      io.emit('captain_new_pickup_order', payload);
    } catch (err) {
      console.warn('Error in captain_new_pickup_order:', err.message);
    }
  });

  socket.on('sync_pickup_orders', (payload) => {
    try {
      // Update cache and broadcast to all clients
      cachedPickupOrders = payload || [];
      io.emit('pickup_orders_updated', cachedPickupOrders);
    } catch (err) {
      console.warn('Error in sync_pickup_orders:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('DEVICE DISCONNECTED:', socket.id);
  });
});

// ─────────────────────────────────────────────────────────────
// Middleware & CORS (with Chrome Private Network Access support)
// ─────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use((req, res, next) => {
  // Fix for Chrome Mobile "Private Network Access" policy
  if (req.headers['access-control-request-private-network']) {
    res.header('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

// ── Robust Slash Normalization Middleware ──
app.use((req, res, next) => {
  if (req.url.includes('//')) {
    req.url = req.url.replace(/\/+/g, '/');
  }
  next();
});

app.use(express.json({ limit: '2mb' }));


// ─────────────────────────────────────────────────────────────
// Request logger
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log(`\x1b[35m  📦 [${req.method}] ${req.originalUrl} Body:\x1b[0m`, JSON.stringify(req.body, null, 2));
  }
  const start = Date.now();
  res.on('finish', () => {
    const ms    = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    const ip    = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`  ${color}${req.method}\x1b[0m ${req.originalUrl} [${ip}] → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ─────────────────────────────────────────────────────────────
// Standard REST API Routes
// ─────────────────────────────────────────────────────────────
app.get('/api/lan', (req, res) => {
  const ip = getLocalIP();
  res.json({ ip, url: `http://${ip}:${PORT}/captain/` });
});

app.get('/api/config/:key', (req, res) => {
  try {
    const value = statements.getConfig({ key: req.params.key });
    res.json(value);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/:key', (req, res) => {
  try {
    statements.setConfig({ key: req.params.key, value: req.body });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('config_updated', { key: req.params.key, value: req.body });
      if (req.params.key === 'pos_settings') {
        io.emit('kds_updated');
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/orders', ordersRouter);
app.use('/orders', ordersRouter);

app.use('/api/tables', tablesRouter);
app.use('/tables', tablesRouter);

app.use('/api/menu', menuRouter);
app.use('/menu', menuRouter);

app.use('/api/billing', billingRouter);
app.use('/billing', billingRouter);

app.use('/api/devices', devicesRouter);
app.use('/devices', devicesRouter);

app.use('/api/signing', signingRouter);
app.use('/signing', signingRouter);

app.use('/api/analytics', analyticsRouter);
app.use('/analytics', analyticsRouter);
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/customers', customersRouter);
app.use('/api/audit', auditRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/kds', kdsRouter);
app.use('/audit', auditRouter);
app.use('/auth', authRouter);

app.use('/api/inventory', inventoryRouter(statements));
app.use('/inventory', inventoryRouter(statements));

// ─────────────────────────────────────────────────────────────
// Printers API — expose network printers from db for frontend
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'fs';

const getDbJson = () => {
  const dbPath = process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'db.json')
    : path.join(__dirname, '..', 'data', 'db.json');
  try { return JSON.parse(readFileSync(dbPath, 'utf-8')); } catch { return {}; }
};
const saveDbJson = (data) => {
  const dbPath = process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'db.json')
    : path.join(__dirname, '..', 'data', 'db.json');
  writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
};

app.get('/api/printers', (req, res) => {
  const db = getDbJson();
  res.json(db.printers || []);
});

app.post('/api/printers', (req, res) => {
  const db = getDbJson();
  const printer = { id: `printer_${Date.now()}`, ...req.body };
  db.printers = [...(db.printers || []), printer];
  saveDbJson(db);
  res.json(printer);
});

app.put('/api/printers/:id', (req, res) => {
  const db = getDbJson();
  db.printers = (db.printers || []).map(p => p.id === req.params.id ? { ...p, ...req.body } : p);
  saveDbJson(db);
  res.json({ success: true });
});

app.delete('/api/printers/:id', (req, res) => {
  const db = getDbJson();
  db.printers = (db.printers || []).filter(p => p.id !== req.params.id);
  saveDbJson(db);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// Compatibility Redirects
// ─────────────────────────────────────────────────────────────
app.get(['/categories', '/api/categories'], (req, res) => res.redirect('/api/menu/categories'));


// ─────────────────────────────────────────────────────────────
// Compatibility Routes (no /api prefix — for Captain App)
// The Captain App expects flat arrays, not { success: true, data: [] }
// ─────────────────────────────────────────────────────────────


// Compatibility PUT/PATCH
app.route('/tables/:id')
  .put(handleTableUpdate)
  .patch(handleTableUpdate);

async function handleTableUpdate(req, res) {
  try {
    const { id } = req.params;
    const { status, items, orders, pos, x, y, shape, seats, zone, zoneLabel, table_number, name } = req.body;
    
    const allTables = statements.getAllTables();
    let targetTable = allTables.find(t => String(t.id) === String(id));
    if (!targetTable) {
      targetTable = allTables.find(t => String(t.table_number).toUpperCase() === String(id).toUpperCase());
    }

    if (!targetTable) {
      console.warn(`  ⚠️  Table Not Found for update: ${id}`);
      return res.status(404).json({ error: 'Table not found' });
    }

    const tableId = targetTable.id;
    
    // Handle items normalization (ensure both qty/quantity exist for cross-app support)
    let orderItems = items || orders;
    if (orderItems && Array.isArray(orderItems)) {
      orderItems = orderItems.map(i => ({
        ...i,
        quantity: i.quantity || i.qty || 1,
        qty:      i.qty || i.quantity || 1
      }));
    }

    const occupiedStatuses = ['DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING', 'OCCUPIED', 'RUNNING', 'SAVED', 'PRINTED'];
    const currentStatus = String(targetTable.status || '').toUpperCase();
    const nextStatus = status ? status.toUpperCase() : currentStatus;

    const isAlreadyOccupied = occupiedStatuses.includes(currentStatus);
    const willBeOccupied = occupiedStatuses.includes(nextStatus);

    let createdAt = targetTable.created_at;
    if (!isAlreadyOccupied && willBeOccupied) {
      createdAt = new Date().toISOString();
    } else if (!willBeOccupied) {
      createdAt = null;
    }

    statements.updateTable({
      id:           tableId,
      table_number: table_number !== undefined ? String(table_number) : (name !== undefined ? String(name) : undefined),
      status:       status ? status.toUpperCase() : undefined,
      order_items:  orderItems ? JSON.stringify(orderItems) : undefined,
      x:            pos?.x ?? x,
      y:            pos?.y ?? y,
      shape:        shape,
      seats:        seats,
      zone:         zone || zoneLabel,
      created_at:   createdAt
    });

    const updated = statements.getTableById({ id: tableId });
    if (updated) {
      const fullTable = normalizeTable(updated);
      const io = req.app.get('io');
      if (io) {
        io.emit("table_updated", statements.getAllTables().map(normalizeTable));
        io.emit("order_updated", fullTable);
      }
    }

    res.json({ success: true, table: normalizeTable(updated) });
  } catch (err) {
    console.error('  ❌ Table update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/categories — Structured for POS
app.get('/api/categories', (req, res) => {
  try {
    const items = statements.getAllMenu();
    const cats  = [...new Set(items.map(i => i.category).filter(Boolean))].sort();
    res.json({ success: true, categories: cats });
  } catch (err) {
    res.json({ success: true, categories: [] });
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

// Helper to sync KDS tickets on order/KOT updates
// Using imported syncKdsTicket from ./routes/orders.js

// ─────────────────────────────────────────────────────────────
// Legacy /order endpoint (old Captain App payload format)
// Transforms { tableId, items: [{name, qty, price}] }
// → new format { table_number, items: [{name, quantity, price}] }
// ─────────────────────────────────────────────────────────────
app.post('/order', (req, res) => {
  try {
    const { tableId, items, notes, printKOT } = req.body;

    if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'tableId and items required' });
    }

    // Resolve table_number from tableId (could be id or table_number)
    const allTables = statements.getAllTables();
    let targetTable = allTables.find(t => String(t.id) === String(tableId));
    if (!targetTable) {
      targetTable = allTables.find(t => String(t.table_number) === String(tableId));
    }

    const table_number = targetTable ? targetTable.table_number : String(tableId);

    // Normalize items: captain uses qty, new backend uses quantity
    const normalizedItems = items.map(item => ({
      name:     item.name,
      quantity: Number(item.qty || item.quantity || 1),
      price:    Number(item.price || 0)
    }));

    // Insert the order
    const result = statements.insertOrder({
      table_number,
      items:  JSON.stringify(normalizedItems),
      notes:  notes || '',
      status: 'NEW'
    });

    const order = statements.getOrderById({ id: result.lastInsertRowid });
    if (order) {
      try { order.items = JSON.parse(order.items); } catch (e) { order.items = normalizedItems; }
    }

    // Update table status to OCCUPIED
    if (targetTable) {
      const existing_items_raw = (() => {
        try { 
          const parsed = JSON.parse(targetTable.order_items || '[]'); 
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
      })();
      
      // Merge items by name so we don't get duplicate rows in the POS cart
      const merged_items = [...existing_items_raw];
      normalizedItems.forEach(newItem => {
        const existing = merged_items.find(i => String(i.name || '').toLowerCase() === String(newItem.name || '').toLowerCase());
        if (existing) {
          existing.quantity = (existing.quantity || existing.qty || 1) + newItem.quantity;
          existing.qty = existing.quantity;
        } else {
          merged_items.push(newItem);
        }
      });

      const occupiedStatuses = ['DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING', 'OCCUPIED', 'RUNNING', 'SAVED', 'PRINTED'];
      const currentStatus = String(targetTable.status || '').toUpperCase();
      const isAlreadyOccupied = occupiedStatuses.includes(currentStatus);
      const createdAt = isAlreadyOccupied ? (targetTable.created_at || new Date().toISOString()) : new Date().toISOString();

      statements.updateTable({
        id:          targetTable.id,
        status:      'OCCUPIED',
        order_items: JSON.stringify(merged_items),
        created_at:  createdAt
      });

      const io = req.app.get('io');
      // Broadcast to POS for auto-print and UI update
      if (io) {
        const fullTable = normalizeTable(statements.getTableById({ id: targetTable.id }));
        io.emit("order_updated", {
          ...fullTable,
          is_new_kot: printKOT !== false,
          new_items: normalizedItems,
          notes: notes || '' // Pass global notes for printing
        });
        
        // Also broadcast full table list
        const allTables = statements.getAllTables().map(normalizeTable);
        io.emit("table_updated", allTables);

        // Fetch categories to enrich KOT items for KDS stations filtering
        const allMenu = statements.getAllMenu();
        const enrichedNewItems = normalizedItems.map(i => {
          const dbItem = allMenu.find(m => String(m.name).toLowerCase().trim() === String(i.name).toLowerCase().trim());
          return {
            ...i,
            category: dbItem ? dbItem.category : 'General'
          };
        });

        // Always create a BRAND NEW ticket for a new KOT submission
        syncKdsTicket(table_number, enrichedNewItems, io, true);
      }
    }

    // Enqueue for cloud sync
    try {
      statements.enqueueSyncItem({ type: 'order_created', payload: order });
    } catch (e) {}

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('[POST /order] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create order' });
  }
});

// ─────────────────────────────────────────────────────────────
// Legacy /settle-bill (called by POS billing flow)
// ─────────────────────────────────────────────────────────────
app.post('/settle-bill', (req, res) => {
  try {
    const { tableId, paymentMode, orderDetails } = req.body;
    if (!tableId) return res.status(400).json({ error: 'tableId required' });

    const allTables = statements.getAllTables();
    let table = allTables.find(t => String(t.id) === String(tableId));
    if (!table) table = allTables.find(t => String(t.table_number) === String(tableId));
    if (!table) return res.status(404).json({ error: 'Table not found' });

    // Mark orders as completed
    const activeOrders = statements.getOrdersByTable({ table_number: table.table_number });
    activeOrders.forEach(o => statements.updateOrderStatus({ id: o.id, status: 'COMPLETED' }));

    // Remove from shift history
    clearShiftForTable(table.table_number);


    // Clear table
    statements.updateTable({ id: table.id, status: 'AVAILABLE', order_items: '[]' });

    const updated = statements.getTableById({ id: table.id });
    if (updated) {
      try { updated.order_items = JSON.parse(updated.order_items); } catch (e) { updated.order_items = []; }
    }

    // Enqueue for cloud sync
    try {
      statements.enqueueSyncItem({
        type: 'payment_done',
        payload: { tableId, paymentMode, orderDetails, settled_at: new Date().toISOString() }
      });
    } catch (e) {}

    broadcastOrderUpdate(table.id);

    res.json({ success: true, message: 'Bill settled', table: normalizeTable(updated) });
  } catch (err) {
    console.error('[POST /settle-bill] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to settle bill' });
  }
});

// ─────────────────────────────────────────────────────────────
// Legacy /table/:id/clear (called by Captain App)
// ─────────────────────────────────────────────────────────────
app.post('/table/:id/clear', (req, res) => {
  console.log(`[POST /table/${req.params.id}/clear] Request received`);
  try {
    const rawId = req.params.id;
    const allTables = statements.getAllTables();
    let table = allTables.find(t => {
      const matchId = String(t.id);
      const matchNum = String(t.table_number).toUpperCase();
      const search = String(rawId).toUpperCase();
      return matchId === search || matchNum === search;
    });

    if (!table) return res.status(404).json({ error: 'Table not found' });

    const activeOrders = statements.getOrdersByTable({ table_number: table.table_number });
    activeOrders.forEach(o => statements.updateOrderStatus({ id: o.id, status: 'CANCELED' }));

    // Remove from shift history
    clearShiftForTable(table.table_number);
    statements.clearTableKotTickets(table.table_number);

    io.emit('kds_updated');

    statements.updateTable({ id: table.id, status: 'AVAILABLE', order_items: '[]', created_at: null, bill_number: null, customer_name: '', phone: '' });

    const updated = statements.getTableById({ id: table.id });
    if (updated) {
      try { updated.order_items = JSON.parse(updated.order_items); } catch (e) { updated.order_items = []; }
    }

    broadcastOrderUpdate(table.id);
    res.json({ success: true });
  } catch (err) {
    console.error(`[POST /table/${req.params.id}/clear] Error:`, err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to clear table' });
  }
});

app.post('/table/shift', (req, res) => {
  const { fromId, toId } = req.body;
  console.log(`[POST /table/shift] From: ${fromId} To: ${toId}`);
  try {
    const allTables = statements.getAllTables();
    const fromTable = allTables.find(t => String(t.id) === String(fromId) || String(t.table_number).toUpperCase() === String(fromId).toUpperCase());
    const toTable = allTables.find(t => String(t.id) === String(toId) || String(t.table_number).toUpperCase() === String(toId).toUpperCase());

    if (!fromTable) return res.status(404).json({ error: 'Source table not found' });
    if (!toTable) return res.status(404).json({ error: 'Target table not found' });

    if (toTable.status !== 'AVAILABLE' && toTable.status !== 'VACANT') {
      return res.status(400).json({ error: 'Target table is not available' });
    }

    // 1. Move orders in DB if any
    const activeOrders = statements.getOrdersByTable({ table_number: fromTable.table_number });
    activeOrders.forEach(o => {
      // update order's table number
      statements.updateOrderTable({ id: o.id, table_number: toTable.table_number });
    });

    // 2. Move table state
    statements.updateTable({
      id: toTable.id,
      status: fromTable.status,
      order_items: fromTable.order_items,
      created_at: fromTable.created_at,
      bill_number: fromTable.bill_number
    });

    // 3. Clear source table
    statements.updateTable({
      id: fromTable.id,
      status: 'AVAILABLE',
      order_items: '[]',
      created_at: '',
      bill_number: null
    });

    // 4. Log shift history
    logShift(fromTable.table_number, toTable.table_number);
    clearShiftForTable(fromTable.table_number); // The from table is now vacant, so old shifts to it are irrelevant

    broadcastOrderUpdate(fromTable.id);
    broadcastOrderUpdate(toTable.id);

    res.json({ success: true, message: `Shifted Table ${fromTable.table_number} to ${toTable.table_number}` });
  } catch (err) {
    console.error('[POST /table/shift] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to shift table' });
  }
});

app.post('/table/merge', (req, res) => {
  const { fromId, toId } = req.body;
  try {
    const allTables = statements.getAllTables();
    const fromTable = allTables.find(t => String(t.id) === String(fromId) || String(t.table_number).toUpperCase() === String(fromId).toUpperCase());
    const toTable = allTables.find(t => String(t.id) === String(toId) || String(t.table_number).toUpperCase() === String(toId).toUpperCase());

    if (!fromTable || !toTable) return res.status(404).json({ error: 'Table not found' });

    // 1. Move active orders DB side
    const activeOrders = statements.getOrdersByTable({ table_number: fromTable.table_number });
    activeOrders.forEach(o => statements.updateOrderTable({ id: o.id, table_number: toTable.table_number }));

    // 2. Merge items
    let fromItems = [];
    let toItems = [];
    try { fromItems = JSON.parse(fromTable.order_items || '[]'); } catch(e){}
    try { toItems = JSON.parse(toTable.order_items || '[]'); } catch(e){}
    const mergedItems = [...toItems, ...fromItems];

    // 3. Update tables
    statements.updateTable({
      id: toTable.id,
      status: toTable.status === 'AVAILABLE' || toTable.status === 'VACANT' ? fromTable.status : toTable.status,
      order_items: JSON.stringify(mergedItems),
      created_at: toTable.created_at || fromTable.created_at
    });

    statements.updateTable({
      id: fromTable.id,
      status: 'AVAILABLE',
      order_items: '[]',
      created_at: null,
      bill_number: null
    });
    
    clearShiftForTable(fromTable.table_number);

    broadcastOrderUpdate(fromTable.id);
    broadcastOrderUpdate(toTable.id);

    res.json({ success: true, message: `Merged Table ${fromTable.table_number} into ${toTable.table_number}` });
  } catch (err) {
    console.error('[POST /table/merge] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to merge tables' });
  }
});

app.post('/table/split', (req, res) => {
  const { fromId, toId, itemsToMove } = req.body;
  try {
    const allTables = statements.getAllTables();
    const fromTable = allTables.find(t => String(t.id) === String(fromId) || String(t.table_number).toUpperCase() === String(fromId).toUpperCase());
    const toTable = allTables.find(t => String(t.id) === String(toId) || String(t.table_number).toUpperCase() === String(toId).toUpperCase());

    if (!fromTable || !toTable) return res.status(404).json({ error: 'Table not found' });
    if (!itemsToMove || !Array.isArray(itemsToMove)) return res.status(400).json({ error: 'itemsToMove must be an array' });

    let fromItems = [];
    let toItems = [];
    try { fromItems = JSON.parse(fromTable.order_items || '[]'); } catch(e){}
    try { toItems = JSON.parse(toTable.order_items || '[]'); } catch(e){}

    // Basic logic: remove itemsToMove from fromItems, add to toItems
    // Assuming itemsToMove has the exact objects to remove. We match by name and price for simplicity if no unique id.
    const newFromItems = [...fromItems];
    for (const item of itemsToMove) {
      const idx = newFromItems.findIndex(i => i.name === item.name && i.price === item.price);
      if (idx !== -1) {
        // if qty > item.qty, reduce it. else remove it.
        if (newFromItems[idx].qty > item.qty) {
          newFromItems[idx].qty -= item.qty;
        } else {
          newFromItems.splice(idx, 1);
        }
        
        // Add to target
        const targetIdx = toItems.findIndex(i => i.name === item.name && i.price === item.price);
        if (targetIdx !== -1) {
          toItems[targetIdx].qty += item.qty;
        } else {
          toItems.push({ ...item, qty: item.qty });
        }
      }
    }

    statements.updateTable({
      id: fromTable.id,
      order_items: JSON.stringify(newFromItems),
      status: newFromItems.length === 0 ? 'AVAILABLE' : fromTable.status
    });

    statements.updateTable({
      id: toTable.id,
      status: toTable.status === 'AVAILABLE' || toTable.status === 'VACANT' ? 'DRAFT' : toTable.status,
      order_items: JSON.stringify(toItems),
      created_at: toTable.created_at || new Date().toISOString()
    });

    broadcastOrderUpdate(fromTable.id);
    broadcastOrderUpdate(toTable.id);

    res.json({ success: true, message: `Split items to Table ${toTable.table_number}` });
  } catch (err) {
    console.error('[POST /table/split] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to split table' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /sync — Full state dump (for cloud / diagnostic use)
// ─────────────────────────────────────────────────────────────
app.get('/sync', (req, res) => {
  try {
    const tables = statements.getAllTables().map(normalizeTable);
    const menu  = statements.getAllMenu().map(i => ({ ...i, available: i.available === 1 }));
    const orders = statements.getAllOrders({ limit: 500, offset: 0 }).map(o => {
      try { o.items = JSON.parse(o.items); } catch (e) { o.items = []; }
      return o;
    });

    res.json({ success: true, tables, menu, orders, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[GET /sync] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get state' });
  }
});

// ─────────────────────────────────────────────────────────────
// Sync Queue API — for monitoring / manual management
// ─────────────────────────────────────────────────────────────
app.get('/api/sync-queue', (req, res) => {
  try {
    const pending = statements.getPendingSyncItems({ limit: 100 });
    res.json({ success: true, count: pending.length, items: pending });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    port:      PORT
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Network info (used by frontends to discover LAN IP)
app.get('/api/network', (req, res) => {
  res.json({ 
    ip: getLocalIP(), 
    port: PORT,
    connectedDevicesCount: io ? io.sockets.sockets.size : 0,
    hostname: os.hostname(),
    localDomain: `${os.hostname().toLowerCase()}.local`
  });
});

// Comprehensive Network Diagnostics for Captain & Mobile connectivity
app.get('/api/network-diagnostics', (req, res) => {
  try {
    const nets = os.networkInterfaces();
    const interfaces = [];
    const hostname = os.hostname();
    const localDomain = `${hostname.toLowerCase()}.local`;
    
    for (const [name, netList] of Object.entries(nets)) {
      if (!netList) continue;
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          const isVirtual = /virtual|vbox|vmware|wsl|hyper-v|vethernet/i.test(name);
          interfaces.push({
            name,
            address: net.address,
            netmask: net.netmask,
            isLinkLocal: net.address.startsWith('169.254.'),
            isVirtual,
            captainUrl: `http://${net.address}:${PORT}/captain/`,
            kitchenUrl: `http://${net.address}:${PORT}/kitchen/`
          });
        }
      }
    }

    const primaryIp = getLocalIP();
    const activeSockets = io ? io.sockets.sockets.size : 0;

    res.json({
      success: true,
      hostname,
      localDomain,
      primaryIp,
      port: PORT,
      boundHost: '0.0.0.0',
      connectedDevicesCount: activeSockets,
      interfaces,
      urls: {
        primaryIpUrl: `http://${primaryIp}:${PORT}/captain/`,
        hostnameUrl: `http://${localDomain}:${PORT}/captain/`,
        localhostUrl: `http://localhost:${PORT}/captain/`,
        kitchenUrl: `http://${primaryIp}:${PORT}/kitchen/`
      },
      healthCheck: {
        serverBoundToAllInterfaces: true,
        primaryIpDetected: primaryIp !== 'localhost',
        multipleAdaptersDetected: interfaces.length > 1,
        activeDevicesCount: activeSockets
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Serve POS UI (built static bundle)
// ─────────────────────────────────────────────────────────────
const posDist = path.join(__dirname, '../dist');
if (existsSync(posDist)) {
  app.use(express.static(posDist));
  // Serve index.html for all non-api routes (SPA support)
  app.get(/^\/(?!api|orders|tables|menu|billing|devices|signing|captain|kitchen|sync|health).*/, (req, res) => {
    res.sendFile(path.join(posDist, 'index.html'));
  });
}

// Serve Captain App (built static bundle)
const finalCaptainDist = path.join(__dirname, '../frontend/captain/dist');
console.log(`[Captain] FORCING build path: ${finalCaptainDist}`);

// Serve static files from the captain dist folder
app.use('/captain', express.static(finalCaptainDist));

// For any other request starting with /captain, send the index.html (SPA support)
app.get(/^\/captain(\/.*)?$/, (req, res) => {
  const indexPath = path.join(finalCaptainDist, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Captain App Build Not Found');
  }
});

// Serve Kitchen App (built static bundle)
const finalKitchenDist = path.join(__dirname, '../frontend/kitchen/dist');
console.log(`[Kitchen] Serving build path: ${finalKitchenDist}`);

app.use('/kitchen', express.static(finalKitchenDist));

app.get(/^\/kitchen(\/.*)?$/, (req, res) => {
  const indexPath = path.join(finalKitchenDist, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Kitchen App Build Not Found');
  }
});

// ─────────────────────────────────────────────────────────────
// 404 fallback for unknown /api routes
// ─────────────────────────────────────────────────────────────
app.use(/^\/api/, (req, res) => {
  res.status(404).json({
    error:   'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// ─────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('\x1b[31m  💥 Unhandled error:\x1b[0m', err.message);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────


// ─── Unified Order Sync Helper ───
function getFullOrder(tableIdOrOrderId) {
  try {
    // Try to find by order ID first, then table ID if needed
    let table = null;
    if (String(tableIdOrOrderId).includes('-') || isNaN(Number(tableIdOrOrderId))) {
       // Might be a UUID order ID or a non-integer table ID
       // For now, let's assume we search by table_number or id
       const all = statements.getAllTables();
       table = all.find(t => String(t.id) === String(tableIdOrOrderId) || String(t.table_number) === String(tableIdOrOrderId));
    } else {
       table = statements.getTableById({ id: tableIdOrOrderId });
    }

    if (!table) return null;
    const normalized = normalizeTable(table);
    
    return {
      id: String(normalized.id),
      table_id: String(normalized.id),
      table_number: normalized.table_number,
      items: normalized.items,
      total: normalized.total,
      status: normalized.status,
      startedAt: normalized.createdAt || new Date().toISOString(),
      gst_enabled: normalized.gst_enabled,
      gst_rate: normalized.gst_rate,
      service_charge_enabled: normalized.service_charge_enabled,
      service_charge_rate: normalized.service_charge_rate
    };
  } catch (err) {
    console.error("getFullOrder failed:", err);
    return null;
  }
}

function broadcastOrderUpdate(tableId) {
  const fullOrder = getFullOrder(tableId);
  const allTables = statements.getAllTables().map(normalizeTable);
  
  if (io) {
    if (fullOrder) {
      console.log(`[WS] Broadcasting order_updated for Table ${fullOrder.table_number}`);
      io.emit("order_updated", {
        ...fullOrder,
        status: fullOrder.status // Already normalized by getFullOrder -> normalizeTable
      });
    }
    console.log(`[WS] Broadcasting full table_updated`);
    io.emit("table_updated", allTables);
  }
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  
  // 1. Prioritize common active physical interfaces (Wi-Fi, Ethernet, Hotspot bridges)
  const priorityOrder = ['Wi-Fi', 'Ethernet', 'en0', 'en1', 'bridge100', 'pdp_ip0', 'eth0', 'wlan0', 'WLAN', 'Local Area Connection'];
  
  for (const name of priorityOrder) {
    const net = nets[name];
    if (net) {
      for (const iface of net) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
          return iface.address;
        }
      }
    }
  }

  // 2. Fallback to any active non-internal IPv4 (ignoring link-local 169.254.x.x)
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) return net.address;
    }
  }
  
  return 'localhost';
}

// ─────────────────────────────────────────────────────────────
// Graceful Shutdown
// ─────────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n  ⚡ ${signal} — saving database...`);
  forceSave();
  process.exit(0);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────
async function start() {
  await initDatabase();
  loadSigningFiles();
  startSyncWorker();

  try {
    statements.reconcileCustomerStats();
    console.log('  👤 CRM: Customer statistics reconciled with database orders');
  } catch (crmRecErr) {
    console.warn('  ⚠️  CRM: Startup reconciliation warning:', crmRecErr.message);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();

    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log('  ║          🔥  TYDE POS  —  Single Backend             ║');
    console.log('  ║                                                      ║');
    console.log(`  ║  Local:   http://localhost:${PORT}                      ║`);
    console.log(`  ║  Network: http://${ip}:${PORT}                   ║`);
    console.log('  ║                                                      ║');
    console.log(`  ║  API:     /api/orders  /api/tables  /api/menu        ║`);
    console.log(`  ║  Captain: http://${ip}:${PORT}/captain/             ║`);
    console.log(`  ║  Kitchen: http://${ip}:${PORT}/kitchen/             ║`);
    console.log('  ║  Health:  /api/health                                ║');
    console.log('  ║  Socket:  ✅ Socket.IO Ready                         ║');
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  📱 Point Captain App at: http://${ip}:${PORT}`);
    console.log(`  🖥️  Point POS at        : http://${ip}:${PORT}`);
    console.log('');
  });
}

start().catch(err => {
  console.error('  ❌ Failed to start server:', err);
  try {
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const logPath = path.join(dataDir, 'backend_error.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] CRASH: ${err.stack || err}\n`);
  } catch (e) {}
  process.exit(1);
});
