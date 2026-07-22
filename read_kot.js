import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

// Check data_dev/pos_orders.db
const dbPath = path.join(process.cwd(), 'data_dev', 'pos_orders.db');
console.log('Reading DB from:', dbPath);

const filebuffer = fs.readFileSync(dbPath);
initSqlJs().then(SQL => {
  const db = new SQL.Database(filebuffer);
  
  // Get latest KOT tickets
  try {
    const res = db.exec("SELECT * FROM kot_tickets ORDER BY id DESC LIMIT 5");
    if (res.length > 0) {
      const columns = res[0].columns;
      const values = res[0].values;
      const rows = values.map(row => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
      console.log("Latest KOT Tickets:");
      console.log(JSON.stringify(rows, null, 2));
    }
  } catch (e) {
    console.error("Failed to query KOT tickets:", e);
  }
});
