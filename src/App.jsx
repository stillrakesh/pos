import React, { useState, useEffect } from 'react';
import {
  Menu, Search, Store, Monitor, LayoutGrid, Clock, Bell, User,
  ChevronDown, ChevronUp, Info, CreditCard, Banknote, Printer, Eye, Plus,
  Minus, X, Utensils, Smartphone, BarChart3, TrendingUp, PieChart, AlertTriangle, Truck, ShoppingBag, ChefHat, MessageSquare, CheckSquare, Sunset, Trash2, Package
} from 'lucide-react';
import './index.css';
import { get, set } from 'idb-keyval';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
import * as XLSX from 'xlsx';
// --- INITIAL MOCK DATA ---
const MENU_VERSION = '2';

const GlobalStyles = ({ settings }) => {
  const primaryColor = settings?.accentColor || '#a3112a';
  const secondaryColor = settings?.secondaryColor || '#7c3aed';
  const bgColor = settings?.bgColor || '#f9fafb';
  const textColor = settings?.textColor || '#1f2937';
  const radius = settings?.borderRadius || '12';
  const font = settings?.globalFont || 'Outfit';
  const baseWeight = settings?.fontBaseWeight || 'normal';
  const baseSize = settings?.fontBaseSize || '14';

  const tableShape = settings?.tableShape || 'rounded';
  let tableRadius = '16px';
  if (tableShape === 'square') tableRadius = '4px';
  if (tableShape === 'circle') tableRadius = '50%';

  return (
    <style>{`
      :root {
        --primary: ${primaryColor};
        --primary-hover: ${primaryColor}dd;
        --secondary: ${secondaryColor};
        --bg-color: ${bgColor};
        --text-color: ${textColor};
        --radius-sm: ${radius / 2}px;
        --radius-md: ${radius}px;
        --radius-lg: ${radius * 1.5}px;
        --table-radius: ${tableRadius};
      }
      * {
        font-family: '${font}', 'Inter', system-ui, sans-serif !important;
      }
      body {
        margin: 0;
        background-color: var(--bg-color);
        color: var(--text-color);
        font-weight: ${baseWeight};
        font-size: ${baseSize}px;
      }
      .btn-pp, .pp-table-card, .item-card, .billing-panel, .billing-tab, .payment-chip, .btn-maroon, .btn-grey {
        border-radius: var(--radius-md) !important;
      }
      .pp-table-card:hover, .item-card:hover {
        border-color: var(--primary) !important;
      }
      .billing-tab.active, .btn-pp-primary, .btn-maroon {
        background: var(--primary) !important;
        color: white !important;
      }
      .payment-chip.selected {
        border-color: var(--primary) !important;
        color: var(--primary) !important;
      }
      .view-container {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        background: var(--bg-color);
      }
    `}</style>
  );
};

const INITIAL_PRODUCT_CATEGORIES = [
  "🥤 Mixers & Refreshers",
  "🍺 Premium Beers (500 ml)",
  "🍸 Vodka",
  "🦌 Herbal Liqueur",
  "🥃 Premium Whisky",
  "🍹 Signature Cocktails"
];

const INITIAL_PRODUCTS = [
  // Mixers & Refreshers
  { id: 9001, name: 'Soda', price: 29, cat: "🥤 Mixers & Refreshers", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9002, name: 'Sprite', price: 39, cat: "🥤 Mixers & Refreshers", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9003, name: 'Thums Up', price: 39, cat: "🥤 Mixers & Refreshers", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9004, name: 'Packaged Drinking Water', price: 49, cat: "🥤 Mixers & Refreshers", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9005, name: 'Red Bull', price: 249, cat: "🥤 Mixers & Refreshers", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9006, name: 'Ginger Ale', price: 79, cat: "🥤 Mixers & Refreshers", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9007, name: 'Tonic Water', price: 79, cat: "🥤 Mixers & Refreshers", type: 'retail', stockQuantity: 100, inStock: true },

  // Premium Beers
  { id: 9101, name: 'Budweiser', price: 399, cat: "🍺 Premium Beers (500 ml)", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9102, name: 'Kingfisher Ultra', price: 349, cat: "🍺 Premium Beers (500 ml)", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9103, name: 'Tuborg Mild', price: 349, cat: "🍺 Premium Beers (500 ml)", type: 'retail', stockQuantity: 100, inStock: true },

  // Vodka
  { id: 9201, name: 'Smirnoff 30ml', price: 169, cat: "🍸 Vodka", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9202, name: 'Smirnoff 60ml', price: 279, cat: "🍸 Vodka", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9203, name: 'Smirnoff 180ml', price: 919, cat: "🍸 Vodka", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9204, name: 'Smirnoff Quart', price: 3199, cat: "🍸 Vodka", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9205, name: 'Smirnoff Jamun 30ml', price: 179, cat: "🍸 Vodka", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9206, name: 'Smirnoff Jamun 60ml', price: 289, cat: "🍸 Vodka", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9207, name: 'Smirnoff Jamun 180ml', price: 929, cat: "🍸 Vodka", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9208, name: 'Smirnoff Jamun Quart', price: 3229, cat: "🍸 Vodka", type: 'retail', stockQuantity: 100, inStock: true },

  // Herbal Liqueur
  { id: 9301, name: 'Jägermeister 30ml', price: 499, cat: "🦌 Herbal Liqueur", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9302, name: 'Jägerbomb', price: 599, cat: "🦌 Herbal Liqueur", type: 'retail', stockQuantity: 100, inStock: true },

  // Whisky
  { id: 9401, name: 'Oaksmith Gold 30ml', price: 149, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9402, name: 'Oaksmith Gold 60ml', price: 299, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9403, name: 'Oaksmith Gold 180ml', price: 849, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9404, name: 'Oaksmith Gold 750ml', price: 3599, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9405, name: 'Blenders Pride 30ml', price: 149, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9406, name: 'Blenders Pride 60ml', price: 299, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9407, name: 'Blenders Pride 180ml', price: 849, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9408, name: 'Blenders Pride 750ml', price: 3599, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9409, name: 'JW Red Label 30ml', price: 349, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9410, name: 'JW Red Label 60ml', price: 499, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9411, name: 'JW Red Label 750ml', price: 4999, cat: "🥃 Premium Whisky", type: 'retail', stockQuantity: 100, inStock: true },

  // Signature Cocktails
  { id: 9501, name: 'Blue Lagoon', price: 349, cat: "🍹 Signature Cocktails", type: 'retail', stockQuantity: 100, inStock: true },
  { id: 9502, name: 'Old Fashioned', price: 399, cat: "🍹 Signature Cocktails", type: 'retail', stockQuantity: 100, inStock: true }
];

const INITIAL_CATEGORIES = [
  "Quick Snacks", "Breads", "Burgers", "Pizzas", "Wraps", "Pastas",
  "Hot Beverages", "Cold Beverages", "Mocktails", "Salads", "Desserts"
];

const INITIAL_MENU_ITEMS = [
  // Quick Snacks
  { id: 101, name: 'Salted Fries', price: 199, type: 'veg', cat: "Quick Snacks", inStock: true },
  { id: 102, name: 'Peri Peri Fries', price: 229, type: 'veg', cat: "Quick Snacks", inStock: true },
  { id: 103, name: 'Cheesy Fries', price: 249, type: 'veg', cat: "Quick Snacks", inStock: true },
  { id: 104, name: 'Mozzarella Sticks', price: 249, type: 'veg', cat: "Quick Snacks", inStock: true },
  { id: 105, name: 'Veg Fingers', price: 249, type: 'veg', cat: "Quick Snacks", inStock: true },
  { id: 106, name: 'Chicken Popcorn', price: 349, type: 'non-veg', cat: "Quick Snacks", inStock: true },
  { id: 107, name: 'Chicken Strips (8pc)', price: 399, type: 'non-veg', cat: "Quick Snacks", inStock: true },
  { id: 108, name: 'Chicken Nuggets (8pc)', price: 339, type: 'non-veg', cat: "Quick Snacks", inStock: true },
  { id: 109, name: 'Chicken Lolipop', price: 409, type: 'non-veg', cat: "Quick Snacks", inStock: true },

  // Breads
  { id: 201, name: 'Cheese Garlic Bread', price: 249, type: 'veg', cat: "Breads", inStock: true },
  { id: 202, name: 'Sweet Corn Garlic Bread', price: 269, type: 'veg', cat: "Breads", inStock: true },
  { id: 203, name: 'Spicy Garlic Bread', price: 279, type: 'veg', cat: "Breads", inStock: true },
  { id: 204, name: 'Bruschetta Garlic Bread', price: 299, type: 'veg', cat: "Breads", inStock: true },

  // Burgers
  { id: 301, name: 'Veg Classic', price: 239, type: 'veg', cat: "Burgers", inStock: true },
  { id: 302, name: 'Veg Panner Crispy', price: 259, type: 'veg', cat: "Burgers", inStock: true },
  { id: 303, name: 'Chicken Classic', price: 259, type: 'non-veg', cat: "Burgers", inStock: true },
  { id: 304, name: 'Chicken Crispy', price: 289, type: 'non-veg', cat: "Burgers", inStock: true },

  // Pizzas
  { id: 401, name: 'Margarita', price: 399, type: 'veg', cat: "Pizzas", inStock: true },
  { id: 402, name: 'Simply Veggie', price: 419, type: 'veg', cat: "Pizzas", inStock: true },
  { id: 403, name: 'Farm Veggies', price: 429, type: 'veg', cat: "Pizzas", inStock: true },
  { id: 404, name: 'Peri Peri Panner', price: 459, type: 'veg', cat: "Pizzas", inStock: true },
  { id: 405, name: 'Tandoori Paneer', price: 499, type: 'veg', cat: "Pizzas", inStock: true },
  { id: 406, name: 'Veg Extravaganza', price: 559, type: 'veg', cat: "Pizzas", inStock: true },
  { id: 407, name: 'Chicken Sausages', price: 399, type: 'non-veg', cat: "Pizzas", inStock: true },
  { id: 408, name: 'Simply Chicken', price: 429, type: 'non-veg', cat: "Pizzas", inStock: true },
  { id: 409, name: 'BBQ Chicken', price: 449, type: 'non-veg', cat: "Pizzas", inStock: true },
  { id: 410, name: 'Peri Peri Chicken', price: 469, type: 'non-veg', cat: "Pizzas", inStock: true },
  { id: 411, name: 'Tandoori Chicken', price: 489, type: 'non-veg', cat: "Pizzas", inStock: true },
  { id: 412, name: 'Chicken Loaded', price: 559, type: 'non-veg', cat: "Pizzas", inStock: true },

  // Wraps
  { id: 501, name: 'Veggie delight', price: 299, type: 'veg', cat: "Wraps", inStock: true },
  { id: 502, name: 'Panner Warp', price: 319, type: 'veg', cat: "Wraps", inStock: true },
  { id: 503, name: 'Tandoori Panner Wrap', price: 349, type: 'veg', cat: "Wraps", inStock: true },
  { id: 504, name: 'Chicken Delight', price: 389, type: 'non-veg', cat: "Wraps", inStock: true },
  { id: 505, name: 'Chicken Loaded', price: 399, type: 'non-veg', cat: "Wraps", inStock: true },

  // Pastas
  { id: 601, name: 'Alfredo (White Sauce) Veg', price: 389, type: 'veg', cat: "Pastas", inStock: true },
  { id: 602, name: 'Alfredo (White Sauce) Nonveg', price: 399, type: 'non-veg', cat: "Pastas", inStock: true },
  { id: 603, name: 'Arrabiata (Red Sauce) Veg', price: 399, type: 'veg', cat: "Pastas", inStock: true },
  { id: 604, name: 'Arrabiata (Red Sauce) Nonveg', price: 419, type: 'non-veg', cat: "Pastas", inStock: true },
  { id: 605, name: 'Pink Sauce Veg', price: 439, type: 'veg', cat: "Pastas", inStock: true },
  { id: 606, name: 'Pink Sauce Nonveg', price: 459, type: 'non-veg', cat: "Pastas", inStock: true },

  // Hot Beverages
  { id: 701, name: 'Garam Chai', price: 99, type: 'veg', cat: "Hot Beverages", inStock: true },
  { id: 702, name: 'Regular Hot Coffee', price: 119, type: 'veg', cat: "Hot Beverages", inStock: true },
  { id: 703, name: 'Hot Turmeric Tea', price: 119, type: 'veg', cat: "Hot Beverages", inStock: true },
  { id: 704, name: 'Lemon Tea', price: 99, type: 'veg', cat: "Hot Beverages", inStock: true },
  { id: 705, name: 'Black Coffee', price: 99, type: 'veg', cat: "Hot Beverages", inStock: true },
  { id: 706, name: 'Green Tea', price: 99, type: 'veg', cat: "Hot Beverages", inStock: true },
  { id: 707, name: 'Strawberry Green Tea', price: 109, type: 'veg', cat: "Hot Beverages", inStock: true },
  { id: 708, name: 'Butterfly Tea', price: 119, type: 'veg', cat: "Hot Beverages", inStock: true },

  // Cold Beverages
  { id: 801, name: 'Cold Coffee', price: 199, type: 'veg', cat: "Cold Beverages", inStock: true },
  { id: 802, name: 'Caramel Cold Coffee', price: 219, type: 'veg', cat: "Cold Beverages", inStock: true },
  { id: 803, name: 'Lemon Ice Tea', price: 229, type: 'veg', cat: "Cold Beverages", inStock: true },
  { id: 804, name: 'Peach Ice tea', price: 209, type: 'veg', cat: "Cold Beverages", inStock: true },
  { id: 805, name: 'Vanilla Milkshake', price: 219, type: 'veg', cat: "Cold Beverages", inStock: true },
  { id: 806, name: 'Strawberry Milkshake', price: 219, type: 'veg', cat: "Cold Beverages", inStock: true },
  { id: 807, name: 'Cookie Delite Milkshake', price: 229, type: 'veg', cat: "Cold Beverages", inStock: true },
  { id: 808, name: 'Seasonal Fruit Juice', price: 249, type: 'veg', cat: "Cold Beverages", inStock: true },
  { id: 809, name: 'Protein Cold Coffee', price: 299, type: 'veg', cat: "Cold Beverages", inStock: true },
  { id: 810, name: 'Protein Chocolate Shake', price: 299, type: 'veg', cat: "Cold Beverages", inStock: true },

  // Mocktails
  { id: 901, name: 'Mint Mojito', price: 249, type: 'veg', cat: 'Mocktails', inStock: true },
  { id: 902, name: 'Chili Guava', price: 259, type: 'veg', cat: 'Mocktails', inStock: true },
  { id: 903, name: 'Minty Peach', price: 259, type: 'veg', cat: 'Mocktails', inStock: true },
  { id: 904, name: 'Minty Watermelon', price: 259, type: 'veg', cat: 'Mocktails', inStock: true },

  // Salads
  { id: 1001, name: 'Paneer Peri Peri Salad', price: 309, type: 'veg', cat: "Salads", inStock: true },
  { id: 1002, name: 'Tandoori Chicken Salad', price: 369, type: 'non-veg', cat: "Salads", inStock: true },
  { id: 1003, name: 'Extra Chicken Salad', price: 399, type: 'non-veg', cat: "Salads", inStock: true },

  // Desserts
  { id: 1100, name: 'Hot Chocolate', price: 289, type: 'veg', cat: 'Desserts', inStock: true },
  { id: 1101, name: 'Chocolate with Brownie', price: 299, type: 'veg', cat: 'Desserts', inStock: true },
];

const INITIAL_FLOOR_SECTIONS = ['A/C', 'Non A/C'];

const INITIAL_TABLES = [
  { id: 1, name: 'Table 1', status: 'blank', type: 'A/C', order: [], pos: { x: 50, y: 50 } },
  { id: 2, name: 'Table 2', status: 'blank', type: 'A/C', order: [], pos: { x: 200, y: 50 } },
  { id: 3, name: 'Table 3', status: 'blank', type: 'A/C', order: [], pos: { x: 350, y: 50 } },
  { id: 4, name: 'Table 4', status: 'blank', type: 'A/C', order: [], pos: { x: 50, y: 180 } },
  { id: 5, name: 'Table 5', status: 'blank', type: 'A/C', order: [], pos: { x: 200, y: 180 } },
  { id: 8, name: 'Table 8', status: 'blank', type: 'A/C', order: [], pos: { x: 350, y: 180 } },
  { id: 9, name: 'Table 9', status: 'blank', type: 'A/C', order: [], pos: { x: 500, y: 50 } },
  { id: 12, name: 'Table 12', status: 'blank', type: 'A/C', order: [], pos: { x: 500, y: 180 } },
  { id: 14, name: 'Table 14', status: 'blank', type: 'A/C', order: [], pos: { x: 50, y: 310 } },
  { id: 102, name: 'Table 2', status: 'blank', type: 'Non A/C', order: [], pos: { x: 200, y: 50 } },
];

// --- COMPONENTS ---

