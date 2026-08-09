// ⚠️ STABLE CORE - DO NOT MODIFY WITHOUT BACKUP

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync, appendFileSync as fsAppendFile } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_NAME = 'pos_orders.db';
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const DB_PATH = join(DATA_DIR, DB_NAME);

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  try {
    const fs = await import('fs');
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // Fallback if top-level await import fails in some node versions
    // though in ESM it should be fine.
  }
}

let db;
let saveTimer = null;

export const getDb = () => db;

/**
 * Initialize the SQLite database (WASM-based, zero native deps).
 * Must be called (and awaited) before using any statements.
 */
export async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => {
      const wasmPath = join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file);
      return existsSync(wasmPath) ? wasmPath : file;
    }
  });

  // Load existing DB from disk if it exists — with corruption recovery
  if (existsSync(DB_PATH)) {
    try {
      const fileBuffer = readFileSync(DB_PATH);
      if (fileBuffer.length === 0) throw new Error('Database file is empty (0 bytes)');
      db = new SQL.Database(fileBuffer);
      // Quick integrity check
      db.exec('SELECT count(*) FROM sqlite_master');
    } catch (loadErr) {
      console.error('  ⚠️ DATABASE CORRUPTION DETECTED:', loadErr.message);
      console.error('  🔧 Attempting recovery...');
      
      // Rename corrupt file for forensic analysis
      const corruptPath = DB_PATH + '.corrupt.' + Date.now();
      try { renameSync(DB_PATH, corruptPath); } catch (e) {}
      console.error(`  📦 Corrupt file saved as: ${corruptPath}`);
      
      // Try loading from backup if available
      const backupPath = DB_PATH + '.bak';
      if (existsSync(backupPath)) {
        try {
          const backupBuffer = readFileSync(backupPath);
          if (backupBuffer.length > 0) {
            db = new SQL.Database(backupBuffer);
            db.exec('SELECT count(*) FROM sqlite_master');
            console.log('  ✅ RECOVERED from backup file!');
          } else {
            throw new Error('Backup file is also empty');
          }
        } catch (backupErr) {
          console.error('  ❌ Backup also corrupt. Starting fresh database.');
          db = new SQL.Database();
        }
      } else {
        console.error('  ❌ No backup available. Starting fresh database.');
        db = new SQL.Database();
      }
    }
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
      service_charge_enabled INTEGER DEFAULT 0,
      service_charge_rate REAL DEFAULT 0,
      gst_amount    REAL DEFAULT 0,
      service_charge REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_rate REAL DEFAULT 0,
      bill_number   TEXT,
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

  try { db.run(`ALTER TABLE devices ADD COLUMN device_type TEXT DEFAULT 'Unknown'`); } catch(e) {}
  try { db.run(`ALTER TABLE devices ADD COLUMN ip_address TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE devices ADD COLUMN os_info TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE devices ADD COLUMN last_seen TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`); } catch(e) {}
  try { db.run(`UPDATE devices SET status = 'APPROVED' WHERE status = 'PENDING'`); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS device_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_activity_device ON device_activity(device_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_activity_timestamp ON device_activity(timestamp)`);


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
      type          TEXT NOT NULL DEFAULT 'Veg',
      short_code    TEXT,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  // Migration: add columns if they don't exist yet
  try { db.run(`ALTER TABLE menu ADD COLUMN type TEXT NOT NULL DEFAULT 'Veg'`); } catch(e) {}
  try { db.run(`ALTER TABLE menu ADD COLUMN short_code TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE menu ADD COLUMN modifier_groups TEXT DEFAULT '[]'`); } catch(e) {}
  try { db.run(`ALTER TABLE menu ADD COLUMN add_ons TEXT DEFAULT '[]'`); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL UNIQUE
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

  // --- Phase 3: Inventory & Recipe Costing ---
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      current_stock REAL DEFAULT 0,
      low_stock_threshold REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL,
      inventory_item_id INTEGER NOT NULL,
      quantity_required REAL NOT NULL,
      FOREIGN KEY (menu_item_id) REFERENCES menu(id),
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_item_id INTEGER NOT NULL,
      change_type TEXT NOT NULL, 
      quantity REAL NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
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
    if (!columnNames.includes('discount_amount')) db.run("ALTER TABLE tables ADD COLUMN discount_amount REAL DEFAULT 0");
    if (!columnNames.includes('discount_rate')) db.run("ALTER TABLE tables ADD COLUMN discount_rate REAL DEFAULT 0");
    if (!columnNames.includes('gst_amount')) db.run("ALTER TABLE tables ADD COLUMN gst_amount REAL DEFAULT 0");
    if (!columnNames.includes('service_charge')) db.run("ALTER TABLE tables ADD COLUMN service_charge REAL DEFAULT 0");
    if (!columnNames.includes('bill_number')) db.run("ALTER TABLE tables ADD COLUMN bill_number TEXT");
    if (!columnNames.includes('covers')) db.run("ALTER TABLE tables ADD COLUMN covers INTEGER DEFAULT 1");
    if (!columnNames.includes('scale')) db.run("ALTER TABLE tables ADD COLUMN scale REAL DEFAULT 1.0");
    if (!columnNames.includes('customer_name')) db.run("ALTER TABLE tables ADD COLUMN customer_name TEXT DEFAULT ''");
    if (!columnNames.includes('phone')) db.run("ALTER TABLE tables ADD COLUMN phone TEXT DEFAULT ''");

    // Also add to orders for historical accuracy
    const orderInfo = db.exec("PRAGMA table_info(orders)");
    const orderColumnNames = orderInfo[0].values.map(v => v[1]);
    if (!orderColumnNames.includes('gst_enabled')) db.run("ALTER TABLE orders ADD COLUMN gst_enabled INTEGER DEFAULT 0");
    if (!orderColumnNames.includes('gst_rate')) db.run("ALTER TABLE orders ADD COLUMN gst_rate REAL DEFAULT 0");
    if (!orderColumnNames.includes('service_charge_enabled')) db.run("ALTER TABLE orders ADD COLUMN service_charge_enabled INTEGER DEFAULT 0");
    if (!orderColumnNames.includes('service_charge_rate')) db.run("ALTER TABLE orders ADD COLUMN service_charge_rate REAL DEFAULT 0");
    if (!orderColumnNames.includes('service_charge')) db.run("ALTER TABLE orders ADD COLUMN service_charge REAL DEFAULT 0");
    if (!orderColumnNames.includes('discount_amount')) db.run("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0");
    if (!orderColumnNames.includes('discount_rate')) db.run("ALTER TABLE orders ADD COLUMN discount_rate REAL DEFAULT 0");
    if (!orderColumnNames.includes('bill_number')) db.run("ALTER TABLE orders ADD COLUMN bill_number TEXT");
    // Analytics additions — payment tracking
    if (!orderColumnNames.includes('payment_method')) db.run("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'Unknown'");
    if (!orderColumnNames.includes('grand_total')) db.run("ALTER TABLE orders ADD COLUMN grand_total REAL DEFAULT 0");
    if (!orderColumnNames.includes('gst_amount')) db.run("ALTER TABLE orders ADD COLUMN gst_amount REAL DEFAULT 0");
    if (!orderColumnNames.includes('points_redeemed')) db.run("ALTER TABLE orders ADD COLUMN points_redeemed INTEGER DEFAULT 0");
    if (!orderColumnNames.includes('loyalty_discount')) db.run("ALTER TABLE orders ADD COLUMN loyalty_discount REAL DEFAULT 0");
    if (!orderColumnNames.includes('covers')) db.run("ALTER TABLE orders ADD COLUMN covers INTEGER DEFAULT 1");
    if (!orderColumnNames.includes('tip_amount')) db.run("ALTER TABLE orders ADD COLUMN tip_amount REAL DEFAULT 0");
    if (!orderColumnNames.includes('customer_name')) db.run("ALTER TABLE orders ADD COLUMN customer_name TEXT DEFAULT ''");
    if (!orderColumnNames.includes('phone')) db.run("ALTER TABLE orders ADD COLUMN phone TEXT");

    console.log('  📊 Migration: Table layout columns verified');
  } catch (err) {
    console.error('  ❌ Migration error:', err.message);
  }

  // --- CRM & Customers Table ---
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      phone         TEXT UNIQUE NOT NULL,
      visits        INTEGER DEFAULT 0,
      total_spent   REAL DEFAULT 0,
      loyalty_points REAL DEFAULT 0,
      last_visit    TEXT,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)`);

  // --- Multi-Tender Payments Table ---
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id      INTEGER NOT NULL,
      amount        REAL NOT NULL,
      payment_method TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)`);

  // --- Granular Audit Logs Table ---
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user          TEXT NOT NULL DEFAULT 'System',
      action        TEXT NOT NULL,
      details       TEXT DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`);

  // --- Analytics: Expenses Table ---
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount      REAL NOT NULL,
      category    TEXT NOT NULL DEFAULT 'General',
      note        TEXT DEFAULT '',
      expense_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d', 'now')),
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`);

  // --- KOT Tickets Table ---
  db.run(`
    CREATE TABLE IF NOT EXISTS kot_tickets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number  TEXT,
      items         TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'NEW',
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

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
      const buffer = Buffer.from(data);
      const tmpPath = DB_PATH + '.tmp';
      const backupPath = DB_PATH + '.bak';
      
      // Step 1: Write to temporary file
      writeFileSync(tmpPath, buffer);
      
      // Step 2: Backup current DB (if it exists and has content)
      if (existsSync(DB_PATH)) {
        try { copyFileSync(DB_PATH, backupPath); } catch (e) {}
      }
      
      // Step 3: Atomic rename (this is the critical moment — rename is atomic on most OS)
      renameSync(tmpPath, DB_PATH);
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
    const buffer = Buffer.from(data);
    const tmpPath = DB_PATH + '.tmp';
    const backupPath = DB_PATH + '.bak';
    
    writeFileSync(tmpPath, buffer);
    if (existsSync(DB_PATH)) {
      try { copyFileSync(DB_PATH, backupPath); } catch (e) {}
    }
    renameSync(tmpPath, DB_PATH);
    console.log('  💾 Database saved to disk (atomic).');
  } catch (err) {
    console.error('  ❌ DB force-save error:', err.message);
    // Fallback: try direct write if atomic fails
    try {
      const data = db.export();
      writeFileSync(DB_PATH, Buffer.from(data));
      console.log('  💾 Database saved (fallback direct write).');
    } catch (fallbackErr) {
      console.error('  ❌ DB fallback save also failed:', fallbackErr.message);
    }
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
  // --- Phase 2: CRM & Payments ---
  insertPayment(order_id, amount, payment_method) {
    db.run(
      `INSERT INTO payments (order_id, amount, payment_method) VALUES (?, ?, ?)`,
      [order_id, amount, payment_method]
    );
    persistToFile();
  },

  registerCustomerContact(phone, name) {
    if (!phone || String(phone).trim().length < 10) return;
    const cleanPhone = String(phone).trim();
    const cleanName = (name && name.trim() !== 'Walk-In' && name.trim() !== 'Guest') ? name.trim() : '';
    const existingResult = db.exec(`SELECT * FROM customers WHERE phone = ?`, [cleanPhone]);
    
    if (existingResult.length > 0 && existingResult[0].values.length > 0) {
      if (cleanName) {
        db.run(`UPDATE customers SET name = ? WHERE phone = ?`, [cleanName, cleanPhone]);
      }
    } else {
      db.run(
        `INSERT INTO customers (name, phone, visits, total_spent, loyalty_points, last_visit)
         VALUES (?, ?, 0, 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        [cleanName || 'Guest', cleanPhone]
      );
    }
    persistToFile();
  },

  reconcileCustomerStats() {
    try {
      const custResult = db.exec(`SELECT id, name, phone FROM customers`);
      if (custResult.length === 0 || custResult[0].values.length === 0) return;
      
      const customers = custResult[0].values;

      for (const [id, name, phone] of customers) {
        if (!phone || String(phone).trim().length < 10) continue;
        const cleanPhone = String(phone).trim();
        const cleanName = String(name || '').trim();

        // Query completed / paid orders for this customer
        const orderRes = db.exec(
          `SELECT grand_total, created_at, items 
           FROM orders 
           WHERE (phone = ? OR (customer_name = ? AND customer_name != '' AND customer_name != 'Guest' AND customer_name != 'Walk-In'))
             AND status IN ('COMPLETED', 'PAID', 'PRINTED')`,
          [cleanPhone, cleanName]
        );

        let visits = 0;
        let totalSpent = 0;
        let lastVisit = null;

        if (orderRes.length > 0 && orderRes[0].values.length > 0) {
          const rows = orderRes[0].values;
          visits = rows.length;
          for (const row of rows) {
            let orderTotal = Number(row[0] || 0);
            if (!orderTotal && row[2]) {
              try {
                const items = JSON.parse(row[2]);
                if (Array.isArray(items)) {
                  orderTotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || item.quantity || 1)), 0);
                }
              } catch(e){}
            }
            totalSpent += orderTotal;
            const createdAt = row[1];
            if (!lastVisit || (createdAt && createdAt > lastVisit)) {
              lastVisit = createdAt;
            }
          }
        }

        const loyaltyPoints = Math.floor(totalSpent / 100);

        db.run(
          `UPDATE customers SET 
            visits = ?,
            total_spent = ?,
            loyalty_points = ?,
            last_visit = COALESCE(?, last_visit)
           WHERE id = ?`,
          [visits, totalSpent, loyaltyPoints, lastVisit, id]
        );
      }
      persistToFile();
    } catch (err) {
      console.warn("⚠️ [reconcileCustomerStats] Warning:", err.message);
    }
  },

  upsertCustomer(phone, name, amount_spent, points_redeemed) {
    if (!phone || String(phone).trim().length < 10) return;
    const cleanPhone = String(phone).trim();
    const cleanName = (name && name.trim() !== 'Walk-In' && name.trim() !== 'Guest') ? name.trim() : '';
    const existingResult = db.exec(`SELECT * FROM customers WHERE phone = ?`, [cleanPhone]);
    const pointsEarned = Math.floor((amount_spent || 0) / 100); // 1 point per 100 spent
    
    if (existingResult.length > 0 && existingResult[0].values.length > 0) {
      const existingRow = existingResult[0].values[0];
      const existingName = existingRow[1] || '';
      const finalName = cleanName || existingName || 'Guest';
      db.run(
        `UPDATE customers SET 
          name = ?,
          visits = visits + 1, 
          total_spent = total_spent + ?, 
          loyalty_points = MAX(0, loyalty_points + ? - ?),
          last_visit = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE phone = ?`,
        [finalName, amount_spent || 0, pointsEarned, points_redeemed || 0, cleanPhone]
      );
    } else {
      db.run(
        `INSERT INTO customers (name, phone, visits, total_spent, loyalty_points, last_visit)
         VALUES (?, ?, 1, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        [cleanName || 'Guest', cleanPhone, amount_spent || 0, Math.max(0, pointsEarned - (points_redeemed || 0))]
      );
    }
    persistToFile();
  },

  insertOrder(req) {
    const { table_number, items, notes, status, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate, gst_amount, service_charge, customer_name, phone } = req;
    db.run(
      `INSERT INTO orders (table_number, items, notes, status, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate, gst_amount, service_charge, discount_amount, discount_rate, customer_name, phone, covers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [table_number, items, notes || '', status, gst_enabled ? 1 : 0, Number(gst_rate) || 0, service_charge_enabled ? 1 : 0, Number(service_charge_rate) || 0, gst_amount || 0, service_charge || 0, req.discount_amount || 0, req.discount_rate || 0, customer_name || '', phone || '', req.covers || 1]
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

  getOrdersByStatus({ status, limit = 500, offset = 0 }) {
    const result = db.exec(
      `SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, 
      [status, limit, offset]
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
      `SELECT * FROM orders WHERE table_number = ? AND status != 'COMPLETED' AND status != 'CANCELLED' ORDER BY created_at DESC`,
      [table_number]
    );
    return rowsToObjects(result);
  },

  updateOrderStatus({ id, status }) {
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, id]);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  deleteOrder({ id }) {
    db.run(
      `DELETE FROM orders WHERE id = ? OR table_number = ? OR bill_number = ?`,
      [id, String(id), String(id)]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  getHistoryOrders({ limit = 50000, offset = 0 } = {}) {
    const result = db.exec(
      `SELECT * FROM orders WHERE status IN ('COMPLETED', 'CANCELED', 'CANCELLED') ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rowsToObjects(result);
  },

  updateOrderPaymentMethod({ id, payment_method }) {
    db.run(`UPDATE orders SET payment_method = ? WHERE id = ?`, [payment_method, id]);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  updateOrderCart({ id, items, notes, status, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate, customer_name, phone, covers, grand_total, payment_method, gst_amount, service_charge, tip_amount, bill_number }) {
    db.run(
      `UPDATE orders SET items = ?, notes = ?, status = ?, gst_enabled = ?, gst_rate = ?, service_charge_enabled = ?, service_charge_rate = ?, customer_name = COALESCE(?, customer_name), phone = COALESCE(?, phone), covers = COALESCE(?, covers), grand_total = COALESCE(?, grand_total), payment_method = COALESCE(?, payment_method), gst_amount = COALESCE(?, gst_amount), service_charge = COALESCE(?, service_charge), tip_amount = COALESCE(?, tip_amount), bill_number = COALESCE(?, bill_number) WHERE id = ?`,
      [items, notes, status, gst_enabled ? 1 : 0, Number(gst_rate) || 0, service_charge_enabled ? 1 : 0, Number(service_charge_rate) || 0, customer_name || null, phone || null, covers || null, grand_total ?? null, payment_method || null, gst_amount ?? null, service_charge ?? null, tip_amount ?? null, bill_number || null, id]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  updateOrderTable({ id, table_number }) {
    db.run(`UPDATE orders SET table_number = ? WHERE id = ?`, [table_number, id]);
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

  insertTable(req) {
    const { table_number, status, order_items, x, y, shape, seats, zone, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate, gst_amount, service_charge, bill_number, scale } = req;
    db.run(
      `INSERT INTO tables (table_number, status, order_items, x, y, shape, seats, zone, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate, gst_amount, service_charge, discount_amount, discount_rate, last_updated, bill_number, scale) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, ?)`,
      [table_number, status || 'AVAILABLE', order_items || '[]', x || 50, y || 50, shape || 'rounded', seats || 4, zone || 'Main', gst_enabled || 0, gst_rate || 0, service_charge_enabled || 0, service_charge_rate || 0, gst_amount || 0, service_charge || 0, req.discount_amount || 0, req.discount_rate || 0, bill_number || null, scale || 1.0]
    );
    const lastId = db.exec(`SELECT last_insert_rowid() as id`)[0].values[0][0];
    persistToFile();
    return { lastInsertRowid: lastId };
  },

  updateTable(req) {
    const { id, table_number, status, order_items, x, y, shape, seats, zone, created_at, bill_number, scale } = req;
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
    if (req.covers !== undefined) { setClauses.push('covers = ?'); params.push(req.covers); }
    if (req.gst_enabled !== undefined) { setClauses.push('gst_enabled = ?'); params.push(req.gst_enabled ? 1 : 0); }
    if (req.gst_rate !== undefined) { setClauses.push('gst_rate = ?'); params.push(req.gst_rate); }
    if (req.service_charge_enabled !== undefined) { setClauses.push('service_charge_enabled = ?'); params.push(req.service_charge_enabled ? 1 : 0); }
    if (req.service_charge_rate !== undefined) { setClauses.push('service_charge_rate = ?'); params.push(req.service_charge_rate); }
    if (req.gst_amount !== undefined) { setClauses.push('gst_amount = ?'); params.push(req.gst_amount); }
    if (req.service_charge !== undefined) { setClauses.push('service_charge = ?'); params.push(req.service_charge); }
    if (req.discount_amount !== undefined) { setClauses.push('discount_amount = ?'); params.push(req.discount_amount); }
    if (req.discount_rate !== undefined) { setClauses.push('discount_rate = ?'); params.push(req.discount_rate); }
    if (bill_number !== undefined) { setClauses.push('bill_number = ?'); params.push(bill_number); }
    if (scale !== undefined) { setClauses.push('scale = ?'); params.push(scale); }
    if (req.customer_name !== undefined || req.customerName !== undefined) { 
      setClauses.push('customer_name = ?'); 
      params.push(req.customer_name || req.customerName || ''); 
    }
    if (req.phone !== undefined || req.customerPhone !== undefined) { 
      setClauses.push('phone = ?'); 
      params.push(req.phone || req.customerPhone || ''); 
    }
    
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

  getNextBillNumber() {
    // 1. Get max bill number from orders
    let maxOrders = 0;
    try {
      const resOrders = db.exec(`SELECT MAX(CAST(bill_number AS INTEGER)) as max_bill FROM orders WHERE bill_number IS NOT NULL`);
      const rowsOrders = rowsToObjects(resOrders);
      if (rowsOrders[0] && rowsOrders[0].max_bill) {
        maxOrders = parseInt(rowsOrders[0].max_bill, 10);
      }
    } catch (e) {
      console.error('Error fetching max bill from orders:', e.message);
    }

    // 2. Get max bill number from tables
    let maxTables = 0;
    try {
      const resTables = db.exec(`SELECT MAX(CAST(bill_number AS INTEGER)) as max_bill FROM tables WHERE bill_number IS NOT NULL`);
      const rowsTables = rowsToObjects(resTables);
      if (rowsTables[0] && rowsTables[0].max_bill) {
        maxTables = parseInt(rowsTables[0].max_bill, 10);
      }
    } catch (e) {
      console.error('Error fetching max bill from tables:', e.message);
    }

    // 3. Get sequence from config (key: global_bill_sequence)
    let configSeq = 0;
    try {
      const resConfig = db.exec(`SELECT value FROM config WHERE key = 'global_bill_sequence'`);
      const rowsConfig = rowsToObjects(resConfig);
      if (rowsConfig[0] && rowsConfig[0].value) {
        configSeq = parseInt(JSON.parse(rowsConfig[0].value), 10);
      }
    } catch (e) {
      console.error('Error fetching sequence from config:', e.message);
    }

    // Determine current maximum
    const currentMax = Math.max(maxOrders, maxTables, configSeq);

    // Sequence starts from 6000. If we have no bills, or if all existing are less than 6000, start at 6000.
    // If the maximum bill we've seen is 6000 or greater, we increment it.
    let nextBill = 6000;
    if (currentMax >= 6000) {
      nextBill = currentMax + 1;
    } else {
      nextBill = 6000;
    }

    // Save the new sequence back to config so it persists even if orders/tables are cleared
    try {
      db.run(
        `INSERT OR REPLACE INTO config (key, value) VALUES ('global_bill_sequence', ?)`,
        [JSON.stringify(nextBill.toString())]
      );
      persistToFile();
    } catch (e) {
      console.error('Error saving sequence to config:', e.message);
    }

    return nextBill.toString();
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
            `UPDATE tables SET status = ?, order_items = ?, x = ?, y = ?, shape = ?, seats = ?, zone = ?, gst_enabled = ?, gst_rate = ?, service_charge_enabled = ?, service_charge_rate = ?, last_updated = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), covers = ? WHERE table_number = ?`,
            [status, items, t.pos?.x || t.x || 50, t.pos?.y || t.y || 50, t.shape || 'rounded', t.seats || 4, t.zone || t.zoneLabel || 'Main', t.gst_enabled || 0, t.gst_rate || 0, t.service_charge_enabled || 0, t.service_charge_rate || 0, t.covers || 1, tableNum]
          );
        }
      } else {
        // INSERT new
        db.run(
          `INSERT INTO tables (table_number, status, order_items, x, y, shape, seats, zone, last_updated, covers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)`,
          [tableNum, status, items, t.pos?.x || t.x || 50, t.pos?.y || t.y || 50, t.shape || 'rounded', t.seats || 4, t.zone || t.type || 'Main', t.covers || 1]
        );
      }
    }
    persistToFile();
  },

  // ─── Device Statements ──────────────────────────────────────
  
  getAllDevices() {
    this.deduplicateDevices();
    return rowsToObjects(db.exec(`SELECT * FROM devices ORDER BY last_seen DESC, created_at DESC`));
  },

  getDeviceById({ id }) {
    const result = db.exec(`SELECT * FROM devices WHERE id = ?`, [id]);
    return rowsToObjects(result)[0] || null;
  },

  registerDevice({ id, name, device_type, ip_address, os_info }) {
    const targetId = id || `DEV-${Date.now()}`;
    const typeStr = device_type || 'Unknown';
    const ipStr = ip_address || '';
    const osStr = os_info || '';
    const cleanName = (name || `${typeStr} Device`).trim();

    // 1. Check if device with exact ID already exists (primary match via client localStorage token)
    const existingById = rowsToObjects(db.exec(`SELECT * FROM devices WHERE id = ?`, [targetId]))[0];
    if (existingById) {
      db.run(
        `UPDATE devices SET name = ?, device_type = ?, ip_address = ?, os_info = ?, last_seen = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
        [cleanName, typeStr, ipStr, osStr, targetId]
      );
      persistToFile();
      return targetId;
    }

    // 2. Check if device with same IP, Device Type and OS Info already exists (handles IP reconnects without ID)
    if (ipStr) {
      const existingByNetwork = rowsToObjects(
        db.exec(`SELECT * FROM devices WHERE ip_address = ? AND LOWER(device_type) = LOWER(?) AND LOWER(os_info) = LOWER(?)`, [ipStr, typeStr, osStr])
      )[0];
      if (existingByNetwork) {
        db.run(
          `UPDATE devices SET name = ?, last_seen = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
          [cleanName, existingByNetwork.id]
        );
        persistToFile();
        return existingByNetwork.id;
      }
    }

    // 3. Insert new device if no match found
    db.run(
      `INSERT INTO devices (id, name, status, device_type, ip_address, os_info) VALUES (?, ?, 'APPROVED', ?, ?, ?)`,
      [targetId, cleanName, typeStr, ipStr, osStr]
    );
    persistToFile();
    return targetId;
  },

  deduplicateDevices() {
    try {
      const devices = rowsToObjects(db.exec(`SELECT * FROM devices ORDER BY last_seen DESC, created_at DESC`));
      const seen = new Set();
      const idsToDelete = [];

      for (const dev of devices) {
        if (dev.id === 'LOCAL-DEVICE') continue;
        // Deduplicate only exact ID or exact (IP, device_type, os_info) matches
        const key = `${dev.id}_${(dev.ip_address || '').trim()}_${(dev.device_type || '').toLowerCase().trim()}`;
        if (seen.has(key)) {
          idsToDelete.push(dev.id);
        } else {
          seen.add(key);
        }
      }

      if (idsToDelete.length > 0) {
        console.log(`🧹 Auto-deduplicating ${idsToDelete.length} duplicate device entries...`);
        for (const delId of idsToDelete) {
          db.run(`DELETE FROM devices WHERE id = ?`, [delId]);
        }
        persistToFile();
      }
    } catch (e) {
      console.warn('Device deduplication note:', e.message);
    }
  },

  updateDeviceInfo({ id, device_type, ip_address, os_info }) {
    db.run(`UPDATE devices SET device_type = ?, ip_address = ?, os_info = ?, last_seen = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`, [device_type, ip_address, os_info, id]);
    persistToFile();
  },

  updateDeviceLastSeen({ id }) {
    db.run(`UPDATE devices SET last_seen = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`, [id]);
    persistToFile();
  },

  renameDevice({ id, name }) {
    db.run(`UPDATE devices SET name = ? WHERE id = ?`, [name, id]);
    persistToFile();
  },

  logDeviceActivity({ device_id, action, details }) {
    db.run(`INSERT INTO device_activity (device_id, action, details) VALUES (?, ?, ?)`, [device_id, action, details || '']);
    persistToFile();
  },

  getDeviceActivity({ device_id }) {
    return rowsToObjects(db.exec(`SELECT * FROM device_activity WHERE device_id = ? ORDER BY timestamp DESC LIMIT 50`, [device_id]));
  },

  getRecentActivity() {
    return rowsToObjects(db.exec(`SELECT * FROM device_activity ORDER BY timestamp DESC LIMIT 100`));
  },

  purgeOldActivity() {
    db.run(`DELETE FROM device_activity WHERE timestamp < strftime('%Y-%m-%dT%H:%M:%fZ', datetime('now', '-30 days'))`);
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

  insertMenuItem({ name, category, price, available, type, short_code, modifier_groups, add_ons }) {
    db.run(
      `INSERT INTO menu (name, category, price, available, type, short_code, modifier_groups, add_ons) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        category || 'Uncategorised', 
        price, 
        available !== undefined ? (available ? 1 : 0) : 1, 
        type || 'Veg', 
        short_code || null,
        typeof modifier_groups === 'string' ? modifier_groups : JSON.stringify(modifier_groups || []),
        typeof add_ons === 'string' ? add_ons : JSON.stringify(add_ons || [])
      ]
    );
    const lastId = db.exec(`SELECT last_insert_rowid() as id`)[0].values[0][0];
    persistToFile();
    return { lastInsertRowid: lastId };
  },

  updateMenuItem({ id, name, category, price, available, type, short_code, modifier_groups, add_ons }) {
    const setClauses = [];
    const params = [];
    if (name !== undefined) { setClauses.push('name = ?'); params.push(name); }
    if (category !== undefined) { setClauses.push('category = ?'); params.push(category); }
    if (price !== undefined) { setClauses.push('price = ?'); params.push(price); }
    if (available !== undefined) { setClauses.push('available = ?'); params.push(available ? 1 : 0); }
    if (type !== undefined) { setClauses.push('type = ?'); params.push(type); }
    if (short_code !== undefined) { setClauses.push('short_code = ?'); params.push(short_code); }
    if (modifier_groups !== undefined) { setClauses.push('modifier_groups = ?'); params.push(typeof modifier_groups === 'string' ? modifier_groups : JSON.stringify(modifier_groups)); }
    if (add_ons !== undefined) { setClauses.push('add_ons = ?'); params.push(typeof add_ons === 'string' ? add_ons : JSON.stringify(add_ons)); }
    
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

  getAllCategories() {
    try {
      const result = db.exec(`SELECT name FROM categories ORDER BY id ASC`);
      if (!result || result.length === 0 || !result[0].values) return [];
      return result[0].values.map(v => v[0]);
    } catch(e) {
      return [];
    }
  },

  addCategory(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    try {
      db.run(`INSERT OR IGNORE INTO categories (name) VALUES (?)`, [trimmed]);
      persistToFile();
    } catch(e) {}
  },

  saveCategories(categoryList) {
    if (!Array.isArray(categoryList)) return;
    try {
      db.run(`DELETE FROM categories`);
      categoryList.forEach(c => {
        const name = typeof c === 'object' ? c.name : String(c || '').trim();
        if (name) {
          db.run(`INSERT OR IGNORE INTO categories (name) VALUES (?)`, [name]);
        }
      });
      persistToFile();
    } catch(e) {}
  },

  deleteCategory(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    try {
      db.run(`DELETE FROM categories WHERE LOWER(name) = LOWER(?)`, [trimmed]);
      persistToFile();
    } catch(e) {}
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
      `SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC LIMIT ?`,
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
  },

  // ─── Expense Statements (Analytics) ────────────────────────

  getAllExpenses({ from, to } = {}) {
    let sql = `SELECT * FROM expenses`;
    const params = [];
    if (from && to) {
      sql += ` WHERE expense_date >= ? AND expense_date <= ?`;
      params.push(from, to);
    } else if (from) {
      sql += ` WHERE expense_date >= ?`;
      params.push(from);
    }
    sql += ` ORDER BY expense_date DESC, id DESC`;
    return rowsToObjects(db.exec(sql, params.length ? params : undefined));
  },

  insertExpense({ amount, category, note, expense_date }) {
    db.run(
      `INSERT INTO expenses (amount, category, note, expense_date) VALUES (?, ?, ?, ?)`,
      [amount, category || 'General', note || '', expense_date || new Date().toISOString().split('T')[0]]
    );
    const lastId = db.exec(`SELECT last_insert_rowid() as id`)[0].values[0][0];
    persistToFile();
    return { lastInsertRowid: lastId };
  },

  deleteExpense({ id }) {
    db.run(`DELETE FROM expenses WHERE id = ?`, [id]);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  // Analytics: get all COMPLETED orders in a date range (using business_date offset)
  getCompletedOrdersInRange({ from, to }) {
    const result = db.exec(
      `SELECT * FROM orders WHERE status = 'COMPLETED' AND created_at >= ? AND created_at <= ? ORDER BY created_at ASC`,
      [from, to]
    );
    return rowsToObjects(result).map(o => ({
      ...o,
      items: (() => { try { return JSON.parse(o.items || '[]'); } catch(e) { return []; } })()
    }));
  },

  // Force created_at to the current moment (used for virtual table orders so they
  // always appear under the correct settlement date in history/dashboard)
  updateOrderDateToNow({ id }) {
    db.run(
      `UPDATE orders SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      [id]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  // Update an order's payment_method and grand_total after settlement
  updateOrderPayment({ table_number, payment_method, grand_total, gst_amount, service_charge, tip_amount, bill_number, customer_name, phone }) {
    // Update the most recent COMPLETED order for this table
    db.run(
      `UPDATE orders SET payment_method = ?, grand_total = ?, gst_amount = ?, service_charge = ?, tip_amount = ?, bill_number = ?, customer_name = COALESCE(?, customer_name), phone = COALESCE(?, phone) WHERE table_number = ? AND status = 'COMPLETED' AND id = (SELECT MAX(id) FROM orders WHERE table_number = ? AND status = 'COMPLETED')`,
      [payment_method || 'Unknown', grand_total || 0, gst_amount || 0, service_charge || 0, tip_amount || 0, bill_number || null, customer_name || null, phone || null, String(table_number), String(table_number)]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  // --- Phase 3: Inventory Helpers ---
  getAllInventoryItems() {
    const res = db.exec(`SELECT * FROM inventory_items`);
    return rowsToObjects(res);
  },
  
  insertInventoryItem(name, unit, currentStock, lowStockThreshold, costPerUnit) {
    db.run(
      `INSERT INTO inventory_items (name, unit, current_stock, low_stock_threshold, cost_per_unit) VALUES (?, ?, ?, ?, ?)`,
      [name, unit, currentStock || 0, lowStockThreshold || 0, costPerUnit || 0]
    );
    persistToFile();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
  },

  updateInventoryItem(id, name, unit, currentStock, lowStockThreshold, costPerUnit) {
    db.run(
      `UPDATE inventory_items SET name = ?, unit = ?, current_stock = ?, low_stock_threshold = ?, cost_per_unit = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      [name, unit, currentStock, lowStockThreshold, costPerUnit, id]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  deleteInventoryItem(id) {
    db.run(`DELETE FROM inventory_items WHERE id = ?`, [id]);
    db.run(`DELETE FROM recipes WHERE inventory_item_id = ?`, [id]);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  getAllRecipes() {
    const res = db.exec(`SELECT * FROM recipes`);
    return rowsToObjects(res);
  },

  upsertRecipe(menuItemId, inventoryItemId, quantityRequired) {
    // Delete existing link first to avoid duplicates
    db.run(`DELETE FROM recipes WHERE menu_item_id = ? AND inventory_item_id = ?`, [menuItemId, inventoryItemId]);
    db.run(
      `INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_required) VALUES (?, ?, ?)`,
      [menuItemId, inventoryItemId, quantityRequired]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  removeRecipeItem(menuItemId, inventoryItemId) {
    db.run(`DELETE FROM recipes WHERE menu_item_id = ? AND inventory_item_id = ?`, [menuItemId, inventoryItemId]);
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  logInventoryTransaction(inventoryItemId, changeType, quantity) {
    db.run(
      `INSERT INTO inventory_transactions (inventory_item_id, change_type, quantity) VALUES (?, ?, ?)`,
      [inventoryItemId, changeType, quantity]
    );
    // Also update current stock directly
    let sign = (changeType === 'IN' || changeType === 'ADJUST_UP') ? '+' : '-';
    db.run(
      `UPDATE inventory_items SET current_stock = current_stock ${sign} ? WHERE id = ?`,
      [Math.abs(quantity), inventoryItemId]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  deductInventoryForMenuItem(menuItemId, menuQty) {
    // Find recipe items for this menu item
    const res = db.exec(`SELECT inventory_item_id, quantity_required FROM recipes WHERE menu_item_id = ?`, [menuItemId]);
    const ingredients = rowsToObjects(res);
    if (!ingredients || ingredients.length === 0) return;

    for (const ing of ingredients) {
      const deduction = ing.quantity_required * menuQty;
      statements.logInventoryTransaction(ing.inventory_item_id, 'SALE', deduction);
    }
  },

  // --- KOT Tickets ---
  insertKotTicket(tableNumber, items, status = 'NEW') {
    db.run(
      `INSERT INTO kot_tickets (table_number, items, status) VALUES (?, ?, ?)`,
      [tableNumber || '', JSON.stringify(items), status]
    );
    persistToFile();
    const res = db.exec(`SELECT last_insert_rowid() AS id`);
    return { id: res[0].values[0][0] };
  },

  getKotTickets() {
    // Auto-clear active KOT tickets for tables that are currently vacant/available in DB
    try {
      const allTables = this.getAllTables();
      const vacantTableNumbers = new Set();
      allTables.forEach(t => {
        const status = String(t.status || '').toUpperCase();
        let itemsCount = 0;
        try {
          const parsed = typeof t.order_items === 'string' ? JSON.parse(t.order_items || '[]') : (t.order_items || []);
          itemsCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch(e) {}

        const isVacant = (status === 'AVAILABLE' || status === 'VACANT' || status === 'FREE' || status === '') || itemsCount === 0;
        if (isVacant && t.table_number) {
          const s = String(t.table_number).trim().toUpperCase();
          vacantTableNumbers.add(s);
          const norm = s.replace(/^TABLE\s+/, '').trim();
          vacantTableNumbers.add(norm);
          vacantTableNumbers.add(`TABLE ${norm}`);
        }
      });

      if (vacantTableNumbers.size > 0) {
        const arr = Array.from(vacantTableNumbers);
        const placeholders = arr.map(() => '?').join(',');
        db.run(
          `UPDATE kot_tickets SET status = 'SERVED', updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE UPPER(table_number) IN (${placeholders}) AND status != 'SERVED'`,
          arr
        );
      }
    } catch (e) {
      console.error('Error auto-clearing vacant table KOT tickets:', e);
    }

    const res = db.exec(`SELECT * FROM kot_tickets WHERE status != 'SERVED' ORDER BY created_at ASC`);
    return rowsToObjects(res).map(ticket => ({
      ...ticket,
      items: JSON.parse(ticket.items || '[]')
    }));
  },

  getAllKotTickets() {
    const today = new Date().toISOString().split('T')[0];
    const res = db.exec(`SELECT * FROM kot_tickets WHERE created_at >= '${today}' ORDER BY created_at DESC`);
    return rowsToObjects(res).map(ticket => ({
      ...ticket,
      items: JSON.parse(ticket.items || '[]')
    }));
  },

  getKotStats() {
    const today = new Date().toISOString().split('T')[0];
    const activeRes = db.exec(`SELECT COUNT(*) as c FROM kot_tickets WHERE status NOT IN ('READY','SERVED') AND created_at >= '${today}'`);
    const completedRes = db.exec(`SELECT COUNT(*) as c FROM kot_tickets WHERE status IN ('READY','SERVED') AND created_at >= '${today}'`);
    const active = activeRes.length > 0 ? activeRes[0].values[0][0] : 0;
    const completed = completedRes.length > 0 ? completedRes[0].values[0][0] : 0;
    return { active, completed, total: active + completed };
  },

  updateKotTicketStatus(id, status) {
    db.run(
      `UPDATE kot_tickets SET status = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = ?`,
      [status, id]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  updateKotTicketItems(id, items, derivedStatus) {
    db.run(
      `UPDATE kot_tickets SET items = ?, status = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = ?`,
      [JSON.stringify(items), derivedStatus, id]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  clearTableKotTickets(...identifiers) {
    const ids = new Set();
    identifiers.forEach(val => {
      if (val !== undefined && val !== null && val !== '') {
        const s = String(val).trim().toUpperCase();
        ids.add(s);
        const norm = s.replace(/^TABLE\s+/, '').trim();
        ids.add(norm);
        ids.add(`TABLE ${norm}`);
      }
    });
    if (ids.size === 0) return { changes: 0 };
    const arr = Array.from(ids);
    const placeholders = arr.map(() => '?').join(',');
    db.run(
      `UPDATE kot_tickets SET status = 'SERVED', updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE UPPER(table_number) IN (${placeholders}) AND status != 'SERVED'`,
      arr
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  },

  /** Update table_number on all active KOT tickets for a given old table number */
  updateKotTableNumber(oldTableNumber, newTableNumber) {
    const oldNorm = String(oldTableNumber).trim().toUpperCase();
    const newNorm = String(newTableNumber).trim();
    if (!oldNorm || !newNorm) return { changes: 0 };

    // Match various forms: "A1", "Table A1", etc.
    const oldVariants = new Set();
    oldVariants.add(oldNorm);
    const stripped = oldNorm.replace(/^TABLE\s+/, '').trim();
    oldVariants.add(stripped);
    oldVariants.add(`TABLE ${stripped}`);

    const arr = Array.from(oldVariants);
    const placeholders = arr.map(() => '?').join(',');
    db.run(
      `UPDATE kot_tickets SET table_number = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE UPPER(table_number) IN (${placeholders}) AND status NOT IN ('SERVED')`,
      [newNorm, ...arr]
    );
    persistToFile();
    return { changes: db.getRowsModified() };
  }
};
