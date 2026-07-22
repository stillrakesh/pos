import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'pos_orders.db');

const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(DB_PATH));

function rows(result) {
  if (!result || !result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => { const o = {}; columns.forEach((c,i) => o[c] = row[i]); return o; });
}

console.log('\n=== LAST 10 COMPLETED ORDERS ===');
const completed = rows(db.exec(`
  SELECT id, table_number, grand_total, status, created_at, length(items) as items_len 
  FROM orders 
  ORDER BY id DESC LIMIT 10
`));
console.table(completed);
