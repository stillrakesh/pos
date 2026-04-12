let menuItems = [
  { id: 1, name: 'Paneer Tikka', price: 280, category: 'Starters', isVeg: true, available: true },
  { id: 2, name: 'Chicken 65', price: 320, category: 'Starters', isVeg: false, available: true },
  { id: 3, name: 'Butter Chicken', price: 450, category: 'Main Course', isVeg: false, available: true },
  { id: 4, name: 'Dal Makhani', price: 350, category: 'Main Course', isVeg: true, available: true },
  { id: 5, name: 'Garlic Naan', price: 60, category: 'Breads', isVeg: true, available: true },
  { id: 6, name: 'Jeera Rice', price: 180, category: 'Rice', isVeg: true, available: true },
  { id: 7, name: 'Fresh Lime Soda', price: 120, category: 'Drinks', isVeg: true, available: true },
  { id: 8, name: 'Mango Lassi', price: 150, category: 'Drinks', isVeg: true, available: true }
];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const grouped = {};
    menuItems.filter(i => i.available).forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    return res.status(200).json({
      success: true,
      count: menuItems.length,
      categories: Object.keys(grouped),
      menu: grouped
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
