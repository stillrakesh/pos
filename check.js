import { initDatabase, getDb } from './server/db.js';

async function checkOrders() {
  await initDatabase();
  const db = getDb();
  
  const result = db.exec(`SELECT id, status, payment_method, grand_total, items FROM orders WHERE status IN ('COMPLETED', 'completed')`);
  if (!result || result.length === 0) {
    console.log("No completed orders found.");
    return;
  }
  
  const cols = result[0].columns;
  const rows = result[0].values;
  
  console.log(`Found ${rows.length} COMPLETED orders.`);
  rows.forEach(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    console.log(JSON.stringify(obj).slice(0, 150));
  });
}

checkOrders().catch(console.error);
