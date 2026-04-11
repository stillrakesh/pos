import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, 'pos_orders.db');

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
  insertOrder({ table_number, items, notes, status }) {
    db.run(
      `INSERT INTO orders (table_number, items, notes, status) VALUES (?, ?, ?, ?)`,
      [table_number, items, notes || '', status]
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

  insertTable({ table_number, status }) {
    db.run(
      `INSERT INTO tables (table_number, status) VALUES (?, ?)`,
      [table_number, status || 'AVAILABLE']
    );
    const lastId = db.exec(`SELECT last_insert_rowid() as id`)[0].values[0][0];
    persistToFile();
    return { lastInsertRowid: lastId };
  },

  updateTable({ id, table_number, status }) {
    const setClauses = [];
    const params = [];
    if (table_number !== undefined) { setClauses.push('table_number = ?'); params.push(table_number); }
    if (status !== undefined) { setClauses.push('status = ?'); params.push(status); }
    if (setClauses.length === 0) return { changes: 0 };
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
  }
};
