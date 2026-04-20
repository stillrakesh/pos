// ⚠️ STABLE CORE - DO NOT MODIFY WITHOUT BACKUP

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data', 'pos_orders.db');

let db;
let saveTimer = null;

/**
 * Initialize the SQLite database (WASM-based, zero native deps).
 * Must be called (and awaited) before using any statements.
 */
export async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing DB from disk if it exists
  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // --- Schema ---
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number  TEXT NOT NULL,
      items         TEXT NOT NULL,
      notes         TEXT DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'NEW',
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tables (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number  TEXT NOT NULL UNIQUE,
      status        TEXT NOT NULL DEFAULT 'AVAILABLE',
      order_items   TEXT DEFAULT '[]',
      x             INTEGER DEFAULT 50,
      y             INTEGER DEFAULT 50,
      shape         TEXT DEFAULT 'rounded',
      seats         INTEGER DEFAULT 4,
      zone          TEXT DEFAULT 'Main',
      last_updated  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'PENDING',
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  // Indexes for fast lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_number)`);
  db.run(`
    CREATE TABLE IF NOT EXISTS menu (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL DEFAULT 'Uncategorised',
      price         REAL NOT NULL DEFAULT 0,
      available     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_menu_cat_avail ON menu(category, available)`);

  // ─── Sync Queue Table ────────────────────────────────────────
  // One-way queue for pushing local data to cloud backup
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT NOT NULL,
      payload    TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`);

  // --- Global Config Table ---
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // --- Migrations: Add missing columns if they don't exist ---
  try {
    const tableInfo = db.exec("PRAGMA table_info(tables)");
    const columnNames = tableInfo[0].values.map(v => v[1]);
    if (!columnNames.includes('x')) db.run("ALTER TABLE tables ADD COLUMN x INTEGER DEFAULT 50");
    if (!columnNames.includes('y')) db.run("ALTER TABLE tables ADD COLUMN y INTEGER DEFAULT 50");
    if (!columnNames.includes('shape')) db.run("ALTER TABLE tables ADD COLUMN shape TEXT DEFAULT 'rounded'");
    if (!columnNames.includes('seats')) db.run("ALTER TABLE tables ADD COLUMN seats INTEGER DEFAULT 4");
    if (!columnNames.includes('zone')) db.run("ALTER TABLE tables ADD COLUMN zone TEXT DEFAULT 'Main'");
    if (!columnNames.includes('gst_enabled')) db.run("ALTER TABLE tables ADD COLUMN gst_enabled INTEGER DEFAULT 0");
    if (!columnNames.includes('gst_rate')) db.run("ALTER TABLE tables ADD COLUMN gst_rate REAL DEFAULT 0");
    if (!columnNames.includes('service_charge_enabled')) db.run("ALTER TABLE tables ADD COLUMN service_charge_enabled INTEGER DEFAULT 0");
    if (!columnNames.includes('service_charge_rate')) db.run("ALTER TABLE tables ADD COLUMN service_charge_rate REAL DEFAULT 0");

    // Also add to orders for historical accuracy
    const orderInfo = db.exec("PRAGMA table_info(orders)");
    const orderColumnNames = orderInfo[0].values.map(v => v[1]);
    if (!orderColumnNames.includes('gst_enabled')) db.run("ALTER TABLE orders ADD COLUMN gst_enabled INTEGER DEFAULT 0");
    if (!orderColumnNames.includes('gst_rate')) db.run("ALTER TABLE orders ADD COLUMN gst_rate REAL DEFAULT 0");
    if (!orderColumnNames.includes('service_charge_enabled')) db.run("ALTER TABLE orders ADD COLUMN service_charge_enabled INTEGER DEFAULT 0");
    if (!orderColumnNames.includes('service_charge_rate')) db.run("ALTER TABLE orders ADD COLUMN service_charge_rate REAL DEFAULT 0");

    console.log('  📊 Migration: Table layout columns verified');
  } catch (err) {
    console.error('  ❌ Migration error:', err.message);
  }

  // Initial save
  persistToFile();

  console.log('  ✅ Database initialized at', DB_PATH);
  return db;
}

/**
 * Persist the in-memory DB to disk.
 * Debounced: won't write more than once per 500ms.
 */
function persistToFile() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const data = db.export();
      writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
      console.error('  ❌ DB persist error:', err.message);
    }
  }, 500);
}

/**
 * Force-save the DB immediately (used on shutdown).
 */
export function forceSave() {
  if (saveTimer) clearTimeout(saveTimer);
  try {
    const data = db.export();
    writeFileSync(DB_PATH, Buffer.from(data));
    console.log('  💾 Database saved to disk.');
  } catch (err) {
    console.error('  ❌ DB force-save error:', err.message);
  }
}

// ─── Helper: convert sql.js row arrays to objects ────────────
function rowsToObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// ─── Prepared Statement Helpers ──────────────────────────────
// sql.js doesn't have true prepared-statement caching like better-sqlite3,
// but these wrappers keep the API identical for the routes.

export const statements = {
  insertOrder({ table_number, items, notes, status, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate }) {
    db.run(
      `INSERT INTO orders (table_number, items, notes, status, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [table_number, items, notes || '', status, gst_enabled || 0, gst_rate || 0, service_charge_enabled || 0, service_charge_rate || 0]
    );
    const lastId = db.exec(`SELECT last_insert_rowid() as id`)[0].values[0][0];
    persistToFile();
    return { lastInsertRowid: lastId };
  },

  getOrderById({ id }) {
    const result = db.exec(`SELECT * FROM orders WHERE id = ?`, [id]);
    const rows = rowsToObjects(result);
    return rows[0] || null;
  },

  getOrdersByStatus({ status }) {
    const result = db.exec(
      `SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC`, 
      [status]
    );
    return rowsToObjects(result);
  },

  getAllOrders({ limit, offset }) {
    const result = db.exec(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rowsToObjects(result);
  },

  getOrdersByTable({ table_number }) {
    const result = db.exec(
      `SELECT * FROM orders WHERE table_number = ? AND status != 'COMPLETED' ORDER BY created_at DESC`,
      [table_number]
    );
    return rowsToObjects(result);
  },

  updateOrderStatus({ id, status }) {
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, id]);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  getOrderCount({ status }) {
    const result = db.exec(`SELECT COUNT(*) as count FROM orders WHERE status = ?`, [status]);
    return rowsToObjects(result)[0] || { count: 0 };
  },

  // ─── Table Statements ───────────────────────────────────────

  getAllTables() {
    const result = db.exec(`SELECT * FROM tables ORDER BY CAST(table_number AS INTEGER), table_number`);
    return rowsToObjects(result);
  },

  getTableById({ id }) {
    const result = db.exec(`SELECT * FROM tables WHERE id = ?`, [id]);
    const rows = rowsToObjects(result);
    return rows[0] || null;
  },

  insertTable({ table_number, status, order_items, x, y, shape, seats, zone, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate }) {
    db.run(
      `INSERT INTO tables (table_number, status, order_items, x, y, shape, seats, zone, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      [table_number, status || 'AVAILABLE', order_items || '[]', x || 50, y || 50, shape || 'rounded', seats || 4, zone || 'Main', gst_enabled || 0, gst_rate || 0, service_charge_enabled || 0, service_charge_rate || 0]
    );
    const lastId = db.exec(`SELECT last_insert_rowid() as id`)[0].values[0][0];
    persistToFile();
    return { lastInsertRowid: lastId };
  },

  updateTable(req) {
    const { id, table_number, status, order_items, x, y, shape, seats, zone, created_at } = req;
    const setClauses = [];
    const params = [];
    if (table_number !== undefined) { setClauses.push('table_number = ?'); params.push(table_number); }
    if (status !== undefined) { setClauses.push('status = ?'); params.push(status); }
    if (order_items !== undefined) { setClauses.push('order_items = ?'); params.push(order_items); }
    if (x !== undefined) { setClauses.push('x = ?'); params.push(x); }
    if (y !== undefined) { setClauses.push('y = ?'); params.push(y); }
    if (shape !== undefined) { setClauses.push('shape = ?'); params.push(shape); }
    if (seats !== undefined) { setClauses.push('seats = ?'); params.push(seats); }
    if (zone !== undefined) { setClauses.push('zone = ?'); params.push(zone); }
    if (req.gst_enabled !== undefined) { setClauses.push('gst_enabled = ?'); params.push(req.gst_enabled ? 1 : 0); }
    if (req.gst_rate !== undefined) { setClauses.push('gst_rate = ?'); params.push(req.gst_rate); }
    if (req.service_charge_enabled !== undefined) { setClauses.push('service_charge_enabled = ?'); params.push(req.service_charge_enabled ? 1 : 0); }
    if (req.service_charge_rate !== undefined) { setClauses.push('service_charge_rate = ?'); params.push(req.service_charge_rate); }
    
    if (created_at !== undefined) {
      if (created_at === null) {
        setClauses.push('created_at = NULL');
      } else {
        setClauses.push('created_at = ?');
        params.push(created_at);
      }
    }
    
    setClauses.push("last_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
    
    if (setClauses.length === 1) return { changes: 0 }; 
    params.push(id);
    db.run(`UPDATE tables SET ${setClauses.join(', ')} WHERE id = ?`, params);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  deleteTable({ id }) {
    db.run(`DELETE FROM tables WHERE id = ?`, [id]);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  replaceAllTables(tablesArray) {
    if (!Array.isArray(tablesArray)) return;
    
    console.log(`[DB] Syncing ${tablesArray.length} tables from client...`);
    
    for (const t of tablesArray) {
      const tableNum = String(t.table_number || t.name?.replace('Table ', '') || t.id);
      const items = typeof t.order_items === 'string' ? t.order_items : JSON.stringify(t.orders || t.items || t.order_items || []);
      const status = (t.status || 'AVAILABLE').toUpperCase();
      
      // Check if table exists
      const existingRes = db.exec(`SELECT id, order_items FROM tables WHERE table_number = ?`, [tableNum]);
      const rows = rowsToObjects(existingRes);

      if (rows.length > 0) {
        // UPDATE existing - but ONLY if status is different or items exist in incoming
        // This prevents overwriting a richer backend state with a stale POS state
        const existingItems = JSON.parse(rows[0].order_items || '[]');
        const incomingItems = JSON.parse(items || '[]');
        
        // If incoming has no items but existing HAS items, don't overwrite items!
        if (incomingItems.length === 0 && existingItems.length > 0) {
          db.run(
            `UPDATE tables SET status = ?, last_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE table_number = ?`,
            [status, tableNum]
          );
        } else {
          db.run(
            `UPDATE tables SET status = ?, order_items = ?, x = ?, y = ?, shape = ?, seats = ?, zone = ?, gst_enabled = ?, gst_rate = ?, service_charge_enabled = ?, service_charge_rate = ?, last_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE table_number = ?`,
            [status, items, t.pos?.x || t.x || 50, t.pos?.y || t.y || 50, t.shape || 'rounded', t.seats || 4, t.zone || t.zoneLabel || 'Main', t.gst_enabled || 0, t.gst_rate || 0, t.service_charge_enabled || 0, t.service_charge_rate || 0, tableNum]
          );
        }
      } else {
        // INSERT new
        db.run(
          `INSERT INTO tables (table_number, status, order_items, x, y, shape, seats, zone, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
          [tableNum, status, items, t.pos?.x || t.x || 50, t.pos?.y || t.y || 50, t.shape || 'rounded', t.seats || 4, t.zone || t.type || 'Main']
        );
      }
    }
    persistToFile();
  },

  // ─── Device Statements ──────────────────────────────────────
  
  getAllDevices() {
    return rowsToObjects(db.exec(`SELECT * FROM devices ORDER BY created_at DESC`));
  },

  getDeviceById({ id }) {
    const result = db.exec(`SELECT * FROM devices WHERE id = ?`, [id]);
    return rowsToObjects(result)[0] || null;
  },

  registerDevice({ id, name }) {
    db.run(`INSERT OR IGNORE INTO devices (id, name, status) VALUES (?, ?, 'PENDING')`, [id, name]);
    persistToFile();
  },

  updateDeviceStatus({ id, status }) {
    db.run(`UPDATE devices SET status = ? WHERE id = ?`, [status, id]);
    persistToFile();
  },

  deleteDevice({ id }) {
    db.run(`DELETE FROM devices WHERE id = ?`, [id]);
    persistToFile();
  },

  // ─── Menu Statements ────────────────────────────────────────

  getAvailableMenu() {
    const result = db.exec(`SELECT * FROM menu WHERE available = 1 ORDER BY category, name`);
    return rowsToObjects(result);
  },

  getAllMenu() {
    const result = db.exec(`SELECT * FROM menu ORDER BY category, name`);
    return rowsToObjects(result);
  },

  getMenuById({ id }) {
    const result = db.exec(`SELECT * FROM menu WHERE id = ?`, [id]);
    const rows = rowsToObjects(result);
    return rows[0] || null;
  },

  insertMenuItem({ name, category, price, available }) {
    db.run(
      `INSERT INTO menu (name, category, price, available) VALUES (?, ?, ?, ?)`,
      [name, category || 'Uncategorised', price, available !== undefined ? (available ? 1 : 0) : 1]
    );
    const lastId = db.exec(`SELECT last_insert_rowid() as id`)[0].values[0][0];
    persistToFile();
    return { lastInsertRowid: lastId };
  },

  updateMenuItem({ id, name, category, price, available }) {
    const setClauses = [];
    const params = [];
    if (name !== undefined) { setClauses.push('name = ?'); params.push(name); }
    if (category !== undefined) { setClauses.push('category = ?'); params.push(category); }
    if (price !== undefined) { setClauses.push('price = ?'); params.push(price); }
    if (available !== undefined) { setClauses.push('available = ?'); params.push(available ? 1 : 0); }
    if (setClauses.length === 0) return { changes: 0 };
    params.push(id);
    db.run(`UPDATE menu SET ${setClauses.join(', ')} WHERE id = ?`, params);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  deleteMenuItem({ id }) {
    db.run(`DELETE FROM menu WHERE id = ?`, [id]);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  replaceAllMenu(menuArray) {
    if (!Array.isArray(menuArray)) return;
    
    // Clear existing
    db.run(`DELETE FROM menu`);
    
    // Insert new
    for (const item of menuArray) {
      db.run(
        `INSERT INTO menu (name, category, price, available) VALUES (?, ?, ?, ?)`,
        [
          item.name,
          item.category || 'Uncategorised',
          item.price || 0,
          item.available !== undefined ? (item.available ? 1 : 0) : 1
        ]
      );
    }
    persistToFile();
  },

  // ─── Sync Queue Statements ──────────────────────────────────

  enqueueSyncItem({ type, payload }) {
    db.run(
      `INSERT INTO sync_queue (type, payload) VALUES (?, ?)`,
      [type, typeof payload === 'string' ? payload : JSON.stringify(payload)]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  getPendingSyncItems({ limit = 20 } = {}) {
    const result = db.exec(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
      [limit]
    );
    return rowsToObjects(result);
  },

  markSyncComplete({ id }) {
    db.run(`UPDATE sync_queue SET status = 'completed' WHERE id = ?`, [id]);
    persistToFile();
  },

  markSyncFailed({ id }) {
    db.run(`UPDATE sync_queue SET status = 'failed' WHERE id = ?`, [id]);
    persistToFile();
  },

  cleanOldSyncItems() {
    // Remove completed items older than 7 days
    db.run(`DELETE FROM sync_queue WHERE status = 'completed' AND created_at < datetime('now', '-7 days')`);
    persistToFile();
  },

  // ─── Config Statements ──────────────────────────────────────
  
  getConfig({ key }) {
    const result = db.exec(`SELECT value FROM config WHERE key = ?`, [key]);
    const rows = rowsToObjects(result);
    return rows[0] ? JSON.parse(rows[0].value) : null;
  },

  setConfig({ key, value }) {
    db.run(
      `INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`,
      [key, JSON.stringify(value)]
    );
    persistToFile();
  }
};
