import { initDatabase, getDb, forceSave } from './server/db.js';

async function purgeZeroRevenueOrders() {
  await initDatabase();
  const db = getDb();
  
  console.log('Running cleanup query to delete COMPLETED orders with 0 grand_total...');
  
  db.run(`
    DELETE FROM orders 
    WHERE status IN ('COMPLETED', 'completed') 
    AND (grand_total IS NULL OR grand_total = 0 OR grand_total = '0')
  `);
  
  const changes = db.getRowsModified();
  console.log(`Deleted ${changes} zero-revenue ghost orders.`);
  
  forceSave();
  console.log('Database saved.');
}

purgeZeroRevenueOrders().catch(console.error);
