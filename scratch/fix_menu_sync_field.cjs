const fs = require('fs');

const filePath = 'c:\\Users\\mrrak\\Desktop\\restaurant-pos\\server\\routes\\menu.js';
let content = fs.readFileSync(filePath, 'utf8');

// The POS sends { items: menuItems, categories }
// My current code: if (menuItems && Array.isArray(menuItems))
// Fix: if (items && Array.isArray(items))

const oldPost = `    const { menuItems, name, category, price, available } = req.body;

    // BULK MENU SYNC
    if (menuItems && Array.isArray(menuItems)) {
      menuItems.forEach(mi => {`;

const newPost = `    const { items, name, category, price, available } = req.body;

    // BULK MENU SYNC
    if (items && Array.isArray(items)) {
      items.forEach(mi => {`;

content = content.replace(oldPost, newPost);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Menu Bulk Sync Logic Corrected (items vs menuItems)');
