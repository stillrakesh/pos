export const MENU_CATEGORIES = ['All', 'Starters', 'Main Course', 'Breads', 'Desserts', 'Beverages'];

export const TABLES = [
    { id: 1, name: 'T1', status: 'available', capacity: 2, x: 50, y: 50 },
    { id: 2, name: 'T2', status: 'occupied', capacity: 4, orderCount: 3, total: 450, x: 200, y: 50 },
    { id: 3, name: 'T3', status: 'occupied', capacity: 2, orderCount: 1, total: 120, x: 350, y: 50 },
    { id: 4, name: 'T4', status: 'available', capacity: 4, x: 50, y: 180 },
    { id: 5, name: 'T5', status: 'billing', capacity: 6, total: 1200, x: 200, y: 180 },
    { id: 6, name: 'T6', status: 'available', capacity: 2, x: 450, y: 180 },
    { id: 7, name: 'T7', status: 'available', capacity: 4, x: 50, y: 310 },
    { id: 8, name: 'T8', status: 'occupied', capacity: 4, total: 800, x: 200, y: 310 },
    { id: 9, name: 'B1', status: 'available', capacity: 1, x: 400, y: 310 },
    { id: 10, name: 'B2', status: 'available', capacity: 1, x: 480, y: 310 },
];

export const MENU_ITEMS = [
    { id: 101, name: 'Paneer Tikka', price: 240, category: 'Starters', description: 'Cottage cheese marinated in spices' },
    { id: 102, name: 'Crispy Corn', price: 180, category: 'Starters', description: 'Deep fried corn with spicy seasoning' },
    { id: 103, name: 'Butter Chicken', price: 380, category: 'Main Course', description: 'Tender chicken in creamy tomato gravy' },
    { id: 104, name: 'Dal Makhani', price: 280, category: 'Main Course', description: 'Black lentils slow cooked overnight' },
    { id: 105, name: 'Butter Naan', price: 60, category: 'Breads', description: 'Refined flour bread with butter' },
    { id: 106, name: 'Garlic Naan', price: 75, category: 'Breads', description: 'Naan topped with garlic and butter' },
    { id: 107, name: 'Gulab Jamun', price: 120, category: 'Desserts', description: 'Sweet milk dumplings in syrup' },
    { id: 108, name: 'Masala Tea', price: 40, category: 'Beverages', description: 'Indian spiced tea' },
    { id: 109, name: 'Mocktail Blue', price: 160, category: 'Beverages', description: 'Refreshing blue citrus drink' },
    { id: 110, name: 'Chicken Biryani', price: 320, category: 'Main Course', description: 'Fragrant rice dish with spiced chicken' },
];
