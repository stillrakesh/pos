const fs = require('fs');

const filePath = 'c:\\Users\\mrrak\\Desktop\\restaurant-pos\\server\\routes\\menu.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldPost = `router.post('/', (req, res) => {
  try {
    const { name, category, price, available } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'name is required and must be a non-empty string' 
      });
    }

    if (price == null || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'price is required and must be a non-negative number' 
      });
    }

    const result = statements.insertMenuItem({
      name: name.trim(),
      category: category ? category.trim() : 'Uncategorised',
      price,
      available
    });

    const item = statements.getMenuById({ id: result.lastInsertRowid });
    if (item) item.available = item.available === 1;

    res.status(201).json({
      success: true,
      item
    });
  } catch (err) {`;

const newPost = `router.post('/', (req, res) => {
  try {
    const { menuItems, name, category, price, available } = req.body;

    // BULK MENU SYNC
    if (menuItems && Array.isArray(menuItems)) {
      menuItems.forEach(mi => {
        const itemName = mi.name?.trim();
        const itemCat = (mi.category || mi.cat || 'Uncategorised').trim();
        const itemPrice = parseFloat(mi.price) || 0;
        
        // Find if exists by name (menu items usually unique by name/cat)
        const all = statements.getAllMenu();
        const existing = all.find(e => e.name === itemName);
        
        if (existing) {
          statements.updateMenuItem({
            id: existing.id,
            category: itemCat,
            price: itemPrice,
            available: mi.available !== false
          });
        } else {
          statements.insertMenuItem({
            name: itemName,
            category: itemCat,
            price: itemPrice,
            available: mi.available !== false
          });
        }
      });
      return res.json({ success: true, message: 'Menu bulk sync complete' });
    }

    // SINGLE ITEM ADD
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'name is required and must be a non-empty string' 
      });
    }

    if (price == null || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'price is required and must be a non-negative number' 
      });
    }

    const result = statements.insertMenuItem({
      name: name.trim(),
      category: category ? category.trim() : 'Uncategorised',
      price,
      available
    });

    const item = statements.getMenuById({ id: result.lastInsertRowid });
    if (item) item.available = item.available === 1;

    res.status(201).json({
      success: true,
      item
    });
  } catch (err) {`;

content = content.replace(oldPost, newPost);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Menu Bulk Sync Enabled');
