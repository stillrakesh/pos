const fs = require('fs');

const filePath = 'c:\\Users\\mrrak\\Desktop\\restaurant-pos\\server\\routes\\tables.js';
let content = fs.readFileSync(filePath, 'utf8');

// Update GET / to parse JSON
content = content.replace(
  'const tables = statements.getAllTables();',
  'const tables = statements.getAllTables().map(t => {\n      try { t.order_items = JSON.parse(t.order_items); } catch(e) { t.order_items = []; }\n      return t;\n    });'
);

// Update PUT to handle order_items
const oldPut = `    const { table_number, status } = req.body;

    if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: \`status must be one of: \${VALID_STATUSES.join(', ')}\` 
      });
    }

    statements.updateTable({
      id,
      table_number: table_number !== undefined ? String(table_number) : undefined,
      status: status ? status.toUpperCase() : undefined
    });

    const updated = statements.getTableById({ id });

    res.json({
      success: true,
      table: updated
    });`;

const newPut = `    const { table_number, status, order_items } = req.body;

    if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: \`status must be one of: \${VALID_STATUSES.join(', ')}\` 
      });
    }

    statements.updateTable({
      id,
      table_number: table_number !== undefined ? String(table_number) : undefined,
      status: status ? status.toUpperCase() : undefined,
      order_items: order_items !== undefined ? (typeof order_items === 'string' ? order_items : JSON.stringify(order_items)) : undefined
    });

    const updated = statements.getTableById({ id });
    if (updated && updated.order_items) {
      try { updated.order_items = JSON.parse(updated.order_items); } catch(e) { updated.order_items = []; }
    }

    res.json({
      success: true,
      table: updated
    });`;

content = content.replace(oldPut, newPut);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Tables Route Updated');
