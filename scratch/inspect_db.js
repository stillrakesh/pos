// Quick diagnostic: check the last 5 COMPLETED orders with their SC/GST values
import initSqlJs from 'sql.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'pos_orders.db');

if (!existsSync(DB_PATH)) { console.log('DB not found at', DB_PATH); process.exit(1); }
const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(DB_PATH));

function rows(result) {
  if (!result || !result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => { const o = {}; columns.forEach((c,i) => o[c] = row[i]); return o; });
}

console.log('\n=== LAST 5 COMPLETED ORDERS (service_charge, gst_amount, grand_total) ===');
const completed = rows(db.exec(`
  SELECT id, table_number, grand_total, service_charge, gst_amount, tip_amount, payment_method, created_at
  FROM orders WHERE status = 'COMPLETED' ORDER BY id DESC LIMIT 5
`));
console.table(completed);

console.log('\n=== TOTAL COUNTS ===');
const counts = rows(db.exec(`
  SELECT status, COUNT(*) as count FROM orders GROUP BY status
`));
console.table(counts);

console.log('\n=== ORDERS WITH SC > 0 ===');
const withSC = rows(db.exec(`
  SELECT id, table_number, grand_total, service_charge, gst_amount, payment_method, created_at
  FROM orders WHERE service_charge > 0 ORDER BY id DESC LIMIT 10
`));
console.table(withSC.length ? withSC : [{ note: 'NONE FOUND - service_charge is always 0' }]);
