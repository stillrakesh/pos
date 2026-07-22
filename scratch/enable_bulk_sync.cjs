const fs = require('fs');

const filePath = 'c:\\Users\\mrrak\\Desktop\\restaurant-pos\\server\\routes\\tables.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldPost = `router.post('/', (req, res) => {
  try {
    const { table_number, status } = req.body;

    if (!table_number && table_number !== 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'table_number is required' 
      });
    }

    if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: \`status must be one of: \${VALID_STATUSES.join(', ')}\` 
      });
    }

    const result = statements.insertTable({
      table_number: String(table_number),
      status: status ? status.toUpperCase() : 'AVAILABLE'
    });

    const table = statements.getTableById({ id: result.lastInsertRowid });

    res.status(201).json({
      success: true,
      table
    });
  } catch (err) {`;

const newPost = `router.post('/', (req, res) => {
  try {
    const { tables, table_number, status } = req.body;

    // BULK SYNC LOGIC (Called by POS on every state change)
    if (tables && Array.isArray(tables)) {
      tables.forEach(t => {
        const table_num = String(t.table_number || t.name || '').replace('Table ', '');
        const stat = t.status || 'AVAILABLE';
        const items = t.order_items || '[]';
        
        // Find if table exists
        const all = statements.getAllTables();
        const existing = all.find(et => String(et.table_number) === table_num);
        
        if (existing) {
          statements.updateTable({
            id: existing.id,
            status: stat.toUpperCase(),
            order_items: items
          });
        } else {
          statements.insertTable({
            table_number: table_num,
            status: stat.toUpperCase(),
            order_items: items
          });
        }
      });
      return res.json({ success: true, message: 'Bulk sync complete' });
    }

    // SINGLE TABLE ADD LOGIC
    if (!table_number && table_number !== 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'table_number is required' 
      });
    }

    if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: \`status must be one of: \${VALID_STATUSES.join(', ')}\` 
      });
    }

    const result = statements.insertTable({
      table_number: String(table_number),
      status: status ? status.toUpperCase() : 'AVAILABLE'
    });

    const table = statements.getTableById({ id: result.lastInsertRowid });

    res.status(201).json({
      success: true,
      table
    });
  } catch (err) {`;

content = content.replace(oldPost, newPost);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Bulk Table Sync Enabled');
