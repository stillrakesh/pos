import initSqlJs from 'sql.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Production database path on Mac
const DB_PATH = '/Users/apple/Library/Application Support/Restaurant POS/data/pos_orders.db';

console.log(`Checking database at path: ${DB_PATH}`);

if (!existsSync(DB_PATH)) {
  console.log('❌ Production DB not found at that path. Checking local development database instead...');
} else {
  console.log('✅ Found production DB.');
}

const targetPath = existsSync(DB_PATH) ? DB_PATH : join(process.cwd(), 'data', 'pos_orders.db');

const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(targetPath));

function rows(result) {
  if (!result || !result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const o = {};
    columns.forEach((c, i) => o[c] = row[i]);
    return o;
  });
}

console.log('\n=== TOTAL ORDERS BY STATUS ===');
try {
  const counts = rows(db.exec(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`));
  console.table(counts);
} catch (e) {
  console.error('Error fetching status counts:', e.message);
}

console.log('\n=== EARLIEST AND LATEST ORDER DATES ===');
try {
  const dates = rows(db.exec(`SELECT MIN(created_at) as earliest, MAX(created_at) as latest, COUNT(*) as total_orders FROM orders`));
  console.table(dates);
} catch (e) {
  console.error('Error fetching dates:', e.message);
}

console.log('\n=== ORDERS PER DAY (TOP 20 DAYS WITH MOST ORDERS) ===');
try {
  const perDay = rows(db.exec(`
    SELECT DATE(created_at) as date, COUNT(*) as count, SUM(grand_total) as daily_revenue 
    FROM orders 
    GROUP BY DATE(created_at) 
    ORDER BY date DESC 
    LIMIT 20
  `));
  console.table(perDay);
} catch (e) {
  console.error('Error fetching orders per day:', e.message);
}

console.log('\n=== CHECK IF ANY ORDERS OLDER THAN 10 DAYS EXIST ===');
try {
  const olderOrders = rows(db.exec(`
    SELECT id, table_number, status, grand_total, created_at 
    FROM orders 
    WHERE created_at < datetime('now', '-10 days') 
    ORDER BY created_at DESC 
    LIMIT 10
  `));
  if (olderOrders.length > 0) {
    console.log(`Found ${olderOrders.length} orders older than 10 days (showing last 10):`);
    console.table(olderOrders);
  } else {
    console.log('No orders older than 10 days found in this database file.');
  }
} catch (e) {
  console.error('Error checking older orders:', e.message);
}