const AppSidebar = ({ activeView, onViewChange }) => {
  const menuGroups = [
    {
      title: 'Daily Operations',
      items: [
        { id: 'analytics', label: 'Dashboard', icon: Monitor },
        { id: 'tables', label: 'Running Orders', icon: Clock },
        { id: 'orderhistory', label: 'All Orders', icon: ShoppingBag },
        { id: 'nontables', label: 'Online Orders', icon: Smartphone },
        { id: 'kds', label: 'KOT', icon: Utensils },
        { id: 'dayclose', label: 'Due Payment Settlement', icon: Banknote },
        { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
      ]
    },
    {
      title: 'Management',
      items: [
        { id: 'menusetup', label: 'Menu', icon: Menu },
        { id: 'productsetup', label: 'Inventory', icon: Package },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'crm', label: 'CRM', icon: User },
        { id: 'globalsettings', label: 'Settings', icon: LayoutGrid },
      ]
    }
  ];

  return (
    <div className="no-print" style={{ width: '220px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0 }}>
      {/* Brand */}
      <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ background: '#94161c', color: 'white', padding: '8px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(148, 22, 28, 0.2)' }}>
          <Store size={20} />
        </div>
        <div style={{ fontWeight: '950', fontSize: '18px', color: '#1e293b', letterSpacing: '-0.5px' }}>PETPOOJA</div>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {menuGroups.map((group, idx) => (
          <div key={idx} style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '12px' }}>{group.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px',
                    border: 'none', background: activeView === item.id ? '#fef2f2' : 'transparent',
                    color: activeView === item.id ? '#94161c' : '#64748b',
                    cursor: 'pointer', transition: 'all 0.2s', fontWeight: activeView === item.id ? '900' : '700', fontSize: '13px', textAlign: 'left'
                  }}
                >
                  <item.icon size={18} style={{ opacity: activeView === item.id ? 1 : 0.6 }} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AppTopNavbar = ({ onSimulateAggregator, globalSearch, onSearchChange, onToggleSidebar, onViewChange }) => (
  <div className="no-print" style={{ height: '70px', background: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 24px', position: 'sticky', top: 0, zIndex: 1000, gap: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <button onClick={onToggleSidebar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#1f2937' }}><Menu size={24} /></button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ background: '#94161c', color: 'white', padding: '4px 8px', borderRadius: '4px', fontWeight: '900', fontSize: '12px' }}>TYDE</div>
        <span style={{ fontWeight: '950', fontSize: '16px', color: '#1f2937', letterSpacing: '0.5px' }}>CAFE</span>
      </div>
    </div>

    <button onClick={() => onViewChange('tables')} style={{ background: '#94161c', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>New Order</button>

    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
      {/* Removed Online Sync Button */}

      
      <div style={{ background: '#f8fafc', padding: '10px 18px', borderRadius: '14px', border: '1px solid #e2e8f0', flex: 1, display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
        <Search size={18} color="#94a3b8" />
        <input 
          type="text" 
          placeholder="Smart Search (Order ID, Customer, Table, Products...)" 
          value={globalSearch}
          onChange={e => onSearchChange(e.target.value)}
          style={{ background: 'transparent', border: 'none', fontSize: '14px', width: '100%', outline: 'none', fontWeight: '500' }} 
        />
      </div>
    </div>
    
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <button 
        onClick={() => onViewChange('tables')} 
        style={{ border: '2px solid #94161c', color: '#94161c', background: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
      >
        <LayoutGrid size={18} /> TABLE ORDER
      </button>
      <button 
        onClick={() => onViewChange('nontables')} 
        style={{ border: 'none', background: '#94161c', color: 'white', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
      >
        <ShoppingBag size={18} /> PICK UP ORDER
      </button>

      <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid #f1f5f9', paddingLeft: '16px' }}>
        <div onClick={() => onViewChange('dayclose')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer', padding: '0 4px' }}>
          <Sunset size={18} color="#64748b" />
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b' }}>Day Close</span>
        </div>
        <div onClick={() => onViewChange('analytics')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer', padding: '0 4px' }}>
          <BarChart3 size={18} color="#64748b" />
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b' }}>Reports</span>
        </div>
        <div onClick={() => onViewChange('kds')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer', padding: '0 4px' }}>
          <ChefHat size={18} color="#64748b" />
          <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#64748b' }}>Kitchen</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid #f1f5f9', paddingLeft: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: '950', color: '#94161c' }}>Call for Support</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937' }}>+91 8652475772</div>
        </div>
        <User size={24} color="#64748b" style={{ cursor: 'pointer' }} />
      </div>
    </div>
  </div>
);

/* --- ORDER HISTORY VIEW --- */
const OrderHistoryView = ({ orderHistory, activePickups = [], onSelectActive, globalSearch, tables = [] }) => {
  const [viewMode, setViewMode] = useState('card'); // 'card', 'table', 'compact'
  const [localSearch, setLocalSearch] = useState('');

  const searchVal = globalSearch || localSearch;

  const allOrders = [
    ...tables.filter(t => t.order && t.order.length > 0).map(t => ({ 
      ...t, 
      isActive: true, 
      tableId: t.name || t.id, 
      type: 'Dine In',
      timestamp: t.createdAt || Date.now()
    })),
    ...activePickups.map(o => ({ 
      ...o, 
      isActive: true, 
      type: o.type || 'Pickup',
      timestamp: o.createdAt || Date.now()
    })),
    ...orderHistory.map(o => ({ ...o, isActive: false }))
  ].filter(o => {
    if (!searchVal) return true;
    const s = searchVal.toLowerCase();
    const items = (o.order || o.cart || []);
    return (o.id && String(o.id).toLowerCase().includes(s)) ||
           (o.customerName && String(o.customerName).toLowerCase().includes(s)) ||
           (o.phone && String(o.phone).includes(s)) ||
           (o.tableId && String(o.tableId).toLowerCase().includes(s)) ||
           (items.some(item => (item.name || '').toLowerCase().includes(s)));
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const getOrderTotal = (order) => {
    if (order.grandTotal) return order.grandTotal;
    return (order.cart || order.order || []).reduce((acc, i) => acc + (i.price * i.qty), 0);
  };

  const stats = {
    revenue: orderHistory.reduce((acc, o) => acc + o.grandTotal, 0),
    active: activePickups.length,
    avg: orderHistory.length > 0 ? (orderHistory.reduce((acc, o) => acc + o.grandTotal, 0) / orderHistory.length).toFixed(0) : 0
  };

  const handleExportExcel = () => {
    if (orderHistory.length === 0) {
      alert("No data available to export.");
      return;
    }

    const data = orderHistory.map(order => ({
      'Date': new Date(order.timestamp).toLocaleDateString(),
      'Time': new Date(order.timestamp).toLocaleTimeString(),
      'Order ID': order.id,
      'Table/Type': order.tableId,
      'Customer Name': order.customerName || 'N/A',
      'Phone': order.phone || 'N/A',
      'Subtotal': order.subtotal || 0,
      'Discount': order.discountAmt || 0,
      'Loyalty Redeemed': order.redeemedPoints || 0,
      'Service Charge': order.serviceCharge || 0,
      'Grand Total': order.grandTotal,
      'Payment Method': order.paymentMethod,
      'Note': order.note || '',
      'Items Sold': order.cart.map(i => `${i.name} (x${i.qty})`).join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

    // Formatting: Set column widths for better readability
    const wscols = [
      { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
      { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
      { wch: 30 }, { wch: 60 }
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `TydeCafe_Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '48px', background: '#fcfcfd' }} className="animate-fade-in no-scrollbar">
      {/* Premium Dashboard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--primary)' }}></div>
            <span style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Operational Intelligence</span>
          </div>
          <h2 style={{ fontSize: '42px', fontWeight: '950', color: '#0f172a', letterSpacing: '-1.5px', lineHeight: '1', display: 'flex', alignItems: 'center', gap: '20px' }}>
            Transaction <span style={{ color: 'var(--primary)', fontStyle: 'italic' }}>Archive</span>
            <button
              onClick={handleExportExcel}
              style={{
                fontSize: '13px', fontWeight: '800', padding: '12px 24px', borderRadius: '14px',
                background: '#10b981', color: 'white', border: 'none', cursor: 'pointer',
                boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <TrendingUp size={16} /> Export Excel report
            </button>
          </h2>

          {/* VIEW SWITCHER */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '24px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
            {[
              { id: 'card', label: 'Cards', icon: LayoutGrid },
              { id: 'table', label: 'Detailed List', icon: Menu },
              { id: 'compact', label: 'Compact', icon: LayoutGrid }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px',
                  border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', transition: 'all 0.2s',
                  background: viewMode === mode.id ? 'white' : 'transparent',
                  color: viewMode === mode.id ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === mode.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <mode.icon size={14} /> {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ background: 'white', padding: '20px 28px', borderRadius: '24px', boxShadow: '0 20px 30px -10px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Net Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: '950', color: '#0f172a' }}>₹{stats.revenue.toLocaleString()}</div>
          </div>
          <div style={{ background: 'white', padding: '20px 28px', borderRadius: '24px', boxShadow: '0 20px 30px -10px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Ticket Avg</div>
            <div style={{ fontSize: '28px', fontWeight: '950', color: '#0f172a' }}>₹{stats.avg}</div>
          </div>
          {stats.active > 0 && (
            <div style={{ background: 'var(--primary)', padding: '20px 28px', borderRadius: '24px', boxShadow: '0 20px 30px -10px rgba(163, 17, 42, 0.3)', color: 'white' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Live Track</div>
              <div style={{ fontSize: '28px', fontWeight: '950' }}>{stats.active}</div>
            </div>
          )}
        </div>
      </div>

      {allOrders.length === 0 ? (
        <div style={{ padding: '120px 20px', textAlign: 'center' }}>
          <div style={{ width: '100px', height: '100px', background: '#f8fafc', borderRadius: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', border: '1px solid #e2e8f0', transform: 'rotate(-5deg)' }}>
            <ShoppingBag size={40} color="#cbd5e1" />
          </div>
          <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b' }}>No transactions recorded</h3>
          <p style={{ color: '#64748b', fontSize: '16px', marginTop: '12px', maxWidth: '400px', margin: '12px auto' }}>Your transaction ledger is currently empty.</p>
        </div>
      ) : (
        <div style={{
          display: viewMode === 'card' ? 'grid' : 'flex',
          flexDirection: viewMode === 'card' ? 'initial' : 'column',
          gridTemplateColumns: viewMode === 'card' ? 'repeat(auto-fill, minmax(400px, 1fr))' : 'initial',
          gap: viewMode === 'compact' ? '8px' : '24px'
        }}>
          {/* Table Header for Table Mode */}
          {viewMode === 'table' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1fr 1fr 1fr', padding: '0 32px 12px', fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <span>Customer / Entity</span>
              <span style={{ textAlign: 'center' }}>Transaction Info</span>
              <span style={{ textAlign: 'center' }}>Items Summary</span>
              <span style={{ textAlign: 'right' }}>Grand Total</span>
            </div>
          )}

          {allOrders.map((order, idx) => {
            const isSettled = !order.isActive;
            const total = getOrderTotal(order);
            const time = order.timestamp ? new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live';

            if (viewMode === 'table') {
              return (
                <div
                  key={order.id || idx}
                  onClick={() => !isSettled && onSelectActive(order)}
                  style={{
                    background: 'white', borderRadius: '16px', padding: '16px 32px', display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1fr 1fr 1fr',
                    alignItems: 'center', border: '1px solid #f1f5f9', cursor: isSettled ? 'default' : 'pointer', transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fcfcfd'; e.currentTarget.style.transform = 'scale(1.002)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isSettled ? '#f0fdf4' : '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isSettled ? <CheckSquare size={16} color="#10b981" /> : <Clock size={16} color="var(--primary)" />}
                    </div>
                    <div>
                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>{order.customerName || order.id || 'Walk-In Customer'}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>By: {order.phone || 'Staff'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                    #{String(order.id).slice(-6)} • {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • <span style={{ color: isSettled ? '#10b981' : 'var(--primary)' }}>{isSettled ? 'SETTLED' : 'ONGOING'}</span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                    {order.tableId ? `Table ${order.tableId}` : order.type} • {(order.cart || order.order || []).length} items
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: '900', color: '#0f172a', fontSize: '16px' }}>₹{total.toFixed(2)}</div>
                </div>
              );
            }

            if (viewMode === 'compact') {
              return (
                <div
                  key={order.id || idx}
                  onClick={() => !isSettled && onSelectActive(order)}
                  style={{
                    background: 'white', borderRadius: '12px', padding: '12px 24px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', border: '1px solid #f1f5f9', cursor: isSettled ? 'default' : 'pointer', fontSize: '13px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSettled ? '#10b981' : 'var(--primary)' }}></div>
                    <span style={{ fontWeight: '800' }}>{order.customerName || order.id || 'Walk-In'}</span>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>ID: {String(order.id).slice(-4)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>{time}</span>
                    <span style={{ fontWeight: '900', minWidth: '80px', textAlign: 'right' }}>₹{total.toFixed(2)}</span>
                    {!isSettled && <div style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'var(--primary)', color: 'white', fontWeight: '900' }}>LIVE</div>}
                  </div>
                </div>
              );
            }

            // DEFAULT CARD VIEW
            return (
              <div
                key={order.id || idx}
                onClick={() => !isSettled && onSelectActive(order)}
                style={{
                  background: 'white',
                  borderRadius: '28px',
                  padding: '32px',
                  border: '1px solid #f1f5f9',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01), 0 2px 4px -1px rgba(0,0,0,0.01)',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  cursor: isSettled ? 'default' : 'pointer',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 30px 60px -12px rgba(0,0,0,0.08), 0 18px 36px -18px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = 'var(--primary)33';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.01)';
                  e.currentTarget.style.borderColor = '#f1f5f9';
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '18px',
                      background: isSettled ? '#f0fdf4' : '#fff1f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {isSettled ? <CheckSquare size={24} color="#10b981" /> : <Clock size={24} color="var(--primary)" className="animate-pulse" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.3px' }}>
                        {order.customerName || 'Walk-In Customer'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                        ID: {String(order.id).slice(-6)} • {new Date(order.timestamp).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>
                        Ordered By: {order.phone || 'System/Staff'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      padding: '8px 16px', borderRadius: '12px', fontSize: '10px', fontWeight: '900', letterSpacing: '1px',
                      background: isSettled ? '#f0fdf4' : '#fff7ed',
                      color: isSettled ? '#15803d' : '#c2410c',
                      border: isSettled ? '1px solid #dcfce7' : '1px solid #ffedd5',
                      marginBottom: '8px'
                    }}>
                      {isSettled ? 'SETTLED' : 'ONGOING'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b' }}>
                      {order.tableId ? `Table ${order.tableId}` : order.type}
                    </div>
                  </div>
                </div>

                {/* Body - Items List */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(order.cart || order.order || []).map((item, i) => (
                      <div key={i} style={{
                        padding: '6px 14px', background: '#f8fafc', borderRadius: '10px',
                        fontSize: '12px', color: '#4b5563', fontWeight: '700', border: '1px solid #f1f5f9'
                      }}>
                        {item.qty} × {item.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer - Total Cost */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Total Amount</div>
                    <div style={{ fontSize: '28px', fontWeight: '950', color: '#0f172a', letterSpacing: '-1px' }}>₹{total.toFixed(2)}</div>
                  </div>

                  {!isSettled && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectActive(order); }}
                      style={{
                        background: 'linear-gradient(to right, var(--primary), var(--primary-hover))',
                        color: 'white', border: 'none', padding: '14px 28px', borderRadius: '16px',
                        fontSize: '14px', fontWeight: '900', cursor: 'pointer',
                        boxShadow: '0 10px 20px -5px rgba(163, 17, 42, 0.4)'
                      }}
                    >
                      OPEN ORDER
                    </button>
                  )}
                  {isSettled && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: '#10b981', fontWeight: '900', textTransform: 'uppercase' }}>Transaction Success</div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {[1, 2, 3].map(i => <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }} />)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* --- MENU SETUP VIEW --- */

const RetailProductSetupView = ({ categories, setCategories, menuItems, setMenuItems }) => {
  const [newCat, setNewCat] = useState('');
  const [newItem, setNewItem] = useState({ name: '', price: '', stockQuantity: '', cat: categories[0] || '' });

  const addCategory = () => {
    if (newCat && !categories.includes(newCat)) {
      setCategories([...categories, newCat]);
      if (!newItem.cat) setNewItem({ ...newItem, cat: newCat });
      setNewCat('');
    }
  };

  const deleteCategory = (catName) => {
    if (window.confirm(`Are you sure you want to delete the Retail category "${catName}"?`)) {
      const pwd = window.prompt("Security Check: Enter master password to delete category");
      if (pwd === "biller") setCategories(categories.filter(c => c !== catName));
    }
  };

  const addItem = () => {
    if (newItem.name && newItem.price && newItem.cat && newItem.stockQuantity !== '') {
      const itemToAdd = {
        ...newItem,
        id: Date.now(),
        type: 'retail',
        price: parseFloat(newItem.price),
        stockQuantity: parseInt(newItem.stockQuantity, 10),
        inStock: parseInt(newItem.stockQuantity, 10) > 0
      };
      setMenuItems([...menuItems, itemToAdd]);
      setNewItem({ name: '', price: '', stockQuantity: '', cat: categories[0] || '' });
    } else {
      alert("Please fill in Name, Price, Category, and Stock Quantity.");
    }
  };

  const deleteItem = (id) => {
    if (window.confirm("Are you sure you want to remove this product?")) {
      const pwd = window.prompt("Security Check: Enter master password:");
      if (pwd === "biller") setMenuItems(menuItems.filter(item => item.id !== id));
    }
  };

  const toggleStock = (id) => {
    setMenuItems(menuItems.map(item => item.id === id ? { ...item, inStock: !item.inStock } : item));
  };

  const updateQuantity = (id, newQty) => {
    setMenuItems(menuItems.map(item => {
      if (item.id === id) {
        const q = parseInt(newQty, 10) || 0;
        return { ...item, stockQuantity: q, inStock: q > 0 };
      }
      return item;
    }));
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f9fafb' }} className="animate-fade-in no-scrollbar">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package size={28} color="#3b82f6" /> Retail Product Setup
        </h2>

        {/* Categories Section */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#374151' }}>Retail Categories</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input type="text" placeholder="New Category Name" value={newCat} onChange={e => setNewCat(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <button onClick={addCategory} className="btn-pp btn-pp-primary">Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {categories.map(cat => (
              <div key={cat} style={{ background: '#f3f4f6', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {cat} <button onClick={() => deleteCategory(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Items Section */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#374151' }}>Product Inventory</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto', gap: '10px', alignItems: 'center', marginBottom: '24px' }}>
            <input type="text" placeholder="Product Name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <input type="number" placeholder="Price (₹)" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <input type="number" placeholder="Stock Qty" value={newItem.stockQuantity} onChange={e => setNewItem({ ...newItem, stockQuantity: e.target.value })} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <select value={newItem.cat} onChange={e => setNewItem({ ...newItem, cat: e.target.value })} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white' }}>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <button onClick={addItem} className="btn-pp btn-pp-primary" style={{ padding: '10px 20px', background: '#3b82f6' }}>Add</button>
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>Current Stock</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {menuItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', background: item.inStock ? 'white' : '#fef2f2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#3b82f6' }}></div>
                  <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{item.name}</div>
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>{item.cat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontWeight: 'bold', color: '#94161c' }}>₹{item.price}</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Qty:</span>
                    <input type="number" value={item.stockQuantity} onChange={e => updateQuantity(item.id, e.target.value)} style={{ width: '60px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }} />
                  </div>

                  <button onClick={() => toggleStock(item.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', background: item.inStock ? '#ecfdf5' : 'transparent', color: item.inStock ? '#10b981' : '#ef4444', borderColor: item.inStock ? '#10b981' : '#ef4444' }}>
                    {item.inStock ? 'In Stock' : 'Out of Stock'}
                  </button>
                  <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}><X size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MenuSetupView = ({ categories, setCategories, menuItems, setMenuItems }) => {
  const [newCat, setNewCat] = useState('');
  const [newItem, setNewItem] = useState({ name: '', price: '', type: 'veg', cat: categories[0] || '' });

  const addCategory = () => {
    if (newCat && !categories.includes(newCat)) {
      setCategories([...categories, newCat]);
      if (!newItem.cat) setNewItem({ ...newItem, cat: newCat });
      setNewCat('');
    }
  };

  const deleteCategory = (catName) => {
    if (window.confirm(`Are you sure you want to delete the category "${catName}"? This will not delete the items in this category.`)) {
      const pwd = window.prompt("Security Check: Enter master password to delete category");
      if (pwd === "biller") {
        setCategories(categories.filter(c => c !== catName));
      } else {
        alert("Incorrect Password. Deletion cancelled.");
      }
    }
  };

  const addItem = () => {
    if (newItem.name && newItem.price && newItem.cat) {
      const itemToAdd = {
        ...newItem,
        id: Date.now(),
        price: parseFloat(newItem.price),
        inStock: true
      };
      setMenuItems([...menuItems, itemToAdd]);
      setNewItem({ name: '', price: '', type: 'veg', cat: categories[0] || '' });
    } else {
      alert("Please fill in Name, Price, and Category.");
    }
  };

  const deleteItem = (id) => {
    if (window.confirm("Are you sure you want to remove this item from the menu?")) {
      const pwd = window.prompt("Security Check: Enter master password to delete menu item:");
      if (pwd === "biller") {
        setMenuItems(menuItems.filter(item => item.id !== id));
      } else {
        alert("Incorrect Password. Deletion cancelled.");
      }
    }
  };

  const toggleStock = (id) => {
    setMenuItems(menuItems.map(item => item.id === id ? { ...item, inStock: !item.inStock } : item));
  };

  const clearAllItems = () => {
    if (window.confirm("CRITICAL ACTION: Are you sure you want to delete ALL menu items? This cannot be undone.")) {
      const pwd = window.prompt("Security Check: Enter master password to WIPE inventory:");
      if (pwd === "biller") {
        setMenuItems([]);
      } else {
        alert("Incorrect Password. Deletion cancelled.");
      }
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f9fafb' }} className="animate-fade-in no-scrollbar">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Utensils size={28} color="#10b981" /> Menu & Inventory Setup
        </h2>

        {/* Categories Section */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#374151' }}>Categories</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="New Category Name (e.g. Desserts)"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
            <button onClick={addCategory} className="btn-pp btn-pp-primary" style={{ background: '#10b981', padding: '10px 20px' }}>Add Category</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {categories.map(cat => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>
                {cat}
                <button onClick={() => deleteCategory(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#ef4444' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Menu Items Section */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#374151' }}>Menu Items</h3>
            <button
              onClick={clearAllItems}
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Clear All Items
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>Add new items or manage current inventory stock below.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'center', marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Item Name"
              value={newItem.name}
              onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
            <input
              type="number"
              placeholder="Price (₹)"
              value={newItem.price}
              onChange={e => setNewItem({ ...newItem, price: e.target.value })}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
            <select
              value={newItem.cat}
              onChange={e => setNewItem({ ...newItem, cat: e.target.value })}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white' }}
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select
              value={newItem.type}
              onChange={e => setNewItem({ ...newItem, type: e.target.value })}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white' }}
            >
              <option value="veg">Veg</option>
              <option value="non-veg">Non-Veg</option>
            </select>
            <button onClick={addItem} className="btn-pp btn-pp-primary" style={{ padding: '10px 20px' }}>Add Item</button>
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>Current Menu</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {menuItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', background: item.inStock ? 'white' : '#fef2f2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: item.type === 'veg' ? '#10b981' : '#ef4444' }}></div>
                  <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{item.name}</div>
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>{item.cat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontWeight: 'bold', color: '#94161c' }}>₹{item.price}</div>
                  <button
                    onClick={() => toggleStock(item.id)}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', background: item.inStock ? '#ecfdf5' : 'transparent', color: item.inStock ? '#10b981' : '#ef4444', borderColor: item.inStock ? '#10b981' : '#ef4444' }}
                  >
                    {item.inStock ? 'In Stock' : 'Out of Stock'}
                  </button>
                  <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- FLOOR PLAN SETUP VIEW --- */
const FloorPlanSetupView = ({ tables, setTables, sections, setSections }) => {
  const [newTableName, setNewTableName] = useState('');
  const [newTableType, setNewTableType] = useState(sections[0] || '');
  const [tableToRemove, setTableToRemove] = useState(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSection, setEditingSection] = useState(null);
  const [editSectionValue, setEditSectionValue] = useState('');
  const [designModeSection, setDesignModeSection] = useState(null);
  const [draggedTableId, setDraggedTableId] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const addTable = () => {
    if (newTableName.trim() === '' || !newTableType) return;
    const newId = Date.now();
    const newTable = {
      id: newId,
      name: newTableName,
      status: 'blank',
      type: newTableType,
      order: [],
      pos: { x: 50, y: 50 }
    };
    setTables([...tables, newTable]);
    setNewTableName('');
  };

  const removeTable = (id) => {
    const tableInfo = tables.find(t => t.id === id);
    if (tableInfo && tableInfo.status !== 'blank') {
      alert("Cannot remove a table with an active order.");
      return;
    }
    setTableToRemove(id);
  };

  const confirmRemoveTable = () => {
    setTables(tables.filter(t => t.id !== tableToRemove));
    setTableToRemove(null);
  };

  const addSection = () => {
    if (!newSectionName.trim()) return;
    if (sections.includes(newSectionName.trim())) {
      alert("Section already exists.");
      return;
    }
    setSections([...sections, newSectionName.trim()]);
    setNewSectionName('');
    if (!newTableType) setNewTableType(newSectionName.trim());
  };

  const removeSection = (sec) => {
    const hasTables = tables.some(t => t.type === sec);
    if (hasTables) {
      alert("Cannot remove a section containing tables. Move or delete tables first.");
      return;
    }
    if (window.confirm(`Remove section "${sec}"?`)) {
      setSections(sections.filter(s => s !== sec));
    }
  };

  const startEditSection = (sec) => {
    setEditingSection(sec);
    setEditSectionValue(sec);
  };

  const saveSectionRename = () => {
    if (!editSectionValue.trim() || editSectionValue === editingSection) {
      setEditingSection(null);
      return;
    }
    setSections(sections.map(s => s === editingSection ? editSectionValue.trim() : s));
    setTables(tables.map(t => t.type === editingSection ? { ...t, type: editSectionValue.trim() } : t));
    if (newTableType === editingSection) setNewTableType(editSectionValue.trim());
    setEditingSection(null);
  };

  const handleTableMouseDown = (e, tableId) => {
    if (!designModeSection) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    e.preventDefault();
    setDraggedTableId(tableId);
    setOffset({
      x: e.clientX - (table.pos?.x || 0),
      y: e.clientY - (table.pos?.y || 0)
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (!draggedTableId) return;
    const newX = e.clientX - offset.x;
    const newY = e.clientY - offset.y;
    // Snap to grid 10px
    const snappedX = Math.round(newX / 10) * 10;
    const snappedY = Math.round(newY / 10) * 10;

    setTables(prev => prev.map(t =>
      t.id === draggedTableId ? { ...t, pos: { x: snappedX, y: snappedY } } : t
    ));
  };

  const handleCanvasMouseUp = () => setDraggedTableId(null);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f9fafb' }} className="animate-fade-in no-scrollbar" onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '30px', fontWeight: '900', color: '#111827', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <LayoutGrid size={32} color="#7c3aed" /> Floor Plan Master
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#6b7280', background: '#f3f4f6', padding: '4px 12px', borderRadius: '20px', marginLeft: 'auto' }}>
            CUSTOM DESIGN MODE
          </span>
        </h2>

        {/* Section Management */}
        <div style={{ background: 'white', padding: '32px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 10px 15px -10px rgba(0,0,0,0.05)', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Monitor size={20} color="#7c3aed" /> Spatial Sections
          </h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="E.g. Garden View, Roof Deck"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              style={{ flex: 1, padding: '14px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#f8fafc' }}
            />
            <button onClick={addSection} className="btn-pp" style={{ background: '#7c3aed', color: 'white', padding: '0 24px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px' }}>+ New Area</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {sections.map(sec => (
              <div key={sec} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: editingSection === sec ? '#fff' : '#f1f5f9', padding: '10px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: '800', border: editingSection === sec ? '2px solid #7c3aed' : '1px solid #e2e8f0' }}>
                {editingSection === sec ? (
                  <input autoFocus value={editSectionValue} onChange={e => setEditSectionValue(e.target.value)} onBlur={saveSectionRename} onKeyDown={e => e.key === 'Enter' && saveSectionRename()} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', width: '120px' }} />
                ) : (
                  <span onClick={() => startEditSection(sec)} style={{ cursor: 'pointer', color: '#4b5563' }}>{sec}</span>
                )}
                <button onClick={() => removeSection(sec)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#94a3b8', padding: 0 }}><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'white', padding: '32px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 10px 15px -10px rgba(0,0,0,0.05)', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutGrid size={20} color="#7c3aed" /> New Entity
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Table Label (e.g. VIP-1)"
              value={newTableName}
              onChange={e => setNewTableName(e.target.value)}
              style={{ flex: 1, padding: '14px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#f8fafc' }}
            />
            <select
              value={newTableType}
              onChange={e => setNewTableType(e.target.value)}
              style={{ padding: '14px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 'bold', fontSize: '14px', color: '#1f2937' }}
            >
              {!newTableType && <option value="" disabled>Select Location</option>}
              {sections.map(sec => <option key={sec} value={sec}>{sec} Area</option>)}
            </select>
            <button onClick={addTable} style={{ background: '#111827', color: 'white', padding: '14px 28px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Create Table</button>
          </div>
        </div>

        {sections.map(section => (
          <div key={section} style={{ background: 'white', padding: '32px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 100px 80px -50px rgba(0,0,0,0.03)', marginBottom: '48px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#111827' }}>{section} <span style={{ color: '#94a3b8', fontWeight: '400' }}>Spatial Plan</span></h3>
              </div>
              <button
                onClick={() => setDesignModeSection(designModeSection === section ? null : section)}
                style={{
                  padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: '900', cursor: 'pointer',
                  background: designModeSection === section ? '#7c3aed' : '#f1f5f9',
                  color: designModeSection === section ? 'white' : '#4b5563',
                  border: 'none', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                }}
              >
                {designModeSection === section ? <CheckSquare size={16} /> : <TrendingUp size={16} />}
                {designModeSection === section ? 'Finish Designing' : 'Design This Layout'}
              </button>
            </div>

            {designModeSection === section ? (
              <div style={{
                position: 'relative', height: '500px', background: '#f8fafc', borderRadius: '20px', border: '2px dashed #e2e8f0',
                overflow: 'hidden', backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px'
              }}>
                <div style={{ position: 'absolute', top: '16px', left: '16px', fontSize: '11px', fontWeight: '900', color: '#94a3b8', background: 'white', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  DRAG TABLES TO POSITION THEM
                </div>
                {tables.filter(t => t.type === section).map(table => (
                  <div
                    key={table.id}
                    onMouseDown={(e) => handleTableMouseDown(e, table.id)}
                    style={{
                      position: 'absolute', left: `${table.pos?.x || 0}px`, top: `${table.pos?.y || 0}px`,
                      width: '100px', height: '100px', background: 'white', borderRadius: 'var(--table-radius)', border: '2px solid var(--primary)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'grab',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', userSelect: 'none'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)' }}>{table.name}</div>
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => removeTable(table.id)}
                      style={{ position: 'absolute', top: '4px', right: '4px', background: '#fff1f2', border: 'none', borderRadius: '50%', color: '#ef4444', padding: '4px', cursor: 'pointer' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '16px' }}>
                {tables.filter(t => t.type === section).map(table => (
                  <div key={table.id} style={{ background: '#f8fafc', borderRadius: 'var(--table-radius)', padding: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '900', color: '#1e293b' }}>{table.name}</span>
                    <button onClick={() => removeTable(table.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {tableToRemove && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="animate-fade-in" style={{ background: 'white', padding: '28px', borderRadius: '12px', width: '340px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#1f2937' }}>Delete Table?</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '28px', lineHeight: '1.5' }}>Are you sure you want to completely remove this table from the floor plan?</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setTableToRemove(null)}
                  style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveTable}
                  style={{ flex: 1, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* --- SYSTEM SETTINGS VIEW --- */
/* --- ADVANCED GLOBAL SETTINGS VIEW --- */
const GlobalSettingsView = ({ settings, onSaveSettings }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    alert('Global Design & System Settings Saved Successfully!');
  };

  return (
    <div className="view-container animate-fade-in no-scrollbar">
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LayoutGrid size={28} color="var(--primary)" /> Advanced Global Settings
        </h2>

        <div style={{ background: 'white', padding: '32px', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '2px solid #f3f4f6', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937' }}>
            <Monitor size={20} color="var(--primary)" /> Color Theme Control
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Primary / Highlight Color</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" name="accentColor" value={localSettings.accentColor} onChange={handleChange} style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
                <input type="text" name="accentColor" value={localSettings.accentColor} onChange={handleChange} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', color: '#111827' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Secondary Color</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" name="secondaryColor" value={localSettings.secondaryColor || '#7c3aed'} onChange={handleChange} style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
                <input type="text" name="secondaryColor" value={localSettings.secondaryColor || '#7c3aed'} onChange={handleChange} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', color: '#111827' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>App Background</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" name="bgColor" value={localSettings.bgColor || '#f9fafb'} onChange={handleChange} style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
                <input type="text" name="bgColor" value={localSettings.bgColor || '#f9fafb'} onChange={handleChange} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', color: '#111827' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Main Text Color</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" name="textColor" value={localSettings.textColor || '#1f2937'} onChange={handleChange} style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
                <input type="text" name="textColor" value={localSettings.textColor || '#1f2937'} onChange={handleChange} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', color: '#111827' }} />
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '2px solid #f3f4f6', paddingBottom: '12px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937' }}>
            <LayoutGrid size={20} color="var(--primary)" /> Component & Floor Plan Design
          </h3>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Global Corner Styling (Roundness)</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['0', '4', '8', '12', '24'].map(r => (
                <button
                  key={r}
                  onClick={() => setLocalSettings(prev => ({ ...prev, borderRadius: r }))}
                  style={{
                    flex: 1, padding: '10px', borderRadius: `${r}px`, border: `2px solid ${localSettings.borderRadius === r ? localSettings.accentColor : '#e5e7eb'}`,
                    background: localSettings.borderRadius === r ? `${localSettings.accentColor}10` : 'white',
                    color: '#111827',
                    fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  {r === '0' ? 'Square' : r === '24' ? 'Pill' : `${r}px`}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Table Shape (Floor Plan & Ordering)</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['square', 'rounded', 'circle'].map(shape => (
                <button
                  key={shape}
                  onClick={() => setLocalSettings(prev => ({ ...prev, tableShape: shape }))}
                  style={{
                    flex: 1, padding: '10px', textTransform: 'capitalize',
                    borderRadius: shape === 'square' ? '4px' : shape === 'circle' ? '50px' : '16px',
                    border: `2px solid ${localSettings.tableShape === shape ? localSettings.accentColor : '#e5e7eb'}`,
                    background: localSettings.tableShape === shape ? `${localSettings.accentColor}10` : 'white',
                    color: '#111827',
                    fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  {shape}
                </button>
              ))}
            </div>
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '2px solid #f3f4f6', paddingBottom: '12px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937' }}>
            <Info size={20} color="var(--primary)" /> Typography Settings
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Global Interface Font</label>
              <select name="globalFont" value={localSettings.globalFont || 'Outfit'} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#111827' }}>
                <option value="Outfit">Outfit (Default Modern)</option>
                <option value="Inter">Inter (Clean Tech)</option>
                <option value="'Roboto', sans-serif">Roboto (Material)</option>
                <option value="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif">System Default</option>
                <option value="'Courier New', Courier, monospace">Classic Terminal</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Base Font Size (px)</label>
              <input type="number" name="fontBaseSize" value={localSettings.fontBaseSize || '14'} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #d1d5db', color: '#111827' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Base Font Weight</label>
              <select name="fontBaseWeight" value={localSettings.fontBaseWeight || 'normal'} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#111827' }}>
                <option value="300">Light (300)</option>
                <option value="normal">Regular (400)</option>
                <option value="500">Medium (500)</option>
                <option value="bold">Bold (700)</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} color="#64748b" /> Global Logic
            </h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
              <input type="checkbox" name="autoServiceCharge" checked={localSettings.autoServiceCharge} onChange={handleChange} style={{ width: '20px', height: '20px' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>Auto-Apply Service Charge</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>If enabled, default service charge will be added to every new bill.</div>
              </div>
            </label>
          </div>

          <button onClick={handleSave} style={{ marginTop: '20px', padding: '14px', background: localSettings.accentColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: `0 4px 6px -1px ${localSettings.accentColor}30` }}>
            Save Global Settings
          </button>
        </div>
      </div>
    </div>
  );
};

/* --- SYSTEM SETTINGS VIEW --- */
const PrinterSettingsView = ({ settings, onSaveSettings, categories }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleCategory = (cat) => {
    setLocalSettings(prev => {
      const current = prev.separatePrintCategories || [];
      if (current.includes(cat)) {
        return { ...prev, separatePrintCategories: current.filter(c => c !== cat) };
      } else {
        return { ...prev, separatePrintCategories: [...current, cat] };
      }
    });
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    alert('Printer Settings Saved Successfully!');
  };

  return (
    <div className="view-container animate-fade-in no-scrollbar">
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', borderBottom: '2px solid #f3f4f6', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937' }}>
            <Printer size={24} color="#64748b" /> Hardware Receipt Configuration
          </h2>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Bill Header (Text Logo)</label>
            <input type="text" name="billHeader" value={localSettings.billHeader} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', color: '#111827' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Bill Footer Message</label>
            <input type="text" name="billFooter" value={localSettings.billFooter} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', color: '#111827' }} />
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>Custom KOT Stations</label>
              <button onClick={() => {
                const name = window.prompt("Enter new Station Name (e.g. Beverages, Pizza):");
                if (name) {
                  setLocalSettings(prev => ({
                    ...prev,
                    printerStations: [...(prev.printerStations || []), { id: Date.now().toString(), name, categories: [] }]
                  }));
                }
              }} style={{ padding: '6px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>+ Add Station</button>
            </div>

            <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>Group categories into stations. Any category not assigned to a station will print together as "Main Kitchen".</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(localSettings.printerStations || []).map(station => (
                <div key={station.id} style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>{station.name}</div>
                    <button onClick={() => {
                      if (window.confirm('Remove this station?')) {
                        setLocalSettings(prev => ({ ...prev, printerStations: prev.printerStations.filter(s => s.id !== station.id) }));
                      }
                    }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Remove</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {categories.map(cat => {
                      const isSelected = station.categories.includes(cat);
                      return (
                        <label key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', border: `1px solid ${isSelected ? 'var(--primary)' : '#d1d5db'}`, padding: '4px 10px', borderRadius: '20px', background: isSelected ? 'var(--primary)' : 'white', color: isSelected ? 'white' : '#4b5563', cursor: 'pointer', transition: 'all 0.2s' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setLocalSettings(prev => ({
                                ...prev,
                                printerStations: prev.printerStations.map(s => {
                                  if (s.id === station.id) {
                                    return { ...s, categories: isSelected ? s.categories.filter(c => c !== cat) : [...s.categories, cat] };
                                  }
                                  // Auto-remove from other stations if selected here
                                  return { ...s, categories: s.categories.filter(c => c !== cat) };
                                })
                              }));
                            }}
                            style={{ display: 'none' }}
                          />
                          {cat}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '12px' }}>Print Typography</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <select name="printFontFamily" value={localSettings.printFontFamily} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', color: '#111827' }}>
                <option value="Helvetica, Arial, sans-serif">Sans-Serif</option>
                <option value="'Courier New', Courier, monospace">Monospace</option>
              </select>
              <input type="number" name="printFontSize" value={localSettings.printFontSize} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', color: '#111827' }} />
            </div>
          </div>

          <button onClick={handleSave} style={{ marginTop: '20px', padding: '14px', background: localSettings.accentColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: `0 4px 6px -1px ${localSettings.accentColor}30` }}>
            Save Printer Configurations
          </button>
        </div>
      </div>
    </div>
  );
};

const TableManagement = ({ tables, floorPlanSections, onSelectTable, onClearTable, settings, onQuickSettle, onQuickPrint, globalSearch }) => {
  const [tableToClear, setTableToClear] = useState(null);
  const [viewMode, setViewMode] = useState('map'); // 'grid' or 'map'
  const getTableTotal = (order) => order.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const filterMatch = (t) => {
    if (!globalSearch) return true;
    const name = (t.name || '').toLowerCase();
    const search = globalSearch.toLowerCase();
    return name.includes(search) || String(t.id).includes(search) || (t.customerName || '').toLowerCase().includes(search) || (t.phone || '').includes(search);
  };

  const filteredTables = tables.filter(filterMatch);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: '#fcfcfd' }} className="animate-fade-in no-scrollbar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '950', color: '#111827', letterSpacing: '-0.5px' }}>Spatial Tables</h2>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            {['map', 'grid'].map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: '900', border: 'none', cursor: 'pointer',
                  background: viewMode === m ? 'black' : '#f1f5f9', color: viewMode === m ? 'white' : '#64748b'
                }}
              >
                {m.toUpperCase()} VIEW
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '3px' }}></div> VACANT</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', background: 'var(--primary)', borderRadius: '3px' }}></div> RUNNING</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '3px' }}></div> PRINTED</div>
        </div>
      </div>

      {(floorPlanSections || []).map(section => (
        <div key={section} style={{ marginBottom: '48px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>{section} SECTION</h3>

          {viewMode === 'map' ? (
            <div style={{
              position: 'relative', height: '550px', background: 'white', borderRadius: '32px', border: '1px solid #f1f5f9', overflow: 'auto',
              backgroundImage: 'radial-gradient(#f1f5f9 1px, transparent 1px)', backgroundSize: '30px 30px'
            }}>
              {filteredTables.filter(t => t.type === section).map(table => {
                const tableTotal = getTableTotal(table.order);
                const isRunning = table.status !== 'blank';
                const isPrinted = table.status === 'printed';

                return (
                  <div
                    key={table.id}
                    onClick={() => onSelectTable(table)}
                    style={{
                      position: 'absolute',
                      left: `${table.pos?.x || 0}px`,
                      top: `${table.pos?.y || 0}px`,
                      width: '120px',
                      height: '120px',
                      background: isPrinted ? '#f0fdf4' : isRunning ? 'var(--primary)10' : 'white',
                      borderRadius: 'var(--table-radius)',
                      border: `2px solid ${isPrinted ? '#10b981' : isRunning ? 'var(--primary)' : '#f1f5f9'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px',
                      cursor: 'pointer',
                      boxShadow: isRunning ? '0 10px 15px -3px rgba(124, 58, 237, 0.15)' : '0 4px 6px -1px rgba(0,0,0,0.02)',
                      transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05) translateY(-5px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '900', color: isRunning ? '#1f2937' : '#94a3b8' }}>{table.name}</div>
                    {tableTotal > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: '950', color: isPrinted ? '#10b981' : 'var(--primary)' }}>₹{tableTotal}</div>
                    )}
                    {isRunning && (
                      <>
                        <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                          <TimeElapsed createdAt={table.createdAt} />
                        </div>
                        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                          <div title="Print Bill" onClick={(e) => { e.stopPropagation(); onQuickPrint(table); }} style={{ padding: '4px', background: 'white', borderRadius: '4px', cursor: 'pointer', border: '1px solid #e2e8f0' }}>
                            <Printer size={12} color="#64748b" />
                          </div>
                          <div title="Settle Bill" onClick={(e) => { e.stopPropagation(); onQuickSettle(table); }} style={{ padding: '4px', background: 'var(--primary)', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>
                            <CheckSquare size={12} />
                          </div>
                        </div>
                        <div style={{ position: 'absolute', bottom: '12px', right: '12px', display: 'flex', gap: '4px' }}>
                          <div onClick={(e) => { e.stopPropagation(); setTableToClear(table.id); }} style={{ padding: '6px', background: '#fee2e2', borderRadius: '8px', cursor: 'pointer' }}>
                            <Trash2 size={12} color="#ef4444" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
              {filteredTables.filter(t => t.type === section).map(table => {
                const tableTotal = getTableTotal(table.order);
                const isRunning = table.status !== 'blank';
                const isPrinted = table.status === 'printed';

                return (
                  <div
                    key={table.id}
                    onClick={() => onSelectTable(table)}
                    className={`pp-table-card ${isRunning ? (isPrinted ? 'status-printed' : 'status-running') : 'status-blank'}`}
                    style={{ height: '110px', padding: '16px', borderRadius: 'var(--table-radius)', border: '1px solid #f1f5f9', position: 'relative' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#4b5563' }}>{table.name}</div>
                      {isRunning && <TimeElapsed createdAt={table.createdAt} />}
                    </div>
                    {tableTotal > 0 && <div style={{ fontSize: '16px', fontWeight: '950', marginTop: 'auto' }}>₹{tableTotal}</div>}
                    {isRunning && (
                      <>
                        <div style={{ position: 'absolute', top: '35px', right: '10px', display: 'flex', gap: '6px' }}>
                          <div title="Print Bill" onClick={(e) => { e.stopPropagation(); onQuickPrint(table); }} style={{ padding: '4px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}><Printer size={12} color="#64748b" /></div>
                          <div title="Settle Bill" onClick={(e) => { e.stopPropagation(); onQuickSettle(table); }} style={{ padding: '4px', background: 'var(--primary)', color: 'white', borderRadius: '4px', cursor: 'pointer' }}><CheckSquare size={12} /></div>
                        </div>
                        <div onClick={(e) => { e.stopPropagation(); setTableToClear(table.id); }} style={{ position: 'absolute', bottom: '10px', right: '10px', padding: '6px', background: '#fee2e2', borderRadius: '8px', cursor: 'pointer' }}>
                          <Trash2 size={12} color="#ef4444" />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {tableToClear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="animate-fade-in" style={{ background: 'white', padding: '28px', borderRadius: '12px', width: '340px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#1f2937' }}>Clear Table?</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '28px', lineHeight: '1.5' }}>Are you sure you want to completely discard this pending order?</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setTableToClear(null)}
                style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { onClearTable(tableToClear); setTableToClear(null); }}
                style={{ flex: 1, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- KITCHEN DISPLAY SYSTEM --- */
const KitchenDisplay = ({ tables, nonTableOrders, onMarkReady }) => {
  const activeOrders = [...tables, ...nonTableOrders].filter(o => o.order && o.order.length > 0 && o.status !== 'blank' && o.status !== 'printed');

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#111827', color: 'white' }} className="animate-fade-in no-scrollbar">
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ChefHat size={24} color="#fca5a5" /> Kitchen Display System (KDS)
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {activeOrders.length === 0 && <div style={{ color: '#6b7280', fontStyle: 'italic', gridColumn: '1 / -1' }}>No active orders in queue.</div>}
        {activeOrders.map(order => (
          <div key={order.id} style={{ background: '#1f2937', borderRadius: '8px', border: '1px solid #374151', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: order.status === 'kot' ? '#b91c1c' : '#4f46e5', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{order.name}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                {order.status === 'kot' ? 'NEW KOT' : 'RUNNING'}
              </div>
            </div>
            <div style={{ padding: '16px', flex: 1 }}>
              {order.order.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{item.qty}x {item.name}</div>
                    {item.note && <div style={{ fontSize: '12px', color: '#fca5a5', fontStyle: 'italic', marginTop: '2px' }}>* NOTE: {item.note}</div>}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => onMarkReady(order)}
              style={{ background: '#059669', color: 'white', border: 'none', padding: '16px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = '#047857'}
              onMouseOut={(e) => e.currentTarget.style.background = '#059669'}
            >
              <CheckSquare size={20} /> Mark Order Ready
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const NonTableManagement = ({ orders, onSelectOrder, onCreateOrder, onViewChange, onQuickSettle, onQuickPrint, globalSearch }) => {
  const [localSearch, setLocalSearch] = useState('');
  const getOrderTotal = (orderArr) => orderArr.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const searchVal = globalSearch || localSearch;

  const filteredOrders = orders.filter(o => 
    (o.id && String(o.id).toLowerCase().includes(searchVal.toLowerCase())) ||
    (o.customerName && String(o.customerName).toLowerCase().includes(searchVal.toLowerCase())) ||
    (o.phone && String(o.phone).includes(searchVal)) ||
    (o.type && String(o.type).toLowerCase().includes(searchVal.toLowerCase()))
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }} className="animate-fade-in no-scrollbar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>Pickup Orders Dashboard</h2>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Showing recent active pickup and delivery orders.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '240px' }}>
            <Search size={16} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search TAK Order ID / Mobile..." 
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '13px', outline: 'none' }} 
            />
          </div>
          <button
            className="btn-pp"
            onClick={() => onCreateOrder('Takeaway')}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#94161c',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px -1px rgba(148, 22, 28, 0.2)'
            }}
          >
            <Plus size={18} style={{ marginRight: '8px' }} /> + New Pickup Order
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        {filteredOrders.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', background: 'white', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
            <ShoppingBag size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: '#94a3b8', fontSize: '15px', fontWeight: '500' }}>No matching pickup orders found.</div>
          </div>
        )}
        {[...filteredOrders].reverse().map(order => {
          const tableTotal = getOrderTotal(order.order);
          let bg = order.type === 'Delivery' ? '#fff1f2' : '#f0f9ff';
          let text = order.type === 'Delivery' ? '#be123c' : '#0369a1';
          let border = order.type === 'Delivery' ? '#ffe4e6' : '#e0f2fe';

          let statusLabel = 'Preparing';
          let statusColor = '#f59e0b';
          if (order.status === 'printed') { statusLabel = 'Ready'; statusColor = '#10b981'; }
          if (order.status === 'completed' || order.status === 'settled') { statusLabel = 'Completed'; statusColor = '#64748b'; }

          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order)}
              style={{
                background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '12px', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>{order.customerName || order.name}</div>
                  <TimeElapsed createdAt={order.createdAt} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div style={{ fontSize: '10px', background: bg, color: text, padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', border: `1px solid ${border}`, textTransform: 'uppercase' }}>{order.type}</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <div title="Print Bill" onClick={(e) => { e.stopPropagation(); onQuickPrint(order); }} style={{ padding: '6px', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', border: '1px solid #e2e8f0' }}><Printer size={12} color="#64748b" /></div>
                    <div title="Settle Bill" onClick={(e) => { e.stopPropagation(); onQuickSettle(order); }} style={{ padding: '6px', background: 'var(--primary)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}><CheckSquare size={12} /></div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', marginTop: '4px' }}>
                <Clock size={12} color="#64748b" />
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{statusLabel}</span>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }}></div>
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={14} color="#94a3b8" /> {order.phone || 'Walk-In'}
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', width: '100%', paddingTop: '12px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{order.order.reduce((acc, i) => acc + i.qty, 0)} Items</div>
                <div style={{ fontWeight: '800', fontSize: '16px', color: '#94161c' }}>₹{tableTotal}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* --- DIRECT ESC/POS PRINTING HARDWARE ENGINE --- */
// Connects bypassing Browser Dialog directly to USB/Serial EPSON/STAR format POS Thermal hardware
const printPosToSerial = async (orderData, type = 'BILL') => {
  let seqNumber = 1;
  try {
    const key = type === 'BILL' ? 'pos_bill_sequence' : 'pos_kot_sequence';
    seqNumber = await get(key) || 1;
    await set(key, seqNumber + 1);
  } catch (e) { }
  const formattedSeq = seqNumber.toString().padStart(4, '0');

  let settings = { billHeader: 'TYDE CAFE', billFooter: 'Thank You for Visiting!', categorizedKOT: false, billLayout: 'standard' };
  try {
    const rawSettings = await get('pos_printer_settings');
    if (rawSettings) {
      settings = rawSettings;
    }
  } catch (e) {
    console.error("Failed to parse printer settings", e);
  }

  try {
    if (!('serial' in navigator)) throw new Error('Web Serial API not supported.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const writer = port.writable.getWriter();
    const textEncoder = new TextEncoder();

    const init = new Uint8Array([0x1B, 0x40]);
    const boldOn = new Uint8Array([0x1B, 0x45, 1]);
    const boldOff = new Uint8Array([0x1B, 0x45, 0]);
    const centerAlign = new Uint8Array([0x1B, 0x61, 1]);
    const leftAlign = new Uint8Array([0x1B, 0x61, 0]);
    const rightAlign = new Uint8Array([0x1B, 0x61, 2]);
    const cutPaper = new Uint8Array([0x1D, 0x56, 0x41, 0x08]);

    const w = async (bytes) => await writer.write(bytes);
    const wT = async (text) => await writer.write(textEncoder.encode(text));

    if (type === 'KOT') {
      let groupsToPrint = [];

      if (settings.printerStations && settings.printerStations.length > 0) {
        // Station logic
        const mainItems = [];
        const stationsMap = {}; // stationName -> items

        orderData.items.forEach(item => {
          let assignedStation = null;
          for (const st of settings.printerStations) {
            if (st.categories.includes(item.cat)) {
              assignedStation = st.name;
              break;
            }
          }

          if (assignedStation) {
            if (!stationsMap[assignedStation]) stationsMap[assignedStation] = [];
            stationsMap[assignedStation].push(item);
          } else {
            mainItems.push(item);
          }
        });

        // Push separated groups
        Object.entries(stationsMap).forEach(([stName, items]) => {
          groupsToPrint.push({ title: `Station: ${stName}`, items });
        });

        // Push remaining main items on 1 KOT
        if (mainItems.length > 0) {
          groupsToPrint.push({ title: 'Main Kitchen', items: mainItems });
        }
      } else {
        // Print all items together on 1 KOT
        groupsToPrint = [{ title: 'All Items', items: orderData.items }];
      }

      // Loop through and print each required KOT slip and CUT PAPER between them
      for (const group of groupsToPrint) {
        if (group.items.length === 0) continue;

        await w(init);
        await w(centerAlign);

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        await wT(`${dateStr} ${timeStr}\n`);

        await wT(`${settings.billHeader || 'Tyde Cafe'}\n`);
        await wT(`KOT - #${formattedSeq}\n`);
        await wT(`${orderData.orderType || 'Dine In'}\n`);
        await wT(`Table No: ${orderData.tableName}\n`);
        if (orderData.orderId) await wT(`Order No: ${orderData.orderId}\n`);
        if (orderData.customerName) await wT(`Customer Name: ${orderData.customerName}\n`);
        await wT("--------------------------------\n");

        await w(leftAlign);
        await wT("Item        Special Note   Qty\n");
        await wT("--------------------------------\n");

        for (const item of group.items) {
          const nameStr = item.name.substring(0, 11).padEnd(12, ' ');
          let noteText = item.note ? item.note.substring(0, 14) : '--';
          const noteStr = noteText.padEnd(15, ' ');
          const qtyStr = item.qty.toString().padStart(5, ' ');
          await wT(`${nameStr}${noteStr}${qtyStr}\n`);
        }
        await wT("--------------------------------\n");
        await w(centerAlign);
        await wT("\n\n\n\n\n");

        // This command physically cuts the paper for the specific slip on modern thermal printers
        await w(cutPaper);
      }
    } else {
      // Standard Print (Bill or Single KOT)
      await w(init);
      await w(centerAlign);

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/');
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      if (type === 'BILL') {
        if (settings.billLayout === 'bold') await w(boldOn);
        await wT(`${settings.billHeader || 'Tyde Cafe'}\n`);
        if (settings.billLayout === 'bold') await w(boldOff);
        await wT("Nerul Ferry Terminal\n");
        await wT("--------------------------------\n");
        await w(leftAlign);
        if (orderData.customerName) {
          await wT(`Customer: ${orderData.customerName}\n`);
        }
        if (orderData.customerPhone) {
          await wT(`Phone: ${orderData.customerPhone}\n`);
        }
        if (orderData.customerName || orderData.customerPhone) {
          await wT("--------------------------------\n");
        }
        const paddedDate = `Date: ${dateStr}`.padEnd(16, ' ');
        const orderInfoLabel = `${orderData.orderType || 'Dine In'}: ${orderData.tableName || ''}`;
        await wT(`${paddedDate}${orderInfoLabel}\n`);

        await wT(`${timeStr}\n`);
        await wT(`Cashier: biller   Bill No.: ${formattedSeq}\n`);
        await wT("--------------------------------\n");
        await wT("Item              Qty  Price Amount\n");
        await wT("--------------------------------\n");

        let totalQty = 0;
        for (const item of orderData.items) {
          totalQty += item.qty;
          const nameStr = item.name.substring(0, 16).padEnd(17, ' ');
          const qtyStr = item.qty.toString().padStart(3, ' ');
          const priceStr = item.price.toFixed(2).padStart(6, ' ');
          const amtStr = (item.price * item.qty).toFixed(2).padStart(7, ' ');
          await wT(`${nameStr}${qtyStr} ${priceStr} ${amtStr}\n`);
        }
        await wT("--------------------------------\n");
        await w(rightAlign);

        const subtotalStr = (orderData.subtotal || 0).toFixed(2).padStart(8, ' ');
        await wT(` Total Qty: ${totalQty.toString().padEnd(3, ' ')}   Sub   ${subtotalStr}\n`);
        await wT(`                  Total          \n`);

        if (orderData.serviceCharge > 0) {
          const serviceChargeStr = (orderData.serviceCharge || 0).toFixed(2).padStart(8, ' ');
          await wT(` Service Charge          ${serviceChargeStr}\n`);
          await wT(`     (Optional)                  \n`);
        }

        await wT("--------------------------------\n");

        const roundOffStr = (orderData.roundOff > 0 ? '+' : '') + (orderData.roundOff || 0).toFixed(2).padStart(4, ' ');
        await wT(`              Round off     ${roundOffStr}\n`);

        await w(boldOn);
        const gTotalStr = (orderData.grandTotal || 0).toFixed(2).padStart(8, ' ');
        await wT(`      Grand Total     Rs.${gTotalStr}\n`);
        await w(boldOff);
        await wT("--------------------------------\n");
        await w(centerAlign);
        await wT(`   ${settings.billFooter || 'Sea you soon -- under the moon'} \n`);

      } else {
        // --- KOT PRINTING ---
        if (settings.billLayout === 'bold') await w(boldOn);
        await wT(`${dateStr} ${timeStr}\n`);

        const kotNo = Math.floor(1 + Math.random() * 99);
        await wT(`KOT - ${kotNo}\n`);

        await wT(`${orderData.orderType || 'Dine In'}\n`);
        if (orderData.isReprint) await wT(`*** DUPLICATE KOT ***\n`);
        if (orderData.tableName) await wT(`Table: ${orderData.tableName}\n`);
        if (orderData.orderId) await wT(`Order#: ${orderData.orderId}\n`);
        if (orderData.customerName) await wT(`Customer: ${orderData.customerName}\n`);
        if (settings.billLayout === 'bold') await w(boldOff);

        if (settings.billLayout !== 'minimal') {
          await wT("--------------------------------\n");
        } else {
          await wT("\n");
        }

        await w(leftAlign);

        if (settings.billLayout === 'compact' || settings.billLayout === 'minimal') {
          if (settings.billLayout !== 'minimal') await wT("Item           Qty\n--------------------------------\n");
          for (const item of orderData.items) {
            const nameStr = item.name.substring(0, 15).padEnd(16, ' ');
            await wT(`${nameStr}${item.qty}\n`);
          }
        } else if (settings.billLayout === 'modern') {
          await wT("Qty   Item\n--------------------------------\n");
          for (const item of orderData.items) {
            const qtyStr = item.qty.toString().padEnd(6, ' ');
            const nameStr = item.name.substring(0, 25);
            await wT(`${qtyStr}${nameStr}\n`);
          }
        } else if (settings.billLayout === 'bold') {
          await w(boldOn);
          await wT("ITEM                  QTY\n================================\n");
          for (const item of orderData.items) {
            const nameStr = item.name.substring(0, 20).padEnd(22, ' ');
            const qtyStr = item.qty.toString();
            await wT(`${nameStr}${qtyStr}\n`);
          }
          await w(boldOff);
          await wT("================================\n");
        } else {
          // standard layout matched perfectly to user provided image
          await wT("Item        Special Note   Qty\n");
          await wT("--------------------------------\n");
          for (const item of orderData.items) {
            const nameStr = item.name.substring(0, 11).padEnd(12, ' ');
            let noteText = item.note ? item.note.substring(0, 14) : '--';
            const noteStr = noteText.padEnd(15, ' ');
            const qtyStr = item.qty.toString().padStart(5, ' ');
            await wT(`${nameStr}${noteStr}${qtyStr}\n`);
          }
        }

        if (settings.billLayout !== 'minimal' && settings.billLayout !== 'bold') {
          await wT("--------------------------------\n");
        }
      }

      // Only printing KOT layout per user request (no grand total or pricing footer)

      await wT("\n\n\n\n\n");
      await w(cutPaper);
    }

    writer.releaseLock();
    await port.close();
  } catch (error) {
    console.warn("Direct Printing Hardware Handshake Failed. Emulating instead.", error);

    // Fallback: Generate a simplified HTML representation for the browser print queue
    // tailored to 80mm thermal paper widths
    let printContent = `
      <div style="width: 80mm; font-family: ${settings.printFontFamily || 'Helvetica, Arial, sans-serif'}; font-size: ${settings.printFontSize || '13'}px; font-weight: ${settings.printFontWeight || 'normal'}; color: #000; background: white; margin: 0 auto;">
        `;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    printContent += `<div style="text-align: center;">`;

    if (type === 'BILL') {
      const totalQty = orderData.items.reduce((acc, item) => acc + item.qty, 0);

      printContent += `
          <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 5px 0;">${settings.billHeader || 'Tyde Cafe'}</h2>
          <div style="font-size: 14px; margin-bottom: 10px;">Nerul Ferry Terminal</div>

          <div style="border-top: 1px solid black; margin: 8px 0;"></div>
          <div style="text-align: left; font-size: 14px;">
            ${(orderData.customerName && orderData.customerName !== 'Walk-In') ? `<div style="font-weight: bold;">Customer: ${orderData.customerName}</div>` : ''}
            ${orderData.customerPhone ? `<div>Phone: ${orderData.customerPhone}</div>` : ''}
            ${!(orderData.customerName && orderData.customerName !== 'Walk-In') && !orderData.customerPhone ? '<div>Customer: Walk-In</div>' : ''}
          </div>
          <div style="border-top: 1px solid black; margin: 8px 0;"></div>

          <div style="display: flex; justify-content: space-between; text-align: left; font-size: 14px;">
            <div style="flex: 1.2;">
              <div>Date: ${dateStr}</div>
              <div>${timeStr}</div>
              <div style="margin-top: 2px;">Cashier: biller</div>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: bold;">${orderData.orderType || 'Dine In'}: ${orderData.tableName || 'B4'}</div>
              <div style="margin-top: 18px;">Bill No.: ${formattedSeq}</div>
            </div>
          </div>

          <div style="border-top: 1px solid black; margin: 8px 0;"></div>

          <table style="width: 100%; text-align: left; font-size: 13px; border-collapse: collapse;">
            <tr>
              <th style="font-weight: normal; padding-bottom: 4px;">Item</th>
              <th style="font-weight: normal; text-align: right; padding-bottom: 4px;">Qty.</th>
              <th style="font-weight: normal; text-align: right; padding-bottom: 4px;">Price</th>
              <th style="font-weight: normal; text-align: right; padding-bottom: 4px;">Amount</th>
            </tr>
            <tr><td colspan="4" style="border-top: 1px solid black; margin: 8px 0;"></td></tr>
            `;
      for (let item of orderData.items) {
        printContent += `<tr>
             <td style="padding-top: 4px;">${item.name}</td>
             <td style="text-align: right; padding-top: 4px;">${item.qty}</td>
             <td style="text-align: right; padding-top: 4px;">${item.price.toFixed(2)}</td>
             <td style="text-align: right; padding-top: 4px;">${(item.price * item.qty).toFixed(2)}</td>
           </tr>`;
      }
      printContent += `
          </table>

          <div style="border-top: 1px solid black; margin: 8px 0;"></div>

          <div style="display: flex; font-size: 13px; text-align: right;">
            <div style="flex: 3; padding-right: 15px;">
              <div style="margin-bottom: 15px;">Total Qty: ${totalQty}</div>
              ${orderData.serviceCharge > 0 ? `
              <div>Service Charge</div>
              <div>(Optional)</div>
              ` : ''}
            </div>
            <div style="flex: 2; display: flex;">
              <div style="flex: 1; text-align: left;">
                <div>Sub</div>
                <div>Total</div>
              </div>
              <div style="flex: 1.5; text-align: right;">
                <div style="margin-bottom: 15px;"><br>${(orderData.subtotal || 0).toFixed(2)}</div>
                ${orderData.serviceCharge > 0 ? `
                 <div>${(orderData.serviceCharge || 0).toFixed(2)}</div>
                 ` : ''}
              </div>
            </div>
          </div>

          <div style="border-top: 1px solid black; margin: 8px 0;"></div>

          <div style="display: flex; justify-content: flex-end; font-size: 12px; margin-bottom: 4px;">
            <div style="margin-right: 15px;">Round off</div>
            <div>${orderData.roundOff > 0 ? '+' : ''}${(orderData.roundOff || 0).toFixed(2)}</div>
          </div>

          <div style="display: flex; justify-content: flex-end; align-items: center;">
            <div style="font-size: 15px; font-weight: bold; margin-right: 15px;">Grand Total</div>
            <div style="font-size: 16px; font-weight: bold;">₹${(orderData.grandTotal || 0).toFixed(2)}</div>
          </div>

          <div style="border-top: 1px solid black; margin: 8px 0;"></div>

          <div style="font-size: 13px; margin-top: 4px;">${settings.billFooter || 'Sea you soon &mdash; under the moon'}</div>
          `;

    } else { // KOT
      let groupsToPrint = [];

      if (settings.printerStations && settings.printerStations.length > 0) {
        // Station logic
        const mainItems = [];
        const stationsMap = {}; // stationName -> items

        orderData.items.forEach(item => {
          let assignedStation = null;
          for (const st of settings.printerStations) {
            if (st.categories.includes(item.cat)) {
              assignedStation = st.name;
              break;
            }
          }

          if (assignedStation) {
            if (!stationsMap[assignedStation]) stationsMap[assignedStation] = [];
            stationsMap[assignedStation].push(item);
          } else {
            mainItems.push(item);
          }
        });

        // Push separated groups
        Object.entries(stationsMap).forEach(([stName, items]) => {
          groupsToPrint.push({ title: `Station: ${stName}`, items });
        });

        if (mainItems.length > 0) {
          groupsToPrint.push({ title: 'Main Kitchen', items: mainItems });
        }
      } else {
        groupsToPrint = [{ title: 'All Items', items: orderData.items }];
      }

      for (let i = 0; i < groupsToPrint.length; i++) {
        const group = groupsToPrint[i];
        if (group.items.length === 0) continue;

        printContent += `
          <div style="${i < groupsToPrint.length - 1 ? 'page-break-after: always; margin-bottom: 20px;' : ''}">
            <div style="font-size: 14px; font-weight: bold;">${dateStr} ${timeStr}</div>
            <h2 style="margin: 5px 0; font-size: 22px; font-weight: 900;">KOT - ${formattedSeq}</h2>
            <div style="font-size: 16px; font-weight: bold;">${orderData.orderType || 'Dine In'} ${orderData.isReprint ? '(REPRINT)' : ''}</div>
            ${orderData.tableName ? `<div style="font-size: 16px; font-weight: bold;">Table: ${orderData.tableName}</div>` : ''}
            ${orderData.orderId ? `<div style="font-size: 16px; font-weight: bold;">Order No: ${orderData.orderId}</div>` : ''}
            ${orderData.customerName ? `<div style="font-size: 16px; font-weight: bold;">Customer: ${orderData.customerName}</div>` : ''}
            <div>--------------------------------</div>
            <table style="width: 100%; text-align: left; font-size: 16px; font-weight: bold;">
              <tr>
                <th style="width: 70%">Item</th>
                <th style="text-align: right;">Qty</th>
              </tr>
              <tr><td colspan="2">--------------------------------</td></tr>
              `;
        for (let item of group.items) {
          printContent += `<tr>
               <td style="padding-top: 6px;">
                <div>${item.name}</div>
                ${item.note ? `<div style="font-size: 12px; font-style: italic; color: #333;">*${item.note}</div>` : ''}
               </td>
               <td style="text-align: right; padding-top: 6px;">${item.qty}</td>
             </tr>`;
        }
        printContent += `
            </table>
            <div>--------------------------------</div>
          </div>
          `;
      }
    }

    printContent += `</div></div>`;

    // Create iframe to isolate print styles
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';

    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(`
      <html>
        <head>
          <style>
            @page {margin: 0; }
            body {margin: 0; padding: 4mm; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
      `);
    frameDoc.close();

    // Focus and print the iframe
    printFrame.contentWindow.focus();
    printFrame.contentWindow.print();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(printFrame);
    }, 1000);
  }
};


const OrderingSystem = ({ table, tables, nonTableOrders, initialOrder, onBack, onSaveOrder, onSettleTable, onChangeTable, MENU_ITEMS, CATEGORIES, customers, settings }) => {
  const [cart, setCart] = useState(initialOrder || []);
  const [activeCat, setActiveCat] = useState("Quick Snack's");
  const [searchQuery, setSearchQuery] = useState('');
  const isPickup = table?.type === 'Takeaway' || table?.type === 'Delivery';
  const [orderNote, setOrderNote] = useState(table?.note || '');

  // Customer CRM State
  const [customerPhone, setCustomerPhone] = useState(table?.phone || '');
  const [customerName, setCustomerName] = useState(table?.customerName || '');
  const [customerInfo, setCustomerInfo] = useState(null);
  const [redeemedPoints, setRedeemedPoints] = useState(0);

  useEffect(() => {
    if (customerPhone.length === 10 && customers && customers[customerPhone]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomerInfo(customers[customerPhone]);
      setCustomerName(customers[customerPhone].name);
    } else if (table?.customerName || table?.phone) {
      setCustomerName(table.customerName || '');
      setCustomerPhone(table.phone || '');
      setCustomerInfo(null);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomerInfo(null);
      setRedeemedPoints(0);
    }
  }, [customerPhone, customers]);

  // Modifiers & Modal State
  const [showModifierModal, setShowModifierModal] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(null);
  const [customNoteText, setCustomNoteText] = useState('');

  // Service Charge & Discount State
  const [applyServiceCharge, setApplyServiceCharge] = useState(isPickup ? false : (settings?.autoServiceCharge ?? true));
  const [serviceChargeRate, setServiceChargeRate] = useState(settings?.serviceChargeRate ?? 5);

  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountRate, setDiscountRate] = useState(10);
  const [splitWays, setSplitWays] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discountAuth, setDiscountAuth] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isPaid, setIsPaid] = useState(false);

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const discountAmt = applyDiscount ? (subtotal * (discountRate / 100)) : 0;
  const taxableAmount = Math.max(0, subtotal - discountAmt - redeemedPoints);
  const serviceCharge = applyServiceCharge ? (taxableAmount * (serviceChargeRate / 100)) : 0;
  const rawTotal = taxableAmount + serviceCharge;
  const grandTotal = Math.round(rawTotal);
  const roundOff = grandTotal - rawTotal;

  // Calculate globally reserved stock (qty already in other running tables/orders)
  // This satisfies the "live update" requirement so punched orders reflect immediately across the floor.
  const getReservedStock = (itemId) => {
    let reserved = 0;
    // Check all tables
    (tables || []).forEach(t => {
      if (t.id !== table?.id) { // Skip current table
        (t.order || []).forEach(i => {
          if (i.id === itemId) reserved += i.qty;
        });
      }
    });
    // Check all non-table orders (takeaways, deliveries, online)
    (nonTableOrders || []).forEach(o => {
      if (o.id !== table?.id) { // Skip current takeaway/delivery if editing one
        (o.order || []).forEach(i => {
          if (i.id === itemId) reserved += i.qty;
        });
      }
    });
    return reserved;
  };

  const handleItemClick = (item) => {
    if (!item.inStock) return;
    if (item.modifiers && item.modifiers.length > 0) {
      setShowModifierModal(item);
    } else {
      addToCart(item);
    }
  };

  const addToCart = (item, selectedModifier = null) => {
    if (item.type === 'retail') {
      const currentCartQty = cart.reduce((acc, c) => c.id === item.id ? acc + c.qty : acc, 0);
      const otherReservedQty = getReservedStock(item.id);
      const totalAvailable = item.stockQuantity - otherReservedQty;

      if (currentCartQty >= totalAvailable) {
        alert(`Cannot add more. Only ${totalAvailable} units available across all active orders.`);
        return;
      }
    }

    setCart(prev => {
      // If item has a specific price modifier like (+₹30), parse and add it
      let finalPrice = item.price;
      let nameNote = '';
      if (selectedModifier) {
        nameNote = ` - ${selectedModifier}`;
        const priceMatch = selectedModifier.match(/\(\+₹(\d+)\)/);
        if (priceMatch) {
          finalPrice += parseInt(priceMatch[1], 10);
        }
      }

      const cartItemId = `${item.id}${selectedModifier ? `-${selectedModifier}` : ''}`;
      const existing = prev.find(i => i.cartItemId === cartItemId);

      if (existing) {
        return prev.map(i => i.cartItemId === cartItemId ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, cartItemId, name: item.name + nameNote, price: finalPrice, qty: 1 }];
    });
    setShowModifierModal(null);
  };

  const updateQty = (cartItemId, delta) => {
    if (delta > 0) {
      const cartItem = cart.find(i => i.cartItemId === cartItemId);
      if (cartItem && cartItem.type === 'retail') {
        const currentCartQty = cart.reduce((acc, c) => c.id === cartItem.id ? acc + c.qty : acc, 0);
        const otherReservedQty = getReservedStock(cartItem.id);
        const totalAvailable = cartItem.stockQuantity - otherReservedQty;

        if (currentCartQty >= totalAvailable) {
          alert(`Cannot add more. Only ${totalAvailable} units available across all active orders.`);
          return;
        }
      }
    }

    setCart(prev => {
      return prev.map(i => {
        if (i.cartItemId === cartItemId) {
          return { ...i, qty: Math.max(0, i.qty + delta) };
        }
        return i;
      }).filter(i => i.qty > 0);
    });
  };

  const handleAction = async (actionType) => {
    let updatedCart = [...cart];
    let itemsToPrint = [];

    const isKOT = actionType.includes('KOT');
    const isPrint = actionType.includes('Print');
    const isBill = actionType === 'Print Bill' || actionType.includes('Bill');
    const newStatus = isKOT ? 'kot' : isPrint ? 'printed' : 'running';

    if (isKOT) {
      updatedCart = cart.map(item => {
        const prevPrintedQty = item.printedQty || 0;
        const newQty = item.qty - prevPrintedQty;
        if (newQty > 0) {
          itemsToPrint.push({ ...item, qty: newQty });
          return { ...item, printedQty: item.qty };
        }
        return item;
      });

      if (isPrint && !isBill && itemsToPrint.length === 0) {
        if (actionType === 'KOT & Print') {
          itemsToPrint = cart.map(item => ({ ...item }));
          actionType += ' (Reprint)'; // Flag for printPosToSerial
        } else {
          alert("No new items to print for KOT.");
          return;
        }
      }
    } else if (isBill) {
      itemsToPrint = cart;
    }

    if (isPaid && actionType.includes('Save')) {
      // Settle and clear table with full analytics data
      onSettleTable(table.id, { cart: updatedCart, subtotal, discountAmt, redeemedPoints, discountAuth, taxes: 0, grandTotal, paymentMethod, timestamp: new Date().toISOString(), phone: customerPhone, customerName, note: orderNote });
    } else {
      // Just save order state
      setCart(updatedCart); // update local state so diff tracking is consistent
      onSaveOrder(table.id, updatedCart, newStatus, { customerName, customerPhone, note: orderNote });
    }

    if (isPrint) {
      await printPosToSerial({
        orderId: table?.id,
        isReprint: actionType.includes('Reprint'),
        tableName: (table?.name && table?.name.trim() !== '') ? table.name : `Table ${table?.id}`,
        customerName: customerName,
        customerPhone: customerPhone,
        items: itemsToPrint,
        subtotal: subtotal,
        serviceCharge: serviceCharge,
        roundOff: roundOff,
        grandTotal: grandTotal,
        orderType: table?.type === 'Delivery' ? 'Delivery' : table?.type === 'Takeaway' ? 'Pick Up' : 'Dine In'
      }, isBill ? 'BILL' : 'KOT');
    }
  };

  const filteredItems = MENU_ITEMS.filter(item =>
    (searchQuery.trim() !== '' || activeCat === 'All' || item.cat === activeCat) &&
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animate-fade-in" style={{ flex: 1, display: 'flex', background: '#f3f4f6', position: 'relative' }}>

      {/* Category Sidebar */}
      <div className="menu-sidebar no-print">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`menu-cat-btn ${activeCat === cat ? 'active' : ''}`}
            onClick={() => setActiveCat(cat)}
            style={{ fontWeight: activeCat === cat ? '700' : '500' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Item Grid Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb' }}>
        <div style={{ padding: '8px 12px', background: 'white', borderBottom: '1px solid #e5e7eb' }} className="no-print">
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="#6b7280" />
            <input
              type="text"
              placeholder="Search item"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '13px' }}
            />
          </div>
        </div>

        <div className="items-grid no-scrollbar" style={{ overflowY: 'auto', flex: 1, background: '#f3f4f6' }}>
          {filteredItems.map(item => {
            const isRetail = item.type === 'retail';
            let liveStock = null;
            let isAvailable = item.inStock;

            if (isRetail) {
              const cartQty = cart.reduce((acc, c) => c.id === item.id ? acc + c.qty : acc, 0);
              const otherReserved = getReservedStock(item.id);
              liveStock = item.stockQuantity - otherReserved - cartQty;
              isAvailable = liveStock > 0;
            }

            return (
              <div
                key={item.id}
                className={`item-card ${item.type}`}
                onClick={() => {
                  if (isAvailable || !isRetail) handleItemClick(item);
                }}
                style={{
                  background: 'white',
                  opacity: isAvailable ? 1 : 0.5,
                  cursor: isAvailable ? 'pointer' : 'not-allowed'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  {item.name} {item.modifiers && <span style={{ color: '#94161c', fontSize: '10px' }}>*</span>}
                  {isRetail && <span style={{ marginLeft: '6px', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '9px' }}>Stock: {liveStock}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold' }}>₹{item.price}</div>
                  {!isAvailable && <div style={{ fontSize: '10px', color: 'red', fontWeight: 'bold' }}>Out of Stock</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing Panel */}
      <div className="billing-panel no-print">
        <div style={{ background: '#94161c', color: 'white', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{table?.name || 'New Order'}</div>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Close</button>
        </div>

        <div style={{ padding: '8px 12px', display: 'flex', borderBottom: '1px solid #e5e7eb', alignItems: 'center', gap: '12px' }}>
          {tables ? (
            <select
              value={table?.id || ''}
              onChange={(e) => {
                if (onChangeTable && e.target.value !== String(table?.id)) {
                  onChangeTable(table.id, Number(e.target.value), cart);
                }
              }}
              style={{ border: '1px solid #94161c', color: '#94161c', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', outline: 'none', background: 'white' }}
            >
              <option value={table?.id} disabled>{table?.name || 'Walk-In'}</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
              ))}
            </select>
          ) : (
            <div style={{ border: '1px solid #94161c', color: '#94161c', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              {table?.name || 'Walk-In'}
            </div>
          )}
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', fontSize: '11px', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline' }}>
            {table && (String(table.id).startsWith('DEL-') || String(table.id).startsWith('TAK-')) ? 'Back to Online' : 'Back to Tables'}
          </button>
          <div style={{ marginLeft: 'auto', background: '#94161c', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
            {table?.type === 'Delivery' ? 'Delivery' : table?.type === 'Takeaway' ? 'Takeaway' : 'Dine In'}
          </div>
        </div>

        {/* --- CRM & CUSTOMER INFO SECTION --- */}
        <div style={{ padding: '10px 12px', background: isPickup ? '#faf5ff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: (customerInfo || isPickup) ? '8px' : '0' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', color: isPickup ? 'var(--secondary)' : '#64748b', marginBottom: '2px' }}>CUSTOMER NAME (Optional)</label>
              <input
                type="text"
                placeholder="Walk-In"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', background: 'white' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', color: isPickup ? 'var(--secondary)' : '#64748b', marginBottom: '2px' }}>PHONE NUMBER (Optional)</label>
              <input
                type="text"
                placeholder="Mobile number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', background: 'white' }}
                maxLength="10"
              />
            </div>
          </div>

          {customerInfo && (
            <div style={{ padding: '6px 10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '11px', color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={12} />
                <span>Visit #{customerInfo.visits}</span>
              </div>
              <span style={{ fontWeight: 'bold' }}>{customerInfo.points} Pts</span>
            </div>
          )}
          {isPickup && (!customerName || customerPhone.length < 10) && (
            <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold', marginTop: '4px' }}>
              ⚠ Required for pickup orders
            </div>
          )}
        </div>
        {/* --- END CRM SECTION --- */}

        <div style={{ padding: '8px 12px', display: 'flex', fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ flex: 1 }}>ITEMS</div>
          <div style={{ width: '80px', textAlign: 'center' }}>QTY.</div>
          <div style={{ width: '80px', textAlign: 'right' }}>PRICE</div>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <Utensils size={48} color="#d1d5db" />
              <div style={{ fontWeight: 'bold', fontSize: '14px', marginTop: '10px' }}>No Item Selected</div>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.cartItemId} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f9fafb' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px' }}>{item.name}</div>
                  {item.note && <div style={{ fontSize: '10px', color: '#94161c', fontStyle: 'italic' }}>* {item.note}</div>}
                  <div style={{ fontSize: '10px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ₹{item.price} /ea
                    <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6, padding: 0 }}
                      onClick={() => {
                        setCustomNoteText(item.note || '');
                        setShowNoteModal(item);
                      }}>
                      <MessageSquare size={12} color="#94161c" />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '80px', justifyContent: 'center' }}>
                  <button style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => updateQty(item.cartItemId, -1)}><Minus size={12} /></button>
                  <span style={{ fontSize: '12px', fontWeight: '500' }}>{item.qty}</span>
                  <button style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => updateQty(item.cartItemId, 1)}><Plus size={12} /></button>
                </div>
                <div style={{ width: '80px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold' }}>₹{item.price * item.qty}</div>
              </div>
            ))
          )}
        </div>

        {/* Financials & Footer */}
        <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Subtotal</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>₹{subtotal.toFixed(2)}</span>
            </div>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px',
                marginTop: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Advanced Options
            </button>

            {showAdvanced && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }} className="animate-fade-in">
                {/* Discount */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="discount-toggle" checked={applyDiscount} onChange={(e) => setApplyDiscount(e.target.checked)} />
                    <label htmlFor="discount-toggle" style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>Discount %</label>
                  </div>
                  {applyDiscount && (
                    <input type="number" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} style={{ width: '50px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontSize: '12px' }} />
                  )}
                </div>

                {/* Service Charge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="service-toggle" checked={applyServiceCharge} onChange={(e) => setApplyServiceCharge(e.target.checked)} />
                    <label htmlFor="service-toggle" style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>Service Charge %</label>
                  </div>
                  {applyServiceCharge && (
                    <input type="number" value={serviceChargeRate} onChange={(e) => setServiceChargeRate(e.target.value)} style={{ width: '50px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontSize: '12px' }} />
                  )}
                </div>

                {/* Split Bill */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>Split Bill (Ways)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button style={{ border: '1px solid #cbd5e1', background: 'white', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setSplitWays(Math.max(1, splitWays - 1))}>-</button>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{splitWays}</span>
                    <button style={{ border: '1px solid #cbd5e1', background: 'white', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setSplitWays(splitWays + 1)}>+</button>
                  </div>
                </div>

                {/* Order Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>Order Note / Instructions</label>
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Add general instructions for this order..."
                    style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', minHeight: '60px', outline: 'none', resize: 'none' }}
                  />
                </div>

                {/* Loyalty Redeemed */}
                {redeemedPoints > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>
                    <span>Points Redeemed</span>
                    <span>-₹{redeemedPoints.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Amount</div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#94161c' }}>₹{grandTotal.toFixed(2)}</div>
              {splitWays > 1 && <div style={{ fontSize: '11px', color: '#94161c', fontWeight: 'bold' }}>₹{(grandTotal / splitWays).toFixed(2)} / person</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['Cash', 'Card', 'UPI'].map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: paymentMethod === method ? '#94161c' : '#e2e8f0',
                      background: paymentMethod === method ? '#fef2f2' : 'white',
                      color: paymentMethod === method ? '#94161c' : '#64748b',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {method}
                  </button>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isPaid} onChange={() => setIsPaid(!isPaid)} />
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Mark as Paid</span>
              </label>
            </div>
          </div>

          <div className="footer-btn-grid">
            <button className="btn-maroon" onClick={() => handleAction('Save')}>Save</button>
            <button className="btn-maroon" onClick={() => handleAction('Print Bill')}>Print Bill</button>
            <button className="btn-grey" onClick={() => handleAction('KOT')}>KOT</button>
            <button className="btn-grey" style={{ background: '#374151' }} onClick={() => handleAction('KOT & Print')}>KOT & Print</button>
          </div>
        </div>
      </div>

      {/* Modifier Modal Overlay */}
      {showModifierModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: 'bold', fontSize: '18px', color: '#1f2937' }}>Attributes for {showModifierModal.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }} className="no-scrollbar">
              {showModifierModal.modifiers.map(mod => (
                <button
                  key={mod}
                  onClick={() => addToCart(showModifierModal, mod)}
                  style={{ padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', textAlign: 'left', background: '#f9fafb', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.target.style.background = '#f9fafb'}
                >
                  {mod}
                </button>
              ))}
              <button
                onClick={() => addToCart(showModifierModal, 'Regular')}
                style={{ padding: '14px 16px', border: '1px solid #10b981', color: '#10b981', borderRadius: '8px', textAlign: 'left', background: '#ecfdf5', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Regular (No Mods)
              </button>
            </div>
            <button
              onClick={() => setShowModifierModal(null)}
              style={{ padding: '12px', marginTop: '16px', width: '100%', border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}



      {/* Kitchen Note Modal */}
      {showNoteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '340px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: 'bold', fontSize: '18px', color: '#1f2937' }}>Kitchen Instructions</h3>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>Add special requests for {showNoteModal.name}</p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Extra spicy, No onions..."
              value={customNoteText}
              onChange={(e) => setCustomNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setCart(prev => prev.map(i => i.cartItemId === showNoteModal.cartItemId ? { ...i, note: customNoteText } : i));
                  setShowNoteModal(null);
                }
              }}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setCart(prev => prev.map(i => i.cartItemId === showNoteModal.cartItemId ? { ...i, note: '' } : i));
                  setShowNoteModal(null);
                }}
                style={{ flex: 1, padding: '12px', background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                Clear Note
              </button>
              <button
                onClick={() => {
                  setCart(prev => prev.map(i => i.cartItemId === showNoteModal.cartItemId ? { ...i, note: customNoteText } : i));
                  setShowNoteModal(null);
                }}
                style={{ flex: 1, padding: '12px', background: '#94161c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- ANALYTICS DASHBOARD --- */
const AnalyticsDashboard = ({ orderHistory, menuItems }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [chartType, setChartType] = useState('Bar Chart');

  // Generate unique dates from history for selection
  const availableDates = Array.from(new Set(orderHistory.map(o => new Date(o.timestamp).toISOString().split('T')[0]))).sort().reverse();

  const filteredHistory = orderHistory.filter(order => {
    const d = new Date(order.timestamp).toISOString().split('T')[0];
    return d === selectedDate;
  });

  const totalSales = filteredHistory.reduce((acc, order) => acc + order.grandTotal, 0);
  const totalOrders = filteredHistory.length;
  
  const typeSales = { 'Dine In': 0, 'Pick Up': 0, 'Delivery': 0 };
  const typeOrders = { 'Dine In': 0, 'Pick Up': 0, 'Delivery': 0 };

  filteredHistory.forEach(order => {
    const oType = order.tableId && (String(order.tableId).startsWith('TAK') ? 'Pick Up' : (String(order.tableId).startsWith('DEL') ? 'Delivery' : 'Dine In'));
    typeSales[oType] += order.grandTotal;
    typeOrders[oType] += 1;
  });

  const cashSales = filteredHistory.filter(o => o.paymentMethod === 'Cash').reduce((acc, o) => acc + o.grandTotal, 0);
  const onlineSalesVal = filteredHistory.filter(o => o.paymentMethod !== 'Cash').reduce((acc, o) => acc + o.grandTotal, 0);
  const cashPercent = totalSales > 0 ? (cashSales / totalSales) * 100 : 0;
  const onlinePercent = totalSales > 0 ? (onlineSalesVal / totalSales) * 100 : 0;

  const betterHourlyData = Array.from({ length: 12 }).map((_, i) => {
    const startHour = i * 2;
    const endHour = startHour + 2;
    const startStr = `${startHour === 0 ? 12 : (startHour > 12 ? startHour - 12 : startHour)} ${startHour >= 12 ? 'PM' : 'AM'}`;
    const label = `${startStr}`;
    const revenue = filteredHistory.filter(o => {
      const h = new Date(o.timestamp).getHours();
      return h >= startHour && h < endHour;
    }).reduce((acc, o) => acc + o.grandTotal, 0);
    return { label, revenue };
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#fcfcfd', display: 'flex' }} className="animate-fade-in no-scrollbar">
      {/* Left Main Dashboard */}
      <div style={{ flex: 1, padding: '24px', maxWidth: '1200px' }}>
        {/* Sync Status Info */}
        <div style={{ background: 'white', padding: '14px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>Operational data for <strong>{new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
             <select 
               value={selectedDate} 
               onChange={e => setSelectedDate(e.target.value)}
               style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '900', color: '#1e293b', background: 'white' }}
             >
               {availableDates.length > 0 ? availableDates.map(d => (
                 <option key={d} value={d}>{new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</option>
               )) : <option value={new Date().toISOString().split('T')[0]}>Today</option>}
             </select>
          </div>
        </div>

        {/* Metrics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Sales', val: totalSales, orders: totalOrders, color: '#94161c', icon: BarChart3 },
            { label: 'Dine In', val: typeSales['Dine In'], orders: typeOrders['Dine In'], color: '#3b82f6', icon: Utensils },
            { label: 'Pick Up', val: typeSales['Pick Up'], orders: typeOrders['Pick Up'], color: '#f59e0b', icon: ShoppingBag },
            { label: 'Delivery', val: typeSales['Delivery'], orders: typeOrders['Delivery'], color: '#10b981', icon: Truck },
          ].map((m, idx) => (
            <div key={idx} style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', position: 'relative', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '900', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '950', color: '#1e293b' }}>₹ {m.val.toLocaleString()}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', fontWeight: '700' }}>{m.orders} Orders</div>
              <div style={{ position: 'absolute', top: '24px', right: '24px', width: '36px', height: '36px', borderRadius: '10px', background: `${m.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <m.icon size={20} color={m.color} />
              </div>
            </div>
          ))}
        </div>

        {/* Chart Card */}
        <div style={{ background: 'white', padding: '32px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '950', color: '#1e293b', letterSpacing: '-0.5px' }}>Sales (Hourly)</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select value={chartType} onChange={e => setChartType(e.target.value)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '800' }}>
                <option>Bar Chart</option>
                <option>Line Chart</option>
              </select>
            </div>
          </div>
          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'Bar Chart' ? (
                <BarChart data={betterHourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: '700' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: '700' }} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              ) : (
                <LineChart data={betterHourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: '700' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: '700' }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 8 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Bifurcation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: '950', color: '#1e293b' }}>Payment Bifurcation</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <div style={{ flex: 1, height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                   <div style={{ width: `${cashPercent}%`, height: '100%', background: '#94161c' }} />
                   <div style={{ width: `${onlinePercent}%`, height: '100%', background: '#3b82f6' }} />
                 </div>
                 <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', minWidth: '80px', textAlign: 'right' }}>₹ {totalSales.toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94161c' }} />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Cash: <strong>₹{cashSales.toLocaleString()}</strong> ({cashPercent.toFixed(1)}%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Online: <strong>₹{onlineSalesVal.toLocaleString()}</strong> ({onlinePercent.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: '950', color: '#1e293b' }}>Expenses & Withdrawal</div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', textAlign: 'center', padding: '10px' }}>No records found</div>
          </div>
        </div>
      </div>

      {/* Right Intelligence Sidebar */}
      <div style={{ width: '340px', padding: '32px', borderLeft: '1px solid #e2e8f0', background: 'white', height: '100vh', overflowY: 'auto' }} className="no-scrollbar">
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '950', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Alerts <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '900' }}>1</span>
            </h4>
          </div>
          <div style={{ background: '#fff1f2', padding: '16px', borderRadius: '14px', border: '1px solid #ffe4e6' }}>
            <div style={{ fontWeight: '900', fontSize: '14px', color: '#be123c' }}>90 Items Missing Description</div>
            <div style={{ fontSize: '12px', color: '#be123c', marginTop: '6px', opacity: 0.8, lineHeight: 1.5 }}>Add description to enhance customer awareness and drive online ordering.</div>
          </div>
        </div>

        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h4 style={{ fontSize: '15px', fontWeight: '950', color: '#1e293b' }}>Order Statistics</h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div style={{ textAlign: 'center', background: '#f8fafc', padding: '12px', borderRadius: '12px' }}><div style={{ fontSize: '20px', fontWeight: '950' }}>{totalOrders}</div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', marginTop: '2px' }}>Successful</div></div>
            <div style={{ textAlign: 'center', background: '#f8fafc', padding: '12px', borderRadius: '12px' }}><div style={{ fontSize: '20px', fontWeight: '950' }}>0</div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', marginTop: '2px' }}>Cancel</div></div>
            <div style={{ textAlign: 'center', background: '#f8fafc', padding: '12px', borderRadius: '12px' }}><div style={{ fontSize: '20px', fontWeight: '950' }}>0</div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', marginTop: '2px' }}>Gifted</div></div>
          </div>
          <div style={{ marginTop: '20px', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
            <Clock size={16} color="#0284c7" /> <span style={{ fontWeight: '700' }}>35.28 mins</span> Avg turnaround.
          </div>
        </div>

        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h4 style={{ fontSize: '15px', fontWeight: '950', color: '#1e293b' }}>Revenue Leakage</h4>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '12px', fontWeight: '900', color: '#94a3b8' }}>
            <span>BILLS</span>
            <span>KOTS</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', fontSize: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: '700' }}><strong style={{ color: '#1e293b' }}>1</strong> Modified</div>
              <div style={{ fontWeight: '700' }}><strong style={{ color: '#1e293b' }}>2</strong> Re-Printed</div>
              <div style={{ fontWeight: '700' }}><strong style={{ color: '#1e293b' }}>0</strong> Waived Off</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: '700' }}><strong style={{ color: '#1e293b' }}>0</strong> Cancelled</div>
              <div style={{ fontWeight: '700' }}><strong style={{ color: '#1e293b' }}>2</strong> Modified</div>
              <div style={{ fontWeight: '700' }}><strong style={{ color: '#1e293b' }}>7</strong> Ghosted</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', position: 'relative' }}>
          <div style={{ fontSize: '13px', fontWeight: '900', color: '#1e293b', marginBottom: '20px' }}>Quick Support</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ffefef', border: '2px solid white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={24} color="#94161c" /></div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '950', color: '#1e293b' }}>Pushpendra Singh</div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>Account Manager • #42227</div>
            </div>
          </div>
          <button style={{ width: '100%', marginTop: '24px', padding: '14px', borderRadius: '14px', background: 'white', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '950', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = 'white'; }} onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#1e293b'; }}>
            <MessageSquare size={16} /> WhatsApp Help
          </button>
        </div>
      </div>
    </div>
  );
};

/* --- DAY CLOSE WIZARD --- */
const DayCloseWizard = ({ orderHistory, onCompleteDayClose }) => {
  const [cashCount, setCashCount] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  const payments = { Cash: 0, Card: 0, UPI: 0 };
  let totalDiscounts = 0;

  orderHistory.forEach(order => {
    payments[order.paymentMethod] = (payments[order.paymentMethod] || 0) + order.grandTotal;
    totalDiscounts += order.discountAmt || 0;
  });

  const totalExpectedSales = payments.Cash + payments.Card + payments.UPI;
  const cashDifference = parseFloat(cashCount || 0) - payments.Cash;

  const handleClose = () => {
    if (cashCount === '') {
      alert("Please enter the physical cash counted in the drawer.");
      return;
    }
    setIsCompleted(true);
  };

  if (isCompleted) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: '20px' }} className="animate-fade-in">
        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px' }}>
          <CheckSquare size={48} color="#10b981" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Day Closed Successfully</h2>
          <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>All tables have been cleared and reports are saved. The system is ready for the next shift.</p>
          <button
            onClick={onCompleteDayClose}
            style={{ width: '100%', padding: '12px', background: '#94161c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Start Fresh Shift
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '30px', background: '#f9fafb', overflowY: 'auto' }} className="animate-fade-in no-scrollbar">
      <div style={{ background: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: '100%', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sunset size={28} color="#94161c" /> End of Day Settlement (Z-Report)
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '32px', fontSize: '14px' }}>Validate your cash drawer before wiping the system for the next day. This action cannot be undone.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>SYSTEM NET SALES</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>₹{totalExpectedSales.toFixed(2)}</div>
          </div>
          <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>TOTAL DISCOUNTS GIVEN</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#94161c' }}>₹{totalDiscounts.toFixed(2)}</div>
          </div>
          <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 'bold' }}>UPI / DIGITAL</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#5b21b6' }}>₹{payments.UPI.toFixed(2)}</div>
          </div>
          <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 'bold' }}>CREDIT/DEBIT CARDS</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1d4ed8' }}>₹{payments.Card.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ borderTop: '2px dashed #e5e7eb', margin: '32px 0' }}></div>

        <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px' }}>Cash Drawer Verification</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#059669', fontWeight: 'bold' }}>SYSTEM EXPECTED CASH</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#065f46' }}>₹{payments.Cash.toFixed(2)}</div>
          </div>
          <Banknote size={32} color="#059669" opacity={0.3} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Physical Cash Counted (₹)</label>
            <input
              type="number"
              value={cashCount}
              onChange={(e) => setCashCount(e.target.value)}
              placeholder="Enter cash found in drawer..."
              style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '16px', outline: 'none' }}
              autoComplete="off"
            />
          </div>

          {cashCount !== '' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: cashDifference === 0 ? '#ecfdf5' : cashDifference > 0 ? '#eff6ff' : '#fef2f2', border: `1px solid ${cashDifference === 0 ? '#a7f3d0' : cashDifference > 0 ? '#bfdbfe' : '#fecaca'}`, borderRadius: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: cashDifference === 0 ? '#059669' : cashDifference > 0 ? '#2563eb' : '#dc2626' }}>
                {cashDifference === 0 ? "Drawer is Perfectly Balanced" : cashDifference > 0 ? "Cash Overage (Surplus)" : "Cash Shortage (Missing)"}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: cashDifference === 0 ? '#059669' : cashDifference > 0 ? '#2563eb' : '#dc2626' }}>
                {cashDifference > 0 ? "+" : ""}
                ₹{cashDifference.toFixed(2)}
              </span>
            </div>
          )}

        </div>

        <button
          className="btn-pp btn-pp-primary"
          onClick={handleClose}
          style={{ width: '100%', padding: '14px', fontSize: '16px', background: '#94161c' }}
        >
          Confirm Day Close & Print Z-Report
        </button>
      </div>
    </div>
  );
};


const TimeElapsed = ({ createdAt }) => {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    if (!createdAt) return;
    const update = () => {
      const diff = Math.floor((Date.now() - createdAt) / 60000);
      setElapsed(diff);
    };
    update();
    const inv = setInterval(update, 60000);
    return () => clearInterval(inv);
  }, [createdAt]);

  if (!createdAt) return null;
  return <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>{elapsed}m ago</div>;
};

const QuickPrintModal = ({ table, settings, onClose, onPrint }) => {
  const [discountVal, setDiscountVal] = React.useState('0');
  const [discountType, setDiscountType] = React.useState('amount'); // 'amount' or 'percent'
  const [serviceChargeEnabled, setServiceChargeEnabled] = React.useState(!!settings?.autoServiceCharge);

  if (!table) return null;

  const subtotal = table.order.reduce((acc, i) => acc + (i.price * i.qty), 0);
  
  let discountAmt = 0;
  if (discountType === 'percent') {
    discountAmt = Math.floor(subtotal * (parseFloat(discountVal) || 0) / 100);
  } else {
    discountAmt = parseFloat(discountVal) || 0;
  }

  const service = serviceChargeEnabled ? Math.floor((subtotal - discountAmt) * (settings.serviceChargeRate || 5) / 100) : 0;
  const grandTotal = subtotal - discountAmt + service;

  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', width: '400px', borderRadius: '16px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#111827' }}>Print & Adjust Bill</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Subtotal</div>
            <div style={{ fontSize: '24px', fontWeight: '950', color: '#111827' }}>₹{subtotal}</div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '8px' }}>DISCOUNT</div>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
                <input 
                  type="text" 
                  value={discountVal} 
                  onChange={e => setDiscountVal(e.target.value)}
                  style={{ background: 'white', border: 'none', flex: 1, padding: '8px', fontSize: '14px', borderRadius: '6px', outline: 'none', fontWeight: '500' }}
                />
                <button 
                  onClick={() => setDiscountType('amount')}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '800', background: discountType === 'amount' ? 'white' : 'transparent', boxShadow: discountType === 'amount' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                >₹</button>
                <button 
                  onClick={() => setDiscountType('percent')}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '800', background: discountType === 'percent' ? 'white' : 'transparent', boxShadow: discountType === 'percent' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                >%</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fdf2f2', borderRadius: '10px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#991b1b' }}>Service Charge ({settings.serviceChargeRate || 5}%)</div>
              <div style={{ fontSize: '11px', color: '#b91c1c' }}>Auto-calculated on taxable value</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#991b1b' }}>₹{service}</span>
              <button 
                onClick={() => setServiceChargeEnabled(!serviceChargeEnabled)}
                style={{ width: '36px', height: '20px', borderRadius: '10px', background: serviceChargeEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.3s' }}
              >
                <div style={{ position: 'absolute', top: '2px', left: serviceChargeEnabled ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }}></div>
              </button>
            </div>
          </div>

          <div style={{ borderTop: '2px dashed #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '800' }}>PAYABLE AMOUNT</div>
            <div style={{ fontSize: '24px', fontWeight: '950', color: '#94161c' }}>₹{grandTotal}</div>
          </div>
        </div>

        <button 
          onClick={() => onPrint(discountAmt, service, grandTotal)}
          style={{ width: '100%', padding: '16px', background: '#94161c', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <Printer size={20} /> PRINT BILL
        </button>
      </div>
    </div>
  );
};

const QuickSettleModal = ({ table, settings, onClose, onSettle }) => {
  const [method, setMethod] = React.useState('Cash');
  if (!table) return null;

  const subtotal = table.order.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const service = settings?.autoServiceCharge ? Math.floor(subtotal * (settings.serviceChargeRate || 5) / 100) : 0;
  const grandTotal = subtotal + service;

  const [amountPaidStr, setAmountPaidStr] = React.useState('');
  const amountPaid = parseFloat(amountPaidStr) || 0;
  const changeDue = amountPaid > grandTotal ? amountPaid - grandTotal : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="animate-fade-in" style={{ background: 'white', padding: '28px', borderRadius: '12px', width: '360px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>Settle: {table.name}</h3>
        <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)', marginBottom: '20px' }}>₹{grandTotal}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
          {['Cash', 'Card', 'UPI'].map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              style={{ padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', border: `2px solid ${method === m ? 'var(--primary)' : '#e2e8f0'}`, background: method === m ? 'var(--primary)10' : 'white', color: method === m ? 'var(--primary)' : '#64748b', cursor: 'pointer' }}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Amount Paid by Customer (₹)</label>
          <input
            type="number"
            value={amountPaidStr}
            onChange={(e) => setAmountPaidStr(e.target.value)}
            placeholder={`e.g. ${grandTotal}`}
            style={{ boxSizing: 'border-box', width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '16px', fontWeight: 'bold', outline: 'none' }}
          />
          {amountPaid >= grandTotal && (
            <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 'bold', color: '#10b981' }}>
              Change to Return: ₹{changeDue}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSettle(method, amountPaid, changeDue)} style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Settle Bill</button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState('tables');
  const [selectedTable, setSelectedTable] = useState(null);
  const [quickSettleTable, setQuickSettleTable] = useState(null);
  const [quickPrintTable, setQuickPrintTable] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  
  const handleGlobalSearch = (val) => {
    setGlobalSearch(val);
    if (val.length > 0 && view !== 'orderhistory') {
      setView('orderhistory');
    }
  };

  const [showSidebar, setShowSidebar] = useState(false);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [tables, setTables] = useState(INITIAL_TABLES);
  const [orderHistory, setOrderHistory] = useState([]);
  const [nonTableOrders, setNonTableOrders] = useState([]);
  const [settings, setSettings] = useState({
    billHeader: 'TYDE CAFE',
    billFooter: 'Thank You for Visiting!',
    categorizedKOT: false,
    billLayout: 'standard',
    printFontFamily: 'Helvetica, Arial, sans-serif',
    printFontSize: '13',
    printFontWeight: 'normal',
    accentColor: '#a3112a',
    secondaryColor: '#7c3aed',
    bgColor: '#f9fafb',
    textColor: '#1f2937',
    borderRadius: '12',
    tableShape: 'rounded',
    globalFont: 'Outfit',
    fontBaseSize: '14',
    fontBaseWeight: 'normal',
    autoServiceCharge: true,
    serviceChargeRate: 5
  });
  const [menuItems, setMenuItems] = useState(INITIAL_MENU_ITEMS);
  const [products, setProducts] = useState([...INITIAL_PRODUCTS]);
  const [productCategories, setProductCategories] = useState([...INITIAL_PRODUCT_CATEGORIES]);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [floorPlanSections, setFloorPlanSections] = useState(INITIAL_FLOOR_SECTIONS);
  const [customers, setCustomers] = useState({});

  useEffect(() => {
    const loadFromIDB = async () => {
      try {
        const savedTables = await get('pos_tables_v2');
        if (savedTables) setTables(savedTables);

        const savedOrderHistory = await get('pos_order_history');
        if (savedOrderHistory) setOrderHistory(savedOrderHistory);

        const savedNonTable = await get('pos_nontable_orders_v2');
        if (savedNonTable) setNonTableOrders(savedNonTable);

        const savedSettings = await get('pos_printer_settings');
        if (savedSettings) setSettings(prev => ({ ...prev, ...savedSettings }));

        const savedCustomers = await get('pos_customers');
        if (savedCustomers) setCustomers(savedCustomers);

        const version = await get('pos_menu_version');
        if (version === MENU_VERSION) {
          const savedMenuItems = await get('pos_menu_items');
          if (savedMenuItems) setMenuItems(savedMenuItems);

          const savedCategories = await get('pos_categories');
          const savedProducts = await get('pos_retail_products');
          const savedProductCats = await get('pos_retail_categories');
          if (savedProducts) setProducts(savedProducts);
          if (savedProductCats) setProductCategories(savedProductCats);
          if (savedCategories) setCategories(savedCategories);

          const savedSections = await get('pos_floor_sections');
          if (savedSections) setFloorPlanSections(savedSections);
        } else {
          await set('pos_menu_version', MENU_VERSION);
          // Resets to new defaults above. Optional: save new defaults immediately.
        }
      } catch (err) {
        console.error("Database load error:", err);
      } finally {
        setIsDbLoaded(true);
      }
    };
    loadFromIDB();
  }, []);

  // Save changes automatically after load
  useEffect(() => {
    if (isDbLoaded) set('pos_customers', customers);
  }, [customers, isDbLoaded]);

  useEffect(() => {
    if (isDbLoaded) set('pos_tables_v2', tables);
  }, [tables, isDbLoaded]);

  useEffect(() => {
    if (isDbLoaded) set('pos_order_history', orderHistory);
  }, [orderHistory, isDbLoaded]);

  useEffect(() => {
    if (isDbLoaded) set('pos_nontable_orders_v2', nonTableOrders);
  }, [nonTableOrders, isDbLoaded]);

  useEffect(() => {
    if (isDbLoaded) set('pos_printer_settings', settings);
  }, [settings, isDbLoaded]);

  useEffect(() => {
    if (isDbLoaded) set('pos_menu_items', menuItems);
  }, [menuItems, isDbLoaded]);

  useEffect(() => {
    if (isDbLoaded) set('pos_categories', categories);
    if (isDbLoaded) set('pos_retail_products', products);
    if (isDbLoaded) set('pos_retail_categories', productCategories);
  }, [categories, isDbLoaded]);

  useEffect(() => {
    if (isDbLoaded) set('pos_floor_sections', floorPlanSections);
  }, [floorPlanSections, isDbLoaded]);

  if (!isDbLoaded) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <Store size={48} color="#94161c" style={{ marginBottom: '16px', opacity: 0.5 }} className="animate-pulse" />
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#374151' }}>Initializing Secure Local Database...</div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Optimizing for offline performance</div>
      </div>
    );
  }


  const clearTableFast = (tableId) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        return { ...t, order: [], status: 'blank', createdAt: null };
      }
      return t;
    }));
  };

  const handleSelectTable = (table) => {
    setSelectedTable(table);
    setView('ordering');
  };

  const handleCreateNonTableOrder = (type) => {
    const newId = `${type === 'Delivery' ? 'DEL' : 'TAK'}-${Math.floor(Math.random() * 9000) + 1000}`;
    const newOrder = {
      id: newId,
      name: `${newId}`,
      status: 'blank', // Will turn 'running' when items added
      type: type,
      order: [],
      phone: '',
      createdAt: Date.now()
    };
    setNonTableOrders(prev => [...prev, newOrder]);
    setSelectedTable(newOrder); // Using selectedTable state for both tables & nontables uniformly
    setView('ordering');
  };

  // Removed handleSimulateAggregator

  const saveOrderToTable = (tableId, orderItems, newStatus, extraData = {}) => {
    if (String(tableId).startsWith('DEL-') || String(tableId).startsWith('TAK-')) {
      setNonTableOrders(prev => {
        const existing = prev.find(o => o.id === tableId);
        if (existing) {
          if (orderItems.length === 0) return prev.filter(o => o.id !== tableId);
           return prev.map(o => {
             if (o.id === tableId) {
               const shouldResetTimer = o.status === 'blank' || !o.createdAt;
               return { ...o, order: orderItems, status: newStatus, customerName: extraData.customerName, phone: extraData.customerPhone, note: extraData.note, createdAt: shouldResetTimer ? Date.now() : o.createdAt };
             }
             return o;
           });
        }
        return prev;
      });
      setView('nontables');
    } else {
      setTables(prev => prev.map(t => {
        if (t.id === tableId) {
          const shouldResetTimer = t.status === 'blank' || !t.createdAt;
          return { ...t, order: orderItems, status: newStatus, customerName: extraData.customerName, phone: extraData.customerPhone, note: extraData.note, createdAt: shouldResetTimer ? Date.now() : t.createdAt };
        }
        return t;
      }));
      setSelectedTable(null);
      setView('tables');
    }
  };

  const settleTable = (tableId, orderDetails) => {
    if (orderDetails && orderDetails.cart) {
      setProducts(prev => {
        let updated = [...prev];
        orderDetails.cart.forEach(cartItem => {
          const pIndex = updated.findIndex(p => p.id === cartItem.id && p.type === 'retail');
          if (pIndex !== -1) {
            const newQty = Math.max(0, updated[pIndex].stockQuantity - cartItem.qty);
            updated[pIndex] = { ...updated[pIndex], stockQuantity: newQty, inStock: newQty > 0 };
          }
        });
        return updated;
      });
    }
    if (orderDetails && orderDetails.phone) {
      setCustomers(prev => {
        const ph = orderDetails.phone;
        const existing = prev[ph] || { points: 0, visits: 0, name: orderDetails.customerName || 'Guest' };
        const earned = Math.floor(orderDetails.grandTotal / 100);
        const netPoints = existing.points + earned - (orderDetails.redeemedPoints || 0);
        return { ...prev, [ph]: { ...existing, points: netPoints, visits: existing.visits + 1, name: orderDetails.customerName || existing.name } };
      });
    }

    if (orderDetails && orderDetails.cart && orderDetails.cart.length > 0) {
      // Calculate duration if table/order exists
      let duration = 0;
      const t = tables.find(x => x.id === tableId) || nonTableOrders.find(x => x.id === tableId);
      if (t && t.createdAt) {
        duration = Math.floor((Date.now() - t.createdAt) / 60000);
      }

      setOrderHistory(prev => [...prev, {
        id: Date.now().toString(),
        tableId,
        duration,
        ...orderDetails
      }]);
    }

    if (String(tableId).startsWith('DEL-') || String(tableId).startsWith('TAK-')) {
      // Remove settled external order entirely from "running" state
      setNonTableOrders(prev => prev.filter(o => o.id !== tableId));
      setView('nontables');
    } else {
      setTables(prev => prev.map(t => {
        if (t.id === tableId) {
          return { ...t, order: [], status: 'blank', createdAt: null }; // Mark as blank/paid and reset timer
        }
        return t;
      }));
      setView('tables');
    }
    setSelectedTable(null);
  };

  const markOrderReady = (order) => {
    saveOrderToTable(order.id, order.order, 'printed')
    alert(`Order for ${order.name} marked as ready! Front-stage notified.`);
    setView('kds')
  };

  const handleQuickPrint = (table) => {
    setQuickPrintTable(table);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#f8fafc', overflow: 'hidden' }}>
      <GlobalStyles settings={settings} />
      {showSidebar && <AppSidebar activeView={view} onViewChange={setView} />}
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppTopNavbar 
          onSimulateAggregator={handleSimulateAggregator} 
          globalSearch={globalSearch} 
          onSearchChange={handleGlobalSearch} 
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
          onViewChange={setView}
        />
        
        <main style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {quickPrintTable && (
            <QuickPrintModal 
              table={quickPrintTable}
              settings={settings}
              onClose={() => setQuickPrintTable(null)}
              onPrint={async (discountAmt, serviceCharge, grandTotal) => {
                const subtotal = quickPrintTable.order.reduce((acc, i) => acc + (i.price * i.qty), 0);
                await printPosToSerial({
                  tableName: (quickPrintTable.name && quickPrintTable.name.trim() !== '') ? quickPrintTable.name : `Table ${quickPrintTable.id}`,
                  orderType: quickPrintTable.type === 'Delivery' ? 'Delivery' : (quickPrintTable.type === 'Takeaway' ? 'Pick Up' : 'Dine In'),
                  items: quickPrintTable.order,
                  subtotal,
                  discountAmt,
                  serviceCharge,
                  grandTotal,
                  orderId: quickPrintTable.id,
                  phone: quickPrintTable.phone,
                  customerName: quickPrintTable.customerName
                });
                setTables(prev => prev.map(t => t.id === quickPrintTable.id ? { ...t, status: 'printed' } : t));
                setQuickPrintTable(null);
              }}
            />
          )}

          {quickSettleTable && (
            <QuickSettleModal
              table={quickSettleTable}
              settings={settings}
              onClose={() => setQuickSettleTable(null)}
              onSettle={(paymentMethod, amountPaid, changeDue) => {
                const subtotal = quickSettleTable.order.reduce((acc, i) => acc + (i.price * i.qty), 0);
                const service = settings?.autoServiceCharge ? Math.floor(subtotal * (settings.serviceChargeRate || 5) / 100) : 0;
                const grandTotal = subtotal + service;
                settleTable(quickSettleTable.id, { cart: quickSettleTable.order, subtotal, discountAmt: 0, redeemedPoints: 0, discountAuth: false, taxes: service, grandTotal, paymentMethod, amountPaid, changeDue, timestamp: new Date().toISOString(), phone: quickSettleTable.phone, customerName: quickSettleTable.customerName, note: quickSettleTable.note });
                setQuickSettleTable(null);
              }}
            />
          )}

          {view === 'tables' && (
            <TableManagement tables={tables} floorPlanSections={floorPlanSections} onSelectTable={handleSelectTable} onClearTable={clearTableFast} settings={settings} onQuickSettle={setQuickSettleTable} onQuickPrint={handleQuickPrint} globalSearch={globalSearch} />
          )}
          {view === 'nontables' && (
            <NonTableManagement orders={nonTableOrders} onSelectOrder={handleSelectTable} onCreateOrder={handleCreateNonTableOrder} onViewChange={setView} onQuickSettle={setQuickSettleTable} onQuickPrint={handleQuickPrint} globalSearch={globalSearch} />
          )}
          {view === 'analytics' && (
            <AnalyticsDashboard orderHistory={orderHistory} menuItems={menuItems} />
          )}
          {view === 'dayclose' && (
            <DayCloseWizard
              orderHistory={orderHistory}
              onCompleteDayClose={() => {
                alert("Day Close data wipe is strictly disabled! History and active orders will not be removed.");
                setView('tables');
              }}
            />
          )}
          {view === 'kds' && (
            <KitchenDisplay tables={tables} nonTableOrders={nonTableOrders} onMarkReady={markOrderReady} />
          )}
          {view === 'orderhistory' && (
            <OrderHistoryView orderHistory={orderHistory} activePickups={nonTableOrders} onSelectActive={handleSelectTable} globalSearch={globalSearch} tables={tables} />
          )}
          {view === 'globalsettings' && (
            <GlobalSettingsView settings={settings} onSaveSettings={setSettings} />
          )}
          {view === 'printersettings' && (
            <PrinterSettingsView settings={settings} onSaveSettings={setSettings} categories={categories} />
          )}
          {view === 'menusetup' && (
            <MenuSetupView
              categories={categories} setCategories={setCategories}
              menuItems={menuItems} setMenuItems={setMenuItems}
            />
          )}
          {view === 'productsetup' && (
            <RetailProductSetupView
              categories={productCategories} setCategories={setProductCategories}
              menuItems={products} setMenuItems={setProducts}
            />
          )}
          {view === 'floorplan' && (
            <FloorPlanSetupView tables={tables} setTables={setTables} sections={floorPlanSections} setSections={setFloorPlanSections} />
          )}
          {view === 'ordering' && (
            <OrderingSystem
              table={selectedTable}
              tables={tables}
              nonTableOrders={nonTableOrders}
              initialOrder={selectedTable?.order || []}
              MENU_ITEMS={[...menuItems, ...products]}
              CATEGORIES={Array.from(new Set([...categories, ...productCategories]))}
              settings={settings}
              customers={customers}
              onChangeTable={(oldId, newId, currentCart) => {
                if (selectedTable && oldId !== newId) {
                  const targetTable = tables.find(t => t.id === newId);
                  if (targetTable) {
                    setTables(prev => prev.map(t => {
                      if (t.id === newId) return { ...t, order: currentCart, status: 'running', createdAt: t.createdAt || Date.now() };
                      if (t.id === oldId) return { ...t, order: [], status: 'blank', createdAt: null };
                      return t;
                    }));
                    setSelectedTable({ ...targetTable, order: currentCart, status: 'running' });
                  }
                }
              }}
              onBack={() => {
                if (selectedTable && (String(selectedTable.id).startsWith('DEL-') || String(selectedTable.id).startsWith('TAK-'))) {
                  setView('nontables');
                } else {
                  setView('tables');
                }
              }}
              onSaveOrder={saveOrderToTable}
              onSettleTable={settleTable}
            />
          )}
        </main>
      </div>
    </div>
  );
}
