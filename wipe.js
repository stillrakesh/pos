import { initDatabase, getDb, forceSave } from './server/db.js';

async function wipeAllOrders() {
  await initDatabase();
  const db = getDb();
  
  console.log('Wiping all old test orders from the database to start fresh...');
  
  db.run(`DELETE FROM orders`);
  const ordersDeleted = db.getRowsModified();
  
  try {
    db.run(`DELETE FROM payments`);
  } catch (e) {
    // payments table might not exist in this version
  }
  
  console.log(`Deleted ${ordersDeleted} old orders.`);
  
  forceSave();
  console.log('Database saved. Data is now completely clean.');
}

wipeAllOrders().catch(console.error);
