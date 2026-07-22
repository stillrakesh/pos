import initSqlJs from 'sql.js';
(async () => {
  try {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    console.log('✅ sql.js works!');
    process.exit(0);
  } catch (err) {
    console.error('❌ sql.js failed:', err);
    process.exit(1);
  }
})();
