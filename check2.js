import { initDatabase, getDb } from './server/db.js';

async function checkOrders() {
  await initDatabase();
  const db = getDb();
  
  const result = db.exec(`SELECT count(*) as count FROM orders`);
  if (!result || result.length === 0) {
    console.log("No orders found.");
    return;
  }
  
  console.log(`Total orders in DB: ${result[0].values[0][0]}`);
}

checkOrders().catch(console.error);
