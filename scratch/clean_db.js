import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'pos_orders.db');

const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(DB_PATH));

// Delete all COMPLETED orders where grand_total is 0 or NULL to fix the duplicate entries
const deleteQuery = `DELETE FROM orders WHERE status = 'COMPLETED' AND (grand_total = 0 OR grand_total IS NULL)`;
db.run(deleteQuery);
const changes = db.getRowsModified();

console.log(`Deleted ${changes} duplicate 0-value completed orders.`);

const buf = db.export();
writeFileSync(DB_PATH, buf);
console.log('Database saved.');
