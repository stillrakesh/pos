import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { 
  Menu, Search, Store, Monitor, LayoutGrid, Clock, Bell, User, Wifi,
  ChevronDown, ChevronUp, Info, CreditCard, Banknote, Printer, Eye, Plus,
  Minus, X, Utensils, Smartphone, BarChart3, TrendingUp, PieChart, AlertTriangle, Truck, ShoppingBag, ChefHat, MessageSquare, CheckSquare, Sunset, Trash2, Package, XCircle,
  Settings2, ReceiptText, RefreshCw, RotateCcw, Percent, CheckCircle
} from 'lucide-react';
import './index.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
import * as XLSX from 'xlsx';

import { BASE_URL } from './constants';

// --- OFFLINE FIRST HELPERS ---
function saveToLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Local Save Error (${key}):`, err);
  }
}

function loadFromLocal(key, fallback = []) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (err) {
    console.warn(`Local Load Error (${key}):`, err);
    return fallback;
  }
}

// --- ENVIRONMENT DETECT ---
const getIsLocal = () => {
  const host = window.location.hostname;
  return host === "localhost" || 
         host === "127.0.0.1" || 
         host.startsWith("192.168.") || 
         host.startsWith("10.") ||
         host.startsWith("172.") ||
         host.endsWith(".local");
};

let IS_LOCAL = getIsLocal();
const CLOUD_URL = "https://restaurant-cloud-backend.onrender.com";


// Update check disabled for stability
async function checkForUpdate() {
  console.log("Update check skipped.");
}

async function syncToCloud() {
  if (!IS_LOCAL) return;
  const menu = loadFromLocal("pos_menu");
  const tables = loadFromLocal("pos_tables");
  const orders = loadFromLocal("pos_order_history");

  try {
    await fetch(CLOUD_URL + "/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu,
        tables,
        orders,
        sales: []
      })
    });
  } catch (err) {
    console.log("Sync failed (offline mode)");
  }
}

// Modular Components & Utilities
import { printPosToSerial } from './utils/printerUtils';
import { QuickPrintModal, QuickSettleModal } from './components/billing/SettlementModals';
import DayCloseWizard from './components/billing/DayCloseWizard';
import BillDesigner from './components/settings/BillDesigner';
import PrinterSetup from './components/settings/PrinterSetup';
import ReportsHub from './components/dashboard/ReportsHub';
import CaptainOrders from './components/billing/CaptainOrders';
import { formatCurrency, getOrderTotal } from './utils/formatters';

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
        --sidebar-width: 240px;
      }
      @media (max-width: 1280px) {
        :root { --sidebar-width: 200px; }
      }
      
      * {
        font-family: '${font}', 'Inter', system-ui, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background-color: #0f172a; /* Deep software background */
        color: var(--text-color);
        font-weight: ${baseWeight};
        font-size: var(--font-size-base);
      }
      .view-container {
        flex: 1;
        overflow: auto;
        padding: var(--app-padding);
        background: var(--bg-color);
      }
      /* Hide scrollbars for a cleaner app look */
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  );
};

const INITIAL_PRODUCT_CATEGORIES = [];
const INITIAL_PRODUCTS = [];

const INITIAL_CATEGORIES = [];
const INITIAL_MENU_ITEMS = [];

const INITIAL_FLOOR_SECTIONS = [];

const INITIAL_TABLES = [];

// --- COMPONENTS ---



const getMinutesElapsed = (createdAt) => {
  if (!createdAt) return 0;
  const start = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt;
  return Math.max(0, Math.floor((Date.now() - start) / 60000));
};

const getChannelLabel = (order = {}) => {
  if (order.type === 'Delivery' || String(order.id || order.tableId || '').startsWith('DEL-') || String(order.id || order.tableId || '').startsWith('DL-')) return 'Delivery';
  if (order.type === 'Takeaway' || String(order.id || order.tableId || '').startsWith('TAK-') || String(order.id || order.tableId || '').startsWith('TA-')) return 'Takeaway';
  return 'Dine In';
};

const AppSidebar = ({ activeView, onViewChange, stats, isConnected, isSyncing, onManualSync, lanUrl }) => {
  const menuGroups = [
    {
      title: 'Daily Operations',
      items: [
        { id: 'analytics', label: 'Dashboard', icon: Monitor },
        { id: 'tables', label: 'Running Orders', icon: Clock, badge: stats.activeTables > 0 ? stats.activeTables : null },
        { id: 'orderhistory', label: 'All Orders', icon: ShoppingBag },
        { id: 'nontables', label: 'Online Orders', icon: Smartphone, badge: stats.activeOnline > 0 ? stats.activeOnline : null },
        { id: 'kds', label: 'KOT', icon: Utensils, badge: stats.pendingKot > 0 ? stats.pendingKot : null, hidden: !IS_LOCAL },
        { id: 'captain', label: 'Captain Orders', icon: Wifi, hidden: !IS_LOCAL },
        { id: 'dayclose', label: 'Settlement', icon: Banknote, hidden: !IS_LOCAL },
        { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, hidden: !IS_LOCAL },
      ].filter(item => !item.hidden)
    },
    {
      title: 'Management',
      hidden: !IS_LOCAL,
      items: [
        { id: 'menusetup', label: 'Menu', icon: Menu },
        { id: 'productsetup', label: 'Inventory', icon: Package },
        { id: 'floorplan', label: 'Floor Designer', icon: LayoutGrid },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'crm', label: 'CRM', icon: User },
        { id: 'globalsettings', label: 'Settings', icon: LayoutGrid },
      ]
    }
  ].filter(group => !group.hidden);

  return (
    <div className="no-print" style={{ width: 'var(--sidebar-width)', background: 'linear-gradient(180deg, #131a28 0%, #0f172a 100%)', borderRight: '1px solid rgba(148, 163, 184, 0.08)', display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0, color: 'white', transition: 'width 0.3s ease' }}>
      <div style={{ padding: 'clamp(16px, 2vw, 24px) clamp(12px, 1.5vw, 22px) 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: 'linear-gradient(135deg, #a3112a 0%, #f97316 100%)', color: 'white', padding: 'clamp(6px, 0.8vw, 10px)', borderRadius: '12px', boxShadow: '0 10px 20px rgba(163, 17, 42, 0.2)' }}>
          <Store size={18} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: '950', fontSize: 'clamp(14px, 1.2vw, 18px)', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>TYDE POS</div>
          <div style={{ fontSize: 'clamp(9px, 0.75vw, 11px)', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.2px', whiteSpace: 'nowrap' }}>Management Console</div>
        </div>
      </div>

      <div style={{ margin: '0 18px 18px', padding: '16px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(163, 17, 42, 0.32), rgba(249, 115, 22, 0.18))', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '900', color: '#fecaca', textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: '12px' }}>Shift Snapshot</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '950' }}>{stats.liveOrders}</div>
            <div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: '700' }}>Live Orders</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '950' }}>{formatCurrency(stats.liveRevenue)}</div>
            <div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: '700' }}>Open Value</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px' }}>
        {menuGroups.map((group, idx) => (
          <div key={idx} style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.3px', marginBottom: '12px', paddingLeft: '12px' }}>{group.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '14px',
                    border: activeView === item.id ? '1px solid rgba(249, 115, 22, 0.28)' : '1px solid transparent',
                    background: activeView === item.id ? 'linear-gradient(135deg, rgba(163, 17, 42, 0.26), rgba(249, 115, 22, 0.12))' : 'transparent',
                    color: activeView === item.id ? '#fff7ed' : '#cbd5e1',
                    cursor: 'pointer', transition: 'all 0.2s', fontWeight: activeView === item.id ? '900' : '700', fontSize: '13px', textAlign: 'left', width: '100%'
                  }}
                >
                  <item.icon size={18} style={{ opacity: activeView === item.id ? 1 : 0.75 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge ? (
                    <span style={{ minWidth: '26px', padding: '3px 8px', borderRadius: '999px', background: activeView === item.id ? 'rgba(255,255,255,0.18)' : 'rgba(148,163,184,0.18)', color: 'inherit', fontSize: '11px', fontWeight: '900' }}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {IS_LOCAL && lanUrl && (
        <div style={{ padding: '0 18px 16px' }}>
          <div style={{ padding: '12px 14px', borderRadius: '18px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
             <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wifi size={10} color="#10b981" /> Captain LAN Mode
             </div>
             <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: '800', wordBreak: 'break-all', fontFamily: 'monospace' }}>{lanUrl}</div>
             <div style={{ fontSize: '9px', color: '#64748b', marginTop: '6px' }}>Open this URL on any mobile device on the same WiFi.</div>
          </div>
        </div>
      )}

      <div style={{ padding: '0 18px 20px' }}>
        <button 
          onClick={onManualSync}
          disabled={isSyncing}
          style={{ 
            width: '100%', padding: '12px', borderRadius: '16px', 
            background: isConnected ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isConnected ? 'rgba(255,255,255,0.1)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: isConnected ? '#cbd5e1' : '#ef4444',
            fontSize: '13px', fontWeight: '900', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            transition: 'all 0.2s'
          }}
        >
          <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Syncing...' : isConnected ? 'Sync to Cloud' : 'Offline (Retry)'}
        </button>
      </div>
    </div>
  );
};


const TimeElapsed = ({ createdAt }) => {
  const [elapsed, setElapsed] = React.useState('');
  
  React.useEffect(() => {
    if (!createdAt) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - createdAt) / 1000);
      const m = Math.floor(diff / 60);
      if (m === 0) {
        setElapsed('< 1 min');
      } else {
        setElapsed(m + ' min');
      }
    }, 10000); // 10s is enough for minute updates
    
    // Initial calculation
    const diff = Math.floor((Date.now() - createdAt) / 1000);
    const m = Math.floor(diff / 60);
    setElapsed(m === 0 ? '< 1 min' : m + ' min');
    
    return () => clearInterval(interval);
  }, [createdAt]);
  
  if (!elapsed) return null;
  return (
    <div style={{ 
      fontSize: '10px', 
      fontWeight: '900', 
      color: '#b45309', 
      background: '#fef3c7', 
      padding: '4px 8px', 
      borderRadius: '20px', 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '4px',
      border: '1px solid #fde68a',
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 4px rgba(180, 83, 9, 0.05)'
    }}>
      <Clock size={10} style={{ opacity: 0.8 }} /> 
      {elapsed}
    </div>
  );
};

const AppTopNavbar = ({ globalSearch, onSearchChange, onToggleSidebar, onViewChange, stats }) => (
  <div className="no-print" style={{ 
    height: 'var(--header-height)', 
    background: 'white', 
    borderBottom: '1px solid #e2e8f0', 
    display: 'flex', 
    alignItems: 'center', 
    padding: '0 24px', 
    position: 'sticky', 
    top: 0, 
    zIndex: 1000, 
    gap: '20px' 
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <button onClick={onToggleSidebar} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '10px', color: '#1f2937', borderRadius: '10px' }}><Menu size={20} /></button>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '950', fontSize: '20px', color: '#0f172a', letterSpacing: '-0.5px' }}>TYDE POS</span>
        </div>
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
      </div>
    </div>

    <button onClick={() => onViewChange('tables')} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(163, 17, 42, 0.2)' }}>New Order</button>

    <div style={{ flex: 1, display: 'flex', alignItems: 'center', maxWidth: '500px' }}>
      <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Search size={18} color="#94a3b8" />
        <input 
          type="text" 
          placeholder="Search Table, Order or Customer..." 
          value={globalSearch}
          onChange={e => onSearchChange(e.target.value)}
          style={{ background: 'transparent', border: 'none', fontSize: '14px', width: '100%', outline: 'none', fontWeight: '500' }} 
        />
      </div>
    </div>
    
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => onViewChange('tables')} 
          style={{ border: '1px solid #e2e8f0', color: '#1f2937', background: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <LayoutGrid size={16} /> TABLES
        </button>
        <button 
          onClick={() => onViewChange('nontables')} 
          style={{ border: 'none', background: '#0f172a', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <ShoppingBag size={16} /> PICKUPS
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
        <div onClick={() => onViewChange('dayclose')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
          <Sunset size={18} color="#64748b" />
          <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Day End</span>
        </div>
        <div onClick={() => onViewChange('kds')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
          <ChefHat size={18} color="#64748b" />
          <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Queue</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: '900', color: '#94161c' }}>Live</div>
          <div style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a' }}>{stats.pendingKot} KOT</div>
        </div>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#1e293b', display: 'grid', placeItems: 'center' }}>
          <User size={20} color="white" />
        </div>
      </div>
    </div>
  </div>
);

/* --- ORDER HISTORY VIEW --- */
const OrderHistoryView = ({ orderHistory, activePickups = [], onSelectActive, globalSearch, tables = [], onReorder }) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'completed', 'cancelled'
  const [localSearch, setLocalSearch] = useState('');

  const searchVal = globalSearch || localSearch;

  const getStatus = (order) => {
    if (order.status === 'CANCELED' || order.status === 'cancelled' || order.status === 'CANCELLED') return 'cancelled';
    if (order.isActive) return 'active';
    return 'completed';
  };

  const allOrders = [
    ...tables.filter(t => t.orders && t.orders.length > 0).map(t => ({
      ...t, isActive: true, tableId: t.name || t.id, orderType: 'Dine In',
      timestamp: t.createdAt || Date.now()
    })),
    ...activePickups.map(o => ({
      ...o, isActive: o.status !== 'CANCELED', orderType: o.type || 'Pickup',
      timestamp: o.createdAt || Date.now()
    })),
    ...orderHistory.map(o => ({ ...o, isActive: false, orderType: o.type || o.orderType || 'Order' }))
  ].filter(o => {
    if (!searchVal) return true;
    const s = searchVal.toLowerCase();
    const items = (o.orders || o.cart || []);
    return (o.id && String(o.id).toLowerCase().includes(s)) ||
           (o.customerName && String(o.customerName).toLowerCase().includes(s)) ||
           (o.phone && String(o.phone).includes(s)) ||
           (o.tableId && String(o.tableId).toLowerCase().includes(s)) ||
           (items.some(item => (item.name || '').toLowerCase().includes(s)));
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const filteredOrders = allOrders.filter(o => {
    const st = getStatus(o);
    if (activeTab === 'all') return true;
    return st === activeTab;
  });

  const getOrderTotal = (order) => {
    if (order.grandTotal) return order.grandTotal;
    return (order.cart || order.orders || []).reduce((acc, i) => acc + (i.price * (i.qty || i.quantity || 1)), 0);
  };

  const completedOrders = allOrders.filter(o => getStatus(o) === 'completed');
  const cancelledOrders = allOrders.filter(o => getStatus(o) === 'cancelled');
  const activeOrders    = allOrders.filter(o => getStatus(o) === 'active');
  const revenue = completedOrders.reduce((acc, o) => acc + getOrderTotal(o), 0);
  const avgTicket = completedOrders.length > 0 ? (revenue / completedOrders.length).toFixed(0) : 0;

  const handleExportExcel = () => {
    if (orderHistory.length === 0) { alert("No data available to export."); return; }
    const data = orderHistory.filter(o => getStatus(o) !== 'cancelled').map(order => ({
      'Date': new Date(order.timestamp).toLocaleDateString(),
      'Time': new Date(order.timestamp).toLocaleTimeString(),
      'Order ID': order.id,
      'Type': order.orderType || order.type || 'Order',
      'Customer': order.customerName || 'Walk-In',
      'Phone': order.phone || 'N/A',
      'Subtotal': order.subtotal || 0,
      'Grand Total': getOrderTotal(order),
      'Payment': order.paymentMethod || 'N/A',
      'Items': (order.cart || []).map(i => `${i.name}(x${i.qty})`).join(', ')
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 60 }];
    XLSX.writeFile(wb, `TydeCafe_Sales_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const statusConfig = {
    active:    { label: 'ONGOING',   bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', dot: '#f97316' },
    completed: { label: 'COMPLETED', bg: '#f0fdf4', color: '#15803d', border: '#dcfce7', dot: '#22c55e' },
    cancelled: { label: 'CANCELLED', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
  };

  const filterTabs = [
    { id: 'all',       label: 'All Orders',  count: allOrders.length },
    { id: 'active',    label: 'Active',       count: activeOrders.length },
    { id: 'completed', label: 'Completed',    count: completedOrders.length },
    { id: 'cancelled', label: 'Cancelled',    count: cancelledOrders.length },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }} className="animate-fade-in no-scrollbar">

      {/* ── Header ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '24px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '26px', fontWeight: '950', color: '#0f172a', letterSpacing: '-0.8px' }}>Order History</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>All transactions including active, completed, and cancelled orders</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <Search size={14} color="#94a3b8" />
              <input value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder="Search orders..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: '13px', fontWeight: '600', width: '160px', color: '#0f172a' }} />
            </div>
            <button onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '13px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
              <TrendingUp size={14} /> Export
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Revenue', value: `₹${revenue.toLocaleString()}`, color: '#0f172a', bg: '#f0fdf4', border: '#dcfce7' },
            { label: 'Completed', value: completedOrders.length, color: '#15803d', bg: '#f0fdf4', border: '#dcfce7' },
            { label: 'Active Now', value: activeOrders.length, color: '#c2410c', bg: '#fff7ed', border: '#ffedd5' },
            { label: 'Ticket Avg', value: `₹${avgTicket}`, color: '#0f172a', bg: '#eff6ff', border: '#dbeafe' },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '14px', padding: '14px 18px' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '950', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Filter Tabs ── */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
          {filterTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '8px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '800', transition: 'all 0.15s',
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? '#0f172a' : '#64748b',
              boxShadow: activeTab === tab.id ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              {tab.label}
              <span style={{ fontSize: '11px', fontWeight: '900', padding: '1px 7px', borderRadius: '20px', background: activeTab === tab.id ? '#f1f5f9' : '#e2e8f0', color: activeTab === tab.id ? '#0f172a' : '#94a3b8' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Order List ── */}
      <div style={{ padding: '24px 32px' }}>
        {filteredOrders.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid #e2e8f0' }}>
              <ShoppingBag size={32} color="#cbd5e1" />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>No orders found</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>Try changing the filter or search term</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredOrders.map((order, idx) => {
              const status = getStatus(order);
              const sc = statusConfig[status];
              const total = getOrderTotal(order);
              const items = order.cart || order.orders || [];
              const time = order.timestamp ? new Date(order.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
              const canOpen = status === 'active';
              const canReorder = status === 'completed' || status === 'cancelled';

              return (
                <div key={order.id || idx} style={{
                  background: 'white', borderRadius: '18px', border: `1px solid ${status === 'cancelled' ? '#fecaca' : '#e2e8f0'}`,
                  overflow: 'hidden', transition: 'box-shadow 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}
                >
                  {/* Left accent bar by status */}
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: '4px', flexShrink: 0, background: sc.dot, borderRadius: '4px 0 0 4px' }} />
                    <div style={{ flex: 1, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>

                      {/* Status icon */}
                      <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: sc.bg, border: `1px solid ${sc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {status === 'active' && <Clock size={20} color={sc.dot} />}
                        {status === 'completed' && <CheckCircle size={20} color={sc.dot} />}
                        {status === 'cancelled' && <XCircle size={20} color={sc.dot} />}
                      </div>

                      {/* Main info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '900', fontSize: '15px', color: '#0f172a' }}>
                            {order.customerName || (order.tableId ? `Table ${order.tableId}` : 'Walk-In')}
                          </span>
                          {/* Status pill */}
                          <span style={{ fontSize: '10px', fontWeight: '900', padding: '2px 10px', borderRadius: '20px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, letterSpacing: '0.5px' }}>
                            {sc.label}
                          </span>
                          {/* Order type badge */}
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#f1f5f9', color: '#475569' }}>
                            {order.orderType || order.type || 'Dine In'}
                          </span>
                          {order.paymentMethod && (
                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#eff6ff', color: '#2563eb' }}>
                              {order.paymentMethod}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span>🕒 {time}</span>
                          <span>📦 {items.length} item{items.length !== 1 ? 's' : ''}: {items.slice(0, 3).map(i => `${i.name}(x${i.qty || i.quantity || 1})`).join(', ')}{items.length > 3 ? ` +${items.length - 3} more` : ''}</span>
                          {order.phone && <span>📞 {order.phone}</span>}
                        </div>
                      </div>

                      {/* Total + Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                        <div style={{ fontSize: '20px', fontWeight: '950', color: status === 'cancelled' ? '#94a3b8' : '#0f172a', textDecoration: status === 'cancelled' ? 'line-through' : 'none' }}>
                          ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {canOpen && (
                            <button onClick={() => onSelectActive(order)} style={{ padding: '8px 16px', borderRadius: '10px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '800', boxShadow: '0 4px 8px rgba(163,17,42,0.2)' }}>
                              Open Order
                            </button>
                          )}
                          {canReorder && items.length > 0 && (
                            <button onClick={() => {
                              if (window.confirm(`Re-create this order with ${items.length} item(s)?`)) {
                                onSelectActive({ ...order, isActive: true, status: 'NEW', id: `TA-${Date.now()}`, createdAt: new Date().toISOString(), timestamp: Date.now(), paymentStatus: 'UNPAID', payment_status: 'UNPAID' });
                              }
                            }} style={{ padding: '8px 16px', borderRadius: '10px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '12px', fontWeight: '800' }}>
                              Re-Order
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* --- MENU SETUP VIEW --- */

const RetailProductSetupView = ({ categories, setCategories, menuItems, setMenuItems, loadMenu }) => {
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

  const addItem = async () => {
    if (newItem.name && newItem.price && newItem.cat && newItem.stockQuantity !== '') {
      const localItem = {
        id: Date.now().toString(),
        name: newItem.name,
        price: parseFloat(newItem.price),
        category: newItem.cat,
        stockQuantity: parseInt(newItem.stockQuantity, 10) || 0,
        inStock: parseInt(newItem.stockQuantity, 10) > 0,
        type: 'retail'
      };
      // ✅ 1. Save locally first (instant UI)
      setMenuItems(prev => [...prev, localItem]);
      setNewItem({ name: '', price: '', stockQuantity: '', cat: categories[0] || '' });
      // ✅ 2. Try backend sync (optional background)
      try {
        const { createMenuItem } = await import('./utils/apiClient');
        await createMenuItem({ name: localItem.name, price: localItem.price, category: localItem.category });
      } catch (err) {
        console.warn("⚠️ Offline: Retail item saved locally only.");
      }
    } else {
      alert("Please fill in Name, Price, Category, and Stock Quantity.");
    }
  };

  const deleteItem = async (id) => {
    if (window.confirm("Are you sure you want to remove this product?")) {
      const pwd = window.prompt("Security Check: Enter master password:");
      if (pwd === "biller") {
        // ✅ 1. Delete locally first (instant UI)
        setMenuItems(prev => prev.filter(item => item.id !== id));
        // ✅ 2. Try backend sync (optional)
        try {
          const { deleteMenuItem } = await import('./utils/apiClient');
          await deleteMenuItem(id);
        } catch (err) {
          console.warn("⚠️ Offline: Product removed locally only.");
        }
      }
    }
  };

  const toggleStock = async (id) => {
    const item = (menuItems || []).find(i => i.id === id);
    if (!item) return;
    // ✅ 1. Toggle locally first (instant UI)
    setMenuItems(prev => prev.map(i => i.id === id ? { ...i, inStock: !i.inStock } : i));
    // ✅ 2. Try backend sync (optional)
    try {
      const { updateMenuItemApi } = await import('./utils/apiClient');
      await updateMenuItemApi(id, { inStock: !item.inStock });
    } catch (err) {
      console.warn("⚠️ Offline: Stock status toggled locally only.");
    }
  };

  const updateQuantity = async (id, newQty) => {
    const q = parseInt(newQty, 10) || 0;
    // ✅ 1. Update locally first (instant UI)
    setMenuItems(prev => prev.map(i => i.id === id ? { ...i, stockQuantity: q, inStock: q > 0 } : i));
    // ✅ 2. Try backend sync (optional)
    try {
      const { updateMenuItemApi } = await import('./utils/apiClient');
      await updateMenuItemApi(id, { stockQuantity: q, inStock: q > 0 });
    } catch (err) {
      console.warn("⚠️ Offline: Quantity updated locally only.");
    }
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
            {categories.map(cat => {
              const name = typeof cat === 'object' ? cat.name : cat;
              return (
                <div key={name} style={{ background: '#f3f4f6', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {name} <button onClick={() => deleteCategory(name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
                </div>
              );
            })}
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
              {categories.map(cat => {
                const name = typeof cat === 'object' ? cat.name : cat;
                return <option key={name} value={name}>{name}</option>
              })}
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
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>{typeof item.cat === 'object' ? item.cat.name : item.cat}</div>
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

const MenuSetupView = ({ categories, setCategories, menuItems, setMenuItems, loadCategories, loadMenu }) => {
  const [newCat, setNewCat] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || "");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("Veg");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const addCategory = async () => {
    if (newCat && !categories.includes(newCat)) {
        // ✅ 1. UPDATE LOCALLY FIRST (Instant UI)
        const updatedCats = [...categories, newCat];
        setCategories(updatedCats);
        setSelectedCategory(newCat);
        setNewCat('');

        // ✅ 2. TRY BACKEND SYNC (Optional)
        try {
          console.log("☁️ Syncing new category to cloud:", newCat);
          await fetch(BASE_URL + "/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newCat })
          });
        } catch (err) {
          console.warn("⚠️ Offline Mode: Category created locally.", err);
        }
    } else if (categories.includes(newCat)) {
      alert("Category already exists");
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

  const addItem = async () => {
    if (name && price && selectedCategory) {
      const itemToLink = {
        id: Date.now().toString(),
        name,
        price: parseFloat(price),
        category: selectedCategory || "Uncategorized",
        type,
        available: true,
        inStock: true
      };

      // ✅ 1. UPDATE LOCALLY FIRST (Instant UI)
      setMenuItems(prev => [...prev, itemToLink]);
      setName("");
      setPrice("");

      // ✅ 2. TRY BACKEND SYNC (Optional)
      try {
        console.log("☁️ Attempting Server Sync for new item:", itemToLink.name);
        await fetch(BASE_URL + "/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemToLink)
        });
        // Optional: reload to get server-side IDs if strictly needed
        // await loadMenu(); 
      } catch (err) {
        console.warn("⚠️ POST /menu failed, item exists in LOCAL setup only.", err);
      }
    } else {
      alert("Please fill name and price");
    }
  };

  const deleteItem = async (id) => {
    if (window.confirm("Are you sure you want to remove this item from the menu?")) {
      const pwd = window.prompt("Security Check: Enter master password to delete menu item:");
      if (pwd === "biller") {
        // ✅ 1. Delete locally first (instant UI)
        setMenuItems(prev => prev.filter(item => item.id !== id));
        // ✅ 2. Try backend sync (optional)
        try {
          const { deleteMenuItem } = await import('./utils/apiClient');
          await deleteMenuItem(id);
        } catch (err) {
          console.warn("⚠️ Offline: Menu item removed locally only.");
        }
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
            {categories.map(cat => {
              const name = typeof cat === 'object' ? cat.name : cat;
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>
                  {name}
                  <button onClick={() => deleteCategory(name)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#ef4444' }}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}
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
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
            <input
              type="number"
              placeholder="Price (₹)"
              value={price}
              onChange={e => setPrice(e.target.value)}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white' }}
            >
              <option value="">Select Category</option>
              {categories.map((cat, i) => {
                const name = typeof cat === 'object' ? cat.name : cat;
                return (
                  <option key={i} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white' }}
            >
              <option value="Veg">Veg</option>
              <option value="Non-Veg">Non-Veg</option>
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
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>{typeof item.cat === 'object' ? item.cat.name : item.cat}</div>
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
const FloorDesigner = ({ tables, setTables, sections, setSections, loadTables }) => {
  const [newTableName, setNewTableName] = useState('');
  const [newTableType, setNewTableType] = useState(sections[0] || '');
  const [newTableSeats, setNewTableSeats] = useState('4');
  const [newTableShape, setNewTableShape] = useState('rounded');
  const [newZoneLabel, setNewZoneLabel] = useState('');
  const [tableToRemove, setTableToRemove] = useState(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSection, setEditingSection] = useState(null);
  const [editSectionValue, setEditSectionValue] = useState('');
  const [designModeSection, setDesignModeSection] = useState(null);
  const [draggedTableId, setDraggedTableId] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [editingTableId, setEditingTableId] = useState(null);
  const [editingTableDraft, setEditingTableDraft] = useState({ name: '', seats: '4', shape: 'rounded', zoneLabel: '', scale: '1.0' });

  const addTable = async () => {
    if (newTableName.trim() === '') return;
    
    const stagger = (tables.length % 5) * 40;
    const newTableData = {
      name: newTableName,
      type: newTableType,
      status: "vacant",
      pos: { x: 50 + stagger, y: 50 + stagger },
      seats: parseInt(newTableSeats, 10) || 4,
      shape: newTableShape,
      zoneLabel: newZoneLabel.trim()
    };

    try {
      const res = await fetch(BASE_URL + "/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTableData)
      });
      if (res.ok) {
        setNewTableName('');
        setNewTableSeats('4');
        setNewTableShape('rounded');
        setNewZoneLabel('');
        // Tables state will be updated via socket
      }
    } catch (err) {
      console.error("Failed to add table:", err);
      alert("Offline: Table could not be added to server.");
    }
  };

  const removeTable = (id) => {
    const tableInfo = tables.find(t => t.id === id);
    if (tableInfo && tableInfo.status !== 'vacant') {
      alert("Cannot remove a table with an active order.");
      return;
    }
    setTableToRemove(id);
  };

  const confirmRemoveTable = async () => {
    const id = tableToRemove;
    setTableToRemove(null);
    try {
      const res = await fetch(BASE_URL + "/tables/" + id, {
        method: "DELETE",
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) throw new Error("Delete failed");
      // Tables state will be updated via socket
    } catch (err) {
      console.error("Failed to remove table:", err);
      alert("Error: Table could not be removed from server.");
    }
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
    const table = (tables || []).find(t => t.id === tableId);
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

  const handleCanvasMouseUp = async () => {
    if (draggedTableId) {
      const table = tables.find(t => t.id === draggedTableId);
      if (table) {
        try {
          await fetch(BASE_URL + "/tables/" + table.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pos: table.pos })
          });
          // Note: Removed loadTables() here to prevent UI flicker/stutter during drag persistence
        } catch (err) {
          console.error("Failed to save table position:", err);
        }
      }
    }
    setDraggedTableId(null);
  };

  const startEditTable = (table) => {
    setEditingTableId(table.id);
    setEditingTableDraft({
      name: table.name || '',
      seats: String(table.seats || 4),
      shape: table.shape || 'rounded',
      zoneLabel: table.zoneLabel || '',
      scale: String(table.scale || 1.0),
    });
  };

  const saveEditTable = async () => {
    if (!editingTableId) return;
    const update = {
      name: editingTableDraft.name.trim(),
      seats: parseInt(editingTableDraft.seats, 10) || 4,
      shape: editingTableDraft.shape || 'rounded',
      zoneLabel: editingTableDraft.zoneLabel.trim(),
      scale: parseFloat(editingTableDraft.scale) || 1.0
    };
    
    try {
      const res = await fetch(BASE_URL + "/tables/" + editingTableId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update)
      });
      if (res.ok) {
        setEditingTableId(null);
      }
    } catch (err) {
      console.error("Failed to save table edit:", err);
      alert("Error saving table.");
    }
  };

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
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr 0.9fr auto', gap: '12px', alignItems: 'center' }}>
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
            <input
              type="number"
              min="1"
              value={newTableSeats}
              onChange={e => setNewTableSeats(e.target.value)}
              placeholder="Seats"
              style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#f8fafc' }}
            />
            <select
              value={newTableShape}
              onChange={e => setNewTableShape(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 'bold', fontSize: '14px', color: '#1f2937' }}
            >
              <option value="rounded">Rounded</option>
              <option value="square">Square</option>
              <option value="circle">Circle</option>
            </select>
            <input
              type="text"
              placeholder="Zone label"
              value={newZoneLabel}
              onChange={e => setNewZoneLabel(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', background: '#f8fafc' }}
            />
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
                      width: `${(table.shape === 'square' ? 112 : 100) * (table.scale || 1)}px`, 
                      height: `${100 * (table.scale || 1)}px`, 
                      background: 'white', borderRadius: table.shape === 'square' ? '18px' : table.shape === 'circle' ? '999px' : '28px', border: '2px solid var(--primary)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'grab',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', userSelect: 'none',
                      transition: 'all 0.1s'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)' }}>{table.name}</div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>{table.seats || 4} seats</div>
                    {table.zoneLabel ? <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{table.zoneLabel}</div> : null}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                {tables.filter(t => t.type === section).map(table => (
                  <div key={table.id} style={{ background: '#f8fafc', borderRadius: '18px', padding: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '900', color: '#1e293b' }}>{table.name}</span>
                      <button onClick={() => removeTable(table.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                        <X size={16} />
                      </button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>{table.seats || 4} seats • {table.shape || 'rounded'}</div>
                    {table.zoneLabel ? <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>{table.zoneLabel}</div> : null}
                    <button onClick={() => startEditTable(table)} style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#111827', fontWeight: '900', cursor: 'pointer' }}>
                      Edit Table
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {editingTableId && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="animate-fade-in" style={{ background: 'white', padding: '28px', borderRadius: '16px', width: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '18px', color: '#1f2937' }}>Edit Table</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input value={editingTableDraft.name} onChange={e => setEditingTableDraft(prev => ({ ...prev, name: e.target.value }))} placeholder="Table name" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #d1d5db' }} />
                <input type="number" min="1" value={editingTableDraft.seats} onChange={e => setEditingTableDraft(prev => ({ ...prev, seats: e.target.value }))} placeholder="Seats" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #d1d5db' }} />
                <select value={editingTableDraft.shape} onChange={e => setEditingTableDraft(prev => ({ ...prev, shape: e.target.value }))} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #d1d5db' }}>
                  <option value="rounded">Rounded</option>
                  <option value="square">Square</option>
                  <option value="circle">Circle</option>
                </select>
                <input value={editingTableDraft.zoneLabel} onChange={e => setEditingTableDraft(prev => ({ ...prev, zoneLabel: e.target.value }))} placeholder="Zone label" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #d1d5db' }} />
                
                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#4b5563', marginBottom: '8px' }}>Table Size (Scale)</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    {[0.8, 1.0, 1.3, 1.8].map((s, idx) => (
                      <button 
                        key={s} 
                        onClick={() => setEditingTableDraft(prev => ({ ...prev, scale: String(s) }))}
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', borderColor: parseFloat(editingTableDraft.scale) === s ? '#7c3aed' : '#e5e7eb', background: parseFloat(editingTableDraft.scale) === s ? '#f5f3ff' : 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {['Small', 'Medium', 'Big', 'Jumbo'][idx]}
                      </button>
                    ))}
                  </div>
                  <input 
                    type="range" min="0.5" max="2.5" step="0.1" 
                    value={editingTableDraft.scale} 
                    onChange={e => setEditingTableDraft(prev => ({ ...prev, scale: e.target.value }))}
                    style={{ width: '100%', accentColor: '#7c3aed' }} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginTop: '4px' }}>
                    <span>Tiny</span>
                    <span>{editingTableDraft.scale}x</span>
                    <span>Massive</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button onClick={() => setEditingTableId(null)} style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveEditTable} style={{ flex: 1, padding: '12px', background: '#111827', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          </div>
        )}
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
const GlobalSettingsView = ({ settings, onSaveSettings, onClearHistory, onFullReset, devices = [], onUpdateDeviceStatus, onDeleteDevice, isConnected, onRestoreData, appVersion, categories }) => {
  const [activeTab, setActiveTab] = useState('design');
  const [localSettings, setLocalSettings] = useState(settings);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    showNotification('Settings Saved Successfully!');
  };

  return (
    <div className="view-container animate-fade-in no-scrollbar" style={{ padding: 0 }}>
      {/* Settings Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: 'white', padding: '0 16px', overflowX: 'auto', flexShrink: 0 }} className="no-scrollbar">
        {[
          { id: 'design', label: 'Design', icon: <Monitor size={16} /> },
          { id: 'billing', label: 'Bill', icon: <ReceiptText size={16} /> },
          { id: 'connection', label: 'Server', icon: <Wifi size={16} /> },
          { id: 'printer', label: 'Printer', icon: <Printer size={16} /> },
          { id: 'taxes', label: 'Taxes', icon: <Percent size={16} /> },
          { id: 'devices', label: 'Devices', icon: <Smartphone size={16} /> },
          { id: 'system', label: 'System', icon: <Settings2 size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', padding: '14px 18px', fontSize: '13px', fontWeight: '900', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              color: activeTab === tab.id ? localSettings.accentColor : '#64748b',
              borderBottom: `3px solid ${activeTab === tab.id ? localSettings.accentColor : 'transparent'}`,
              transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '32px' }}>
        {activeTab === 'design' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '2px solid #f3f4f6', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937' }}>
                <LayoutGrid size={20} color="var(--primary)" /> Floor Plan & Shapes
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Corner Styling</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['0', '8', '24'].map(r => (
                      <button key={r} onClick={() => setLocalSettings(prev => ({ ...prev, borderRadius: r }))} style={{ flex: 1, padding: '10px', borderRadius: `${r}px`, border: `2px solid ${localSettings.borderRadius === r ? localSettings.accentColor : '#e5e7eb'}`, background: localSettings.borderRadius === r ? `${localSettings.accentColor}10` : 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>{r === '0' ? 'Square' : r === '24' ? 'Pill' : `${r}px`}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Table Geometry</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['square', 'circle'].map(shape => (
                      <button key={shape} onClick={() => setLocalSettings(prev => ({ ...prev, tableShape: shape }))} style={{ flex: 1, padding: '10px', borderRadius: shape === 'circle' ? '50px' : '4px', border: `2px solid ${localSettings.tableShape === shape ? localSettings.accentColor : '#e5e7eb'}`, background: localSettings.tableShape === shape ? `${localSettings.accentColor}10` : 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'capitalize' }}>{shape}</button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleSave} style={{ marginTop: '20px', padding: '14px', background: localSettings.accentColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Save Interface Customization</button>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <BillDesigner settings={localSettings} onSaveSettings={(s) => { setLocalSettings(s); onSaveSettings(s); }} />
        )}

        {notification && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: notification.type === 'error' ? '#ef4444' : '#10b981',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 10000,
            animation: 'slideUp 0.3s ease-out'
          }}>
            <CheckCircle size={18} />
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{notification.message}</span>
          </div>
        )}

        {activeTab === 'connection' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f3f4f6', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937' }}>
                   <Wifi size={20} color={isConnected ? '#10b981' : '#64748b'} /> Global Backend Configuration
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444' }}></div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: isConnected ? '#10b981' : '#dc2626' }}>
                    {isConnected ? 'LIVE CONNECTION' : 'DISCONNECTED'}
                  </span>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Connection Stats</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                   <div style={{ fontSize: '12px', color: '#64748b' }}>WebSocket Status: <b style={{ color: isConnected ? '#10b981' : '#dc2626' }}>{isConnected ? 'Active' : 'Idle'}</b></div>
                   <div style={{ fontSize: '12px', color: '#64748b' }}>Project Base Endpoint: <b>{BASE_URL}</b></div>
                </div>
              </div>

              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Cloud Data Restoration</h4>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Fetch missing menus and tables straight from the cloud system.</p>
                <button 
                  onClick={onRestoreData} 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <RefreshCw size={16} />
                  Restore Data
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'printer' && (
          <PrinterSetup 
            settings={localSettings} 
            setSettings={setLocalSettings} 
            onSave={handleSave}
            categories={categories} 
          />
        )}

        {activeTab === 'taxes' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f3f4f6', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937' }}>
                   <Percent size={20} color="var(--primary)" /> Global Taxes & Charges
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>Default Rules</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* GST Settings */}
                <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                   <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>GST Configuration</h4>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                     <span style={{ fontSize: '13px', color: '#64748b' }}>Enable GST by default</span>
                     <button 
                       onClick={() => setLocalSettings(prev => ({ ...prev, gstEnabled: !prev.gstEnabled }))}
                       style={{ width: '40px', height: '20px', borderRadius: '10px', background: localSettings.gstEnabled ? 'var(--primary)' : '#cbd5e1', position: 'relative', cursor: 'pointer', border: 'none' }}
                     >
                       <div style={{ position: 'absolute', top: '2px', left: localSettings.gstEnabled ? '22px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'all 0.2s' }} />
                     </button>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <span style={{ fontSize: '13px', color: '#64748b' }}>Default GST Rate (%)</span>
                     <input 
                       type="number" value={localSettings.gstRate} 
                       onChange={(e) => setLocalSettings(prev => ({ ...prev, gstRate: parseFloat(e.target.value) || 0 }))}
                       style={{ width: '60px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }} 
                     />
                   </div>
                </div>

                {/* Service Charge Settings */}
                <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                   <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>Service Charge</h4>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                     <span style={{ fontSize: '13px', color: '#64748b' }}>Enable SC by default</span>
                     <button 
                       onClick={() => setLocalSettings(prev => ({ ...prev, autoServiceCharge: !prev.autoServiceCharge }))}
                       style={{ width: '40px', height: '20px', borderRadius: '10px', background: localSettings.autoServiceCharge ? 'var(--primary)' : '#cbd5e1', position: 'relative', cursor: 'pointer', border: 'none' }}
                     >
                       <div style={{ position: 'absolute', top: '2px', left: localSettings.autoServiceCharge ? '22px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'all 0.2s' }} />
                     </button>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <span style={{ fontSize: '13px', color: '#64748b' }}>Default SC Rate (%)</span>
                     <input 
                       type="number" value={localSettings.serviceChargeRate} 
                       onChange={(e) => setLocalSettings(prev => ({ ...prev, serviceChargeRate: parseFloat(e.target.value) || 0 }))}
                       style={{ width: '60px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }} 
                     />
                   </div>
                </div>
              </div>

              <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7', fontSize: '12px', color: '#92400e', lineHeight: '1.5' }}>
                <Info size={14} style={{ marginBottom: '4px', display: 'block' }} />
                Global settings apply only to <b>newly created</b> table sessions. Active tables will retain their current settings until cleared. Service Charge is automatically disabled for Takeaway orders.
              </div>

              <button onClick={handleSave} style={{ alignSelf: 'flex-start', padding: '12px 24px', background: localSettings.accentColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Save Tax Rules</button>
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f3f4f6', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937' }}>
                  <Smartphone size={20} color="var(--primary)" /> Linked Captain Terminals
                </h3>
                <span style={{ fontSize: '11px', background: '#f3f4f6', padding: '4px 10px', borderRadius: '12px', color: '#64748b', fontWeight: 'bold' }}>{devices.length} Total</span>
              </div>
              
              {devices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                  <Smartphone size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                  <p style={{ fontSize: '14px' }}>No Captain devices have requested to connect yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {devices.map(device => (
                    <div key={device.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Smartphone size={20} color={device.status === 'APPROVED' ? '#10b981' : '#64748b'} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>{device.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {device.id} • Seen: {new Date(device.created_at).toLocaleTimeString()}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ 
                          fontSize: '10px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px',
                          background: device.status === 'APPROVED' ? '#dcfce7' : device.status === 'BLOCKED' ? '#fee2e2' : '#fef9c3',
                          color: device.status === 'APPROVED' ? '#166534' : device.status === 'BLOCKED' ? '#991b1b' : '#854d0e'
                        }}>
                          {device.status}
                        </span>
                        
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {device.status !== 'APPROVED' && (
                             <button onClick={() => onUpdateDeviceStatus(device.id, 'APPROVED')} style={{ height: '32px', padding: '0 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Approve</button>
                          )}
                          {device.status !== 'BLOCKED' && (
                             <button onClick={() => onUpdateDeviceStatus(device.id, 'BLOCKED')} style={{ height: '32px', padding: '0 12px', background: 'white', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Block</button>
                          )}
                          <button onClick={() => onDeleteDevice(device.id)} style={{ padding: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '2px solid #f3f4f6', paddingBottom: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} /> Danger Zone: Data Management
              </h3>
              
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Software Version</div>
                    <div style={{ fontSize: '18px', fontWeight: '950', color: '#1e293b' }}>{appVersion?.version || 'v1.0-stable'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Last Official Update</div>
                    <div style={{ fontSize: '18px', fontWeight: '950', color: '#1e293b' }}>{appVersion?.lastUpdated || '2026-04-19'}</div>
                  </div>
                </div>
                {appVersion?.notes && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b', fontStyle: 'italic', paddingBottom: appVersion?.history ? '12px' : '0', borderBottom: appVersion?.history ? '1px solid #e2e8f0' : 'none' }}>
                    Note: {appVersion.notes}
                  </div>
                )}
                {appVersion?.history && appVersion.history.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '13px', color: '#334155', fontWeight: 'bold', marginBottom: '8px' }}>Version History</div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {appVersion.history.map((hist, idx) => (
                        <div key={idx} style={{ padding: '8px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>{hist.version}</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{hist.date}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569' }}>{hist.changes}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '16px', background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>Clear Analytics & History</div>
                  <div style={{ fontSize: '11px', color: '#b91c1c', marginBottom: '12px', opacity: 0.8 }}>Wipe all past orders. Active orders will remain.</div>
                  <button onClick={onClearHistory} style={{ width: '100%', padding: '10px', background: 'white', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Clear All Orders</button>
                </div>
                <div style={{ padding: '16px', background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>WIPE ENTIRE SYSTEM</div>
                  <div style={{ fontSize: '11px', color: '#b91c1c', marginBottom: '12px', opacity: 0.8 }}>Factory reset everything! This cannot be undone.</div>
                  <button onClick={onFullReset} style={{ width: '100%', padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>ERASE ALL DATA</button>
                </div>
              </div>
            </div>
          </div>
        )}
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

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>Separate KOT by Station</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Print separate slips for different kitchen areas (Drinks, Pizza, etc.)</div>
            </div>
            <input 
              type="checkbox" 
              name="separateKotStations" 
              checked={localSettings.separateKotStations} 
              onChange={handleChange} 
              style={{ width: '20px', height: '20px', cursor: 'pointer' }} 
            />
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
                      const name = typeof cat === 'object' ? cat.name : cat;
                      const isSelected = station.categories.includes(name);
                      return (
                        <label key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', border: `1px solid ${isSelected ? 'var(--primary)' : '#d1d5db'}`, padding: '4px 10px', borderRadius: '20px', background: isSelected ? 'var(--primary)' : 'white', color: isSelected ? 'white' : '#4b5563', cursor: 'pointer', transition: 'all 0.2s' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setLocalSettings(prev => ({
                                ...prev,
                                printerStations: prev.printerStations.map(s => {
                                  if (s.id === station.id) {
                                    return { ...s, categories: isSelected ? s.categories.filter(c => c !== name) : [...s.categories, name] };
                                  }
                                  // Auto-remove from other stations if selected here
                                  return { ...s, categories: s.categories.filter(c => c !== name) };
                                })
                              }));
                            }}
                            style={{ display: 'none' }}
                          />
                          {name}
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

const ServiceFloor = ({ tables, floorPlanSections, onSelectTable, onClearTable, settings, onQuickSettle, onQuickPrint, globalSearch, onViewChange, onOpenFloorDesigner, tableToClear, setTableToClear }) => {
  console.log("ServiceFloor Tables:", tables.map(t => ({ id: t.id, status: t.status, total: t.total, items: t.orders?.length })));
  const [viewMode, setViewMode] = useState('map');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem("floorZoom")) || 100);

  useEffect(() => {
    localStorage.setItem("floorZoom", zoom);
  }, [zoom]);

  
  // Derive sections dynamically from loaded tables (backend is source of truth)
  // This ensures all zones from the backend appear, regardless of floorPlanSections localStorage
  const activeSections = [...new Set(tables.map(t => t.type || 'Main Floor'))].filter(Boolean);

  const filterMatch = (t) => {
    if (!globalSearch) return true;
    const name = (t.name || '').toLowerCase();
    const search = globalSearch.toLowerCase();
    return name.includes(search) || String(t.id).includes(search) || (t.customerName || '').toLowerCase().includes(search) || (t.phone || '').includes(search);
  };

  const matchesStatus = (table) => {
    const minutes = getMinutesElapsed(table.createdAt);
    const isRunning = table.status !== 'vacant';
    
    if (statusFilter === 'all') return true;
    if (statusFilter === 'vacant') return table.status === 'vacant';
    if (statusFilter === 'occupied') return isRunning; // Now represents any active state
    if (statusFilter === 'printed') return table.status === 'billing'; // Ready to bill
    if (statusFilter === 'delayed') return isRunning && minutes >= 45;
    return true;
  };

  const filteredTables = tables.filter(table => filterMatch(table) && matchesStatus(table));
  const occupiedTables = tables.filter(table => table.status !== 'vacant');
  const printedTables = tables.filter(table => table.status === 'billing');
  const delayedTables = tables.filter(table => table.status !== 'vacant' && getMinutesElapsed(table.createdAt) >= 45);
  const occupancyRate = tables.length > 0 ? Math.round((occupiedTables.length / tables.length) * 100) : 0;
  const openRevenue = occupiedTables.reduce((acc, table) => acc + (table.total || 0), 0);
  const avgOpenTicket = occupiedTables.length > 0 ? openRevenue / occupiedTables.length : 0;
  const statusFilters = [
    { id: 'all', label: 'All tables' },
    { id: 'occupied', label: 'Occupied' },
    { id: 'printed', label: 'Ready to bill' },
    { id: 'delayed', label: 'Delayed' },
    { id: 'vacant', label: 'Vacant' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px', background: 'linear-gradient(180deg, #f8fafc 0%, #fff7ed 100%)' }} className="animate-fade-in no-scrollbar">

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '24px' }}>
        <StatCard label="Occupancy" value={`${occupancyRate}%`} icon={LayoutGrid} color="#f97316" subtext={`${occupiedTables.length}/${tables.length} tables active`} />
        <StatCard label="Open Tickets" value={formatCurrency(openRevenue)} icon={CreditCard} color="#a3112a" subtext={`Avg open bill ${formatCurrency(avgOpenTicket)}`} />
        <StatCard label="Ready To Settle" value={printedTables.length} icon={CheckSquare} color="#10b981" subtext="Printed bills awaiting payment" />
        <StatCard label="Delayed Tables" value={delayedTables.length} icon={AlertTriangle} color="#f59e0b" subtext="Orders older than 45 minutes" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '950', color: '#111827', letterSpacing: '-0.6px' }}>Service Floor</h2>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', marginRight: '16px', borderRight: '1px solid #e2e8f0', paddingRight: '16px' }}>
              {['map', 'grid'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: '1px solid',
                    borderColor: viewMode === mode ? '#94161c' : '#e2e8f0',
                    cursor: 'pointer',
                    background: viewMode === mode ? '#fff1f2' : 'white',
                    color: viewMode === mode ? '#94161c' : '#64748b'
                  }}
                >
                  {mode === 'map' ? 'Map View' : 'Grid'}
                </button>
              ))}
            </div>

            {statusFilters.map(filter => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: '900',
                  border: statusFilter === filter.id ? '1px solid #fecaca' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  background: statusFilter === filter.id ? '#fff1f2' : 'white',
                  color: statusFilter === filter.id ? '#9f1239' : '#64748b'
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '6px 16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zoom: {zoom}%</span>
            <input 
              type="range"
              min="10"
              max="150"
              step="5"
              value={zoom} 
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ cursor: 'pointer', width: '100px', accentColor: '#94161c' }}
            />
          </div>
          <button
            onClick={onOpenFloorDesigner}
            style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#111827', fontSize: '12px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LayoutGrid size={16} /> Edit Floor Plan
          </button>


          <div style={{ display: 'flex', gap: '16px', fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '3px' }}></div> Vacant</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', background: '#fed7aa', borderRadius: '3px' }}></div> Running</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', background: '#bbf7d0', borderRadius: '3px' }}></div> Printed</div>
          </div>
        </div>
      </div>

      {activeSections.map(section => (
        <div key={section} style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            {section} SECTION
          </h2>

          {viewMode === 'map' ? (
            <div style={{
              position: 'relative', 
              height: '700px', 
              background: '#ffffff', 
              borderRadius: '24px', 
              border: '1px solid #e2e8f0', 
              overflow: 'auto',
              backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)', 
              backgroundSize: '24px 24px', 
              padding: '24px'
            }}>
              <div style={{ 
                transform: `scale(${zoom / 100})`, 
                transformOrigin: "top left",
                width: `${100 / (zoom / 100)}%`,
                height: `${100 / (zoom / 100)}%`,
                position: 'relative'
              }}>

              {filteredTables.filter(t => t.type === section).map(table => {
                const tableTotal = table.total || 0;
                const isRunning = table.status !== 'vacant';
                const isPrinted = table.status === 'billing';
                const isSaved = table.status === 'draft';

                return (
                  <div
                    key={table.id}
                    onClick={() => onSelectTable(table)}
                    className={`pp-table-card status-${table.status || 'blank'}`}
                    style={{
                      position: 'absolute',
                      left: `${table.pos?.x || 0}px`,
                      top: `${table.pos?.y || 0}px`,
                      zIndex: isRunning ? 10 : 1,
                      transform: `scale(${table.scale || 1})`,
                      transformOrigin: 'top left',
                      height: '200px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '16px',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Top Row: Table Name & Compact Timer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.4px' }}>Table</div>
                        <div style={{ fontSize: '20px', fontWeight: '950', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {table.name.replace('Table ', '')}
                        </div>
                      </div>
                      {isRunning && (
                        <div style={{ flexShrink: 0 }}>
                           <TimeElapsed createdAt={table.createdAt} />
                        </div>
                      )}
                    </div>

                    {/* Middle: Status & Price (Centered for consistency) */}
                    <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 0' }}>
                      <div style={{ fontSize: '9px', fontWeight: '900', color: isRunning ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                        {table.status === 'draft' ? '🔵 DRAFT' : 
                         table.status === 'kot_pending' ? '🟡 KOT PENDING' : 
                         table.status === 'kot_printed' ? '🟠 KOT PRINTED' : 
                         table.status === 'billing' ? '🟢 BILLING' : '○ VACANT'}
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: '950', color: isRunning ? 'var(--primary)' : '#e2e8f0', margin: '2px 0', lineHeight: 1 }}>
                        {tableTotal > 0 ? `₹${Math.floor(tableTotal)}` : '--'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginTop: '4px' }}>
                        {isRunning ? `${(table.items?.length || table.orders?.length || 0)} items` : 'No items'}
                      </div>
                    </div>

                    {/* Bottom: Action Row */}
                    {isRunning && (
                       <div style={{ display: 'flex', gap: '6px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', width: '100%', justifyContent: 'center', marginBottom: '8px' }}>
                         <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); onQuickPrint(table); }} title="Print KOT" style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 4px', borderRadius: '12px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><Printer size={16} color="#64748b" /></button>
                         <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); onQuickSettle(table); }} title="Settle Bill" style={{ flex: 1, background: '#111827', border: 'none', padding: '10px 4px', borderRadius: '12px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><CheckSquare size={16} color="white" /></button>
                         <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); setTableToClear(table.id); }} title="Discard" style={{ flex: 1, background: '#fff1f2', border: 'none', padding: '10px 4px', borderRadius: '12px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><Trash2 size={16} color="#ef4444" /></button>
                       </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>

          ) : (
            <div className="pp-table-grid no-scrollbar">
              {filteredTables.filter(t => t.type === section).map(table => {
                const tableTotal = table.total || 0;
                const isRunning = table.status !== 'vacant';
                const isPrinted = table.status === 'billing';
                const isSaved = table.status === 'draft';

                return (
                  <div
                    key={table.id}
                    onClick={() => onSelectTable(table)}
                    className={`pp-table-card status-${table.status || 'blank'}`}
                    style={{
                      height: '200px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '16px',
                      paddingBottom: '20px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Top Row: Table Name & Compact Timer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.4px' }}>Table</div>
                        <div style={{ fontSize: '20px', fontWeight: '950', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {table.name.replace('Table ', '')}
                        </div>
                      </div>
                      {isRunning && (
                        <div style={{ flexShrink: 0 }}>
                           <TimeElapsed createdAt={table.createdAt} />
                        </div>
                      )}
                    </div>

                    {/* Middle: Status & Price (Centered for consistency) */}
                    <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 0' }}>
                      <div style={{ fontSize: '9px', fontWeight: '900', color: isRunning ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                        {table.status === 'draft' ? '🔵 DRAFT' : 
                         table.status === 'kot_pending' ? '🟡 KOT PENDING' : 
                         table.status === 'kot_printed' ? '🟠 KOT PRINTED' : 
                         table.status === 'billing' ? '🟢 BILLING' : '○ VACANT'}
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: '950', color: isRunning ? 'var(--primary)' : '#e2e8f0', margin: '2px 0', lineHeight: 1 }}>
                        {tableTotal > 0 ? `₹${Math.floor(tableTotal)}` : '--'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginTop: '4px' }}>
                        {isRunning ? `${table.orders?.length || 0} items` : 'No items'}
                      </div>
                    </div>

                    {/* Bottom: Action Row */}
                    {isRunning && (
                       <div style={{ display: 'flex', gap: '6px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', width: '100%', justifyContent: 'center', marginBottom: '8px' }}>
                         <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); onQuickPrint(table); }} title="Print KOT" style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 4px', borderRadius: '12px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><Printer size={16} color="#64748b" /></button>
                         <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); onQuickSettle(table); }} title="Settle Bill" style={{ flex: 1, background: '#111827', border: 'none', padding: '10px 4px', borderRadius: '12px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><CheckSquare size={16} color="white" /></button>
                         <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); setTableToClear(table.id); }} title="Discard" style={{ flex: 1, background: '#fff1f2', border: 'none', padding: '10px 4px', borderRadius: '12px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><Trash2 size={16} color="#ef4444" /></button>
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      ))}
    </div>
  );
};

/* --- KITCHEN DISPLAY SYSTEM --- */
const KitchenDisplay = ({ orders, onUpdateStatus }) => {
  const lifecycle = ['NEW', 'PREPARING', 'READY', 'SERVED'];
  
  const getNextStatus = (current) => {
    const idx = lifecycle.indexOf(current.toUpperCase());
    if (idx !== -1 && idx < lifecycle.length - 1) return lifecycle[idx + 1];
    return null;
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#0f172a', color: 'white' }} className="animate-fade-in no-scrollbar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '950', display: 'flex', alignItems: 'center', gap: '12px', letterSpacing: '-0.5px' }}>
          <ChefHat size={32} color="#f87171" strokeWidth={2.5} /> Live Kitchen Queue
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {lifecycle.map(s => (
            <div key={s} style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>{s}</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {orders.filter(o => o.status !== 'COMPLETED').map(order => {
          const next = getNextStatus(order.status);
          
          return (
            <div key={order.id} style={{ background: '#1e293b', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
              <div style={{ background: order.status === 'NEW' ? '#dc2626' : order.status === 'PREPARING' ? '#ea580c' : '#16a34a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '900', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', marginBottom: '2px' }}>Table {order.table_number || 'N/A'}</div>
                  <div style={{ fontWeight: '950', fontSize: '18px' }}>Ord #{String(order.id).slice(-4)}</div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '900', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '10px' }}>
                  {order.status}
                </div>
              </div>
              
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {order.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '16px', color: '#f1f5f9' }}>{item.quantity} × {item.name}</div>
                      {item.notes && <div style={{ fontSize: '12px', color: '#f87171', fontStyle: 'italic', marginTop: '4px' }}>“{item.notes}”</div>}
                    </div>
                  </div>
                ))}
              </div>

              {next && (
                <button
                  disabled={!IS_LOCAL}
                  onClick={() => onUpdateStatus(order.id, next)}
                  style={{ background: '#334155', color: 'white', border: 'none', padding: '20px', fontWeight: '900', fontSize: '14px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', transition: 'all 0.2s', borderTop: '1px solid rgba(255,255,255,0.05)', opacity: IS_LOCAL ? 1 : 0.5 }}
                  onMouseOver={(e) => { if (IS_LOCAL) e.currentTarget.style.background = '#475569'; }}
                  onMouseOut={(e) => { if (IS_LOCAL) e.currentTarget.style.background = '#334155'; }}
                >
                   {order.status === 'NEW' ? 'START PREPARING' : `MARK AS ${next}`} <ChevronDown size={18} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const NonTableManagement = ({ orders, onSelectOrder, onCreateOrder, onViewChange, onQuickSettle, onQuickPrint, onClearOrder, onCancelOrder, globalSearch }) => {
  const [localSearch, setLocalSearch] = useState('');
  const [confirmingAction, setConfirmingAction] = useState(null); // { id, type: 'cancel' | 'delete' }
  const getOrderTotal = (orderArr) => (orderArr || []).reduce((acc, item) => acc + ((item.price || 0) * (item.qty || 0)), 0);

  const searchVal = globalSearch || localSearch;

  const filteredOrders = orders.filter(o => {
    const hasItems = (o.orders || o.items || []).length > 0;
    if (!hasItems) return false;
    if (o.status === 'CANCELED') return false;
    
    return (o.id && String(o.id).toLowerCase().includes(searchVal.toLowerCase())) ||
      (o.customerName && String(o.customerName).toLowerCase().includes(searchVal.toLowerCase())) ||
      (o.phone && String(o.phone).includes(searchVal)) ||
      (o.type && String(o.type).toLowerCase().includes(searchVal.toLowerCase()));
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px', background: '#f8fafc' }} className="animate-fade-in no-scrollbar">
      
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
              placeholder="Search Pickup Order ID / Mobile..." 
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '13px', outline: 'none' }} 
            />
          </div>
          <button
            disabled={!IS_LOCAL}
            className="btn-pp"
            onClick={() => onCreateOrder('Takeaway')}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--primary)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px -1px rgba(148, 22, 28, 0.2)',
              opacity: IS_LOCAL ? 1 : 0.5,
              cursor: IS_LOCAL ? 'pointer' : 'not-allowed'
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
        {[...filteredOrders].sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20).map(order => {
          const tableTotal = getOrderTotal(order.orders || []);
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
              style={{
                position: 'relative', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '180px', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Main Clickable Area */}
              <div 
                onClick={() => {
                  if (!IS_LOCAL) return alert("Read-Only Mode: Order viewing only. Menu updates disabled.");
                  onSelectOrder(order);
                }}
                style={{ flex: 1, padding: '20px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed' }}
              >
                 <div style={{ paddingRight: '120px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                     <div style={{ fontSize: '11px', fontWeight: '900', color: 'var(--primary)' }}>{order.id}</div>
                     <div style={{ 
                       fontSize: '9px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px',
                       background: (order.paymentStatus === 'UNPAID' || order.payment_status === 'UNPAID') ? '#fef2f2' : '#f0fdf4',
                       color: (order.paymentStatus === 'UNPAID' || order.payment_status === 'UNPAID') ? '#ef4444' : '#10b981',
                       border: `1px solid ${(order.paymentStatus === 'UNPAID' || order.payment_status === 'UNPAID') ? '#fecaca' : '#bbf7d0'}`,
                       textTransform: 'uppercase'
                     }}>
                       {order.paymentStatus || order.payment_status || 'PAID'}
                     </div>
                   </div>
                   <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>{order.customerName || order.name}</div>
                   <TimeElapsed createdAt={order.createdAt} />
                 </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', marginTop: '12px' }}>
                  <Clock size={12} color="#64748b" />
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{statusLabel}</span>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }}></div>
                </div>

                <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={14} color="#94a3b8" /> {order.phone || 'Walk-In'}
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', width: '100%', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{(order.orders || []).reduce((acc, i) => acc + (i.qty || 0), 0)} Items</div>
                  <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--primary)' }}>₹{tableTotal}</div>
                </div>
              </div>

              {/* Absolute Action Controls (Upper Right) */}
              <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', zIndex: 100 }}>
                <div style={{ fontSize: '10px', background: bg, color: text, padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold', border: `1px solid ${border}`, textTransform: 'uppercase' }}>{order.type}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(String(order.paymentStatus || order.payment_status || '').toUpperCase() === 'PAID') ? (
                    <button 
                      disabled={!IS_LOCAL}
                      title="Cancel Order" 
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        setConfirmingAction({ id: order.id, type: 'cancel' });
                      }} 
                      style={{ padding: '8px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '8px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', opacity: IS_LOCAL ? 1 : 0.5, zIndex: 110 }}
                    >
                      <XCircle size={16} color="#f97316" />
                    </button>
                  ) : (
                    <button 
                      disabled={!IS_LOCAL}
                      title="Delete" 
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        setConfirmingAction({ id: order.id, type: 'delete' });
                      }} 
                      style={{ padding: '8px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', opacity: IS_LOCAL ? 1 : 0.5, zIndex: 110 }}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  )}
                  <button 
                    disabled={!IS_LOCAL}
                    title="Settle" 
                    onClick={(e) => { e.stopPropagation(); onQuickSettle(order); }} 
                    style={{ padding: '8px', background: 'var(--primary)', border: 'none', borderRadius: '8px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', color: 'white', display: 'flex', opacity: IS_LOCAL ? 1 : 0.5 }}
                  >
                    <CheckSquare size={16} />
                  </button>
                </div>
              </div>

              {/* Custom Inline Confirmation Overlay */}
              {confirmingAction && confirmingAction.id === order.id && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.98)', 
                    zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', 
                    justifyContent: 'center', borderRadius: '20px', padding: '16px', textAlign: 'center',
                    backdropFilter: 'blur(8px)', border: '2px solid var(--primary)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.1)'
                  }}
                >
                  <p style={{ fontWeight: '900', marginBottom: '16px', color: '#1e293b', fontSize: '14px' }}>
                    {confirmingAction.type === 'cancel' ? 'CANCEL PAID ORDER?' : 'DELETE UNPAID ORDER?'}
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirmingAction.type === 'cancel') onCancelOrder(order.id);
                        else onClearOrder(order.id);
                        setConfirmingAction(null);
                      }}
                      style={{ background: '#821a1d', color: '#fff', padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: '900', fontSize: '13px' }}
                    >
                      YES
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConfirmingAction(null); }}
                      style={{ background: '#f1f5f9', color: '#475569', padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: '900', fontSize: '13px' }}
                    >
                      NO
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


const OrderingSystem = ({ table, tables, nonTableOrders, initialOrder, onBack, onSaveOrder, onCancelOrder, onAddItem, onSettleTable, onChangeTable, MENU_ITEMS, CATEGORIES, customers, settings, loadTables }) => {
  // Fix redundant 'Table Table' title
  const displayTitle = table?.name?.toLowerCase().includes('table') 
    ? table.name 
    : `Table ${table?.name || table?.id || '...'}`;

  const [cart, setCart] = useState(initialOrder || []);
  const [activeCat, setActiveCat] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const isPickup = table?.type === 'Takeaway' || table?.type === 'Delivery';
  const [orderNote, setOrderNote] = useState(table?.note || '');

  // SYNC CART WITH BACKEND REAL-TIME
  useEffect(() => {
    setCart(initialOrder || []);
  }, [initialOrder]);

  // Customer CRM State
  const [customerPhone, setCustomerPhone] = useState(table?.phone || '');
  const [customerName, setCustomerName] = useState(table?.customerName || '');
  const [customerInfo, setCustomerInfo] = useState(null);
  const [redeemedPoints, setRedeemedPoints] = useState(0);

  // SYNC CUSTOMER INFO ONLY ON INITIAL LOAD OR PHONE CHANGE
  useEffect(() => {
    if (customerPhone.length === 10 && customers && customers[customerPhone]) {
      setCustomerInfo(customers[customerPhone]);
      // Only auto-fill name if it's currently empty or was just initialized
      if (!customerName || customerName === 'Walk-In') {
        setCustomerName(customers[customerPhone].name);
      }
    } else {
      setCustomerInfo(null);
    }
  }, [customerPhone, customers]);

  // Handle switching between different tables/orders
  useEffect(() => {
    setCustomerName(table?.customerName || '');
    setCustomerPhone(table?.phone || '');
    setOrderNote(table?.note || '');
    setCart(initialOrder || []);
  }, [table?.id]);

  // Modifiers & Modal State
  const [showModifierModal, setShowModifierModal] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(null);
  const [customNoteText, setCustomNoteText] = useState('');

  // Service Charge & Tax Logic
  const isVacant = !table?.status || table.status === 'vacant';
  const [applyServiceCharge, setApplyServiceCharge] = useState(
    isPickup ? false : (isVacant ? (settings?.autoServiceCharge ?? true) : (table?.service_charge_enabled ?? false))
  );
  const [serviceChargeRate, setServiceChargeRate] = useState(
    isVacant ? (settings?.serviceChargeRate ?? 5) : (table?.service_charge_rate ?? 5)
  );

  const [applyGst, setApplyGst] = useState(
    isVacant ? (settings?.gstEnabled ?? false) : (table?.gst_enabled ?? false)
  );
  const [gstRate, setGstRate] = useState(
    isVacant ? (settings?.gstRate ?? 5) : (table?.gst_rate ?? 5)
  );

  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountRate, setDiscountRate] = useState(10);
  const [splitWays, setSplitWays] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discountAuth, setDiscountAuth] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(table?.paymentMethod || table?.payment_method || 'Cash');
  const [isPaid, setIsPaid] = useState(isPickup ? (table?.paymentStatus !== 'UNPAID' && table?.payment_status !== 'UNPAID') : false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [upiReceived, setUpiReceived] = useState('');

  // 🔥 NEW REQUESTED LOGIC
  const printKOT = async (items = cart) => {
    // Detect new items
    const unprinted = items.filter(i => (i.qty - (i.printedQty || 0)) > 0);
    const list = unprinted.length > 0 ? unprinted : items;
    
    await printPosToSerial({
      orderId: table?.id,
      tableName: table?.name || `Table ${table?.id}`,
      customerName, customerPhone,
      items: list.map(i => ({ ...i, qty: i.qty - (i.printedQty || 0) || i.qty })),
      subtotal, serviceCharge, roundOff, grandTotal,
      orderType: table?.type || 'Dine In'
    }, 'KOT', settings);
  };

  const printBill = async () => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const seqKey = `bill_seq_${today}`;
    let seq = parseInt(localStorage.getItem(seqKey) || '0', 10);
    seq += 1;
    localStorage.setItem(seqKey, seq.toString());
    const billNo = seq.toString().padStart(4, '0');

    await printPosToSerial({
      orderId: table?.id,
      tableName: table?.name || `Table ${table?.id}`,
      customerName, customerPhone,
      items: cart,
      subtotal, serviceCharge, gstAmount, roundOff, grandTotal,
      billNumber: billNo,
      orderType: table?.type || 'Dine In'
    }, 'BILL', settings);
  };

  const handleKOT = async () => {
    if (!cart || cart.length === 0) { alert("No items to send"); return; }
    if (!table) { alert("No table selected"); return; }

    const tid = String(table.id || '').toUpperCase();
    const isTakeaway = tid.startsWith('TA-') || tid.startsWith('DL-') || tid.startsWith('TAK-') || tid.startsWith('DEL-');

    const deltaItems = cart.map(item => {
      const existing = (initialOrder || []).find(i => i.name === item.name);
      const existingQty = existing ? (existing.qty || existing.quantity || 0) : 0;
      const newQty = item.qty - existingQty;
      if (newQty > 0) return { ...item, qty: newQty, quantity: newQty };
      return null;
    }).filter(Boolean);

    if (deltaItems.length === 0) { alert("No new items to send to KOT"); return; }

    if (isTakeaway) {
      await onSaveOrder(table.id, cart, 'kot_pending', {
        customerName, customerPhone, note: orderNote,
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        paymentMethod: paymentMethod,
        gst_enabled: applyGst, gst_rate: gstRate,
        service_charge_enabled: applyServiceCharge, service_charge_rate: serviceChargeRate
      });
      setCart([]);
      if (onBack) onBack(cart);
      return;
    }

    // 🔥 INSTANT UI ACTION
    const fullCartForSync = [...cart];
    setCart([]);
    if (onBack) onBack(fullCartForSync);

    // Perform background tasks
    (async () => {
      try {
        const { updateOrderApi } = await import('./utils/apiClient');
        await updateOrderApi(table.id, { 
          items: fullCartForSync, 
          status: 'KOT_PENDING',
          gst_enabled: applyGst,
          gst_rate: gstRate,
          service_charge_enabled: applyServiceCharge,
          service_charge_rate: serviceChargeRate,
          note: orderNote
        });
        console.log("✅ KOT Sync Successful in background");
      } catch (err) {
        console.error("❌ Background KOT failed:", err);
      }
    })();
  };

  const handleKOTPrint = async () => {
    if (!cart || cart.length === 0) { alert("No items to send"); return; }
    if (!table) { alert("No table selected"); return; }

    const tid = String(table.id || '').toUpperCase();
    const isTakeaway = tid.startsWith('TA-') || tid.startsWith('DL-') || tid.startsWith('TAK-') || tid.startsWith('DEL-');

    const deltaItems = cart.map(item => {
      const existing = (initialOrder || []).find(i => i.name === item.name);
      const existingQty = existing ? (existing.qty || existing.quantity || 0) : 0;
      const newQty = item.qty - existingQty;
      if (newQty > 0) return { ...item, qty: newQty, quantity: newQty };
      return null;
    }).filter(Boolean);

    if (deltaItems.length === 0) { alert("No new items to print KOT"); return; }

    if (isTakeaway) {
      await onSaveOrder(table.id, cart, 'kot_printed', {
        customerName, customerPhone, note: orderNote,
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        paymentMethod: paymentMethod,
        gst_enabled: applyGst, gst_rate: gstRate,
        service_charge_enabled: applyServiceCharge, service_charge_rate: serviceChargeRate
      });
      await printKOT(deltaItems);
      setCart([]);
      if (onBack) onBack(cart);
      return;
    }

    // 🔥 INSTANT UI ACTION
    const fullCartForSync = [...cart];
    setCart([]);
    if (onBack) onBack(fullCartForSync);

    // Perform background tasks
    (async () => {
      try {
        // 1. Sync to backend FIRST (to update status instantly)
        const { updateOrderApi } = await import('./utils/apiClient');
        await updateOrderApi(table.id, { 
          items: fullCartForSync, 
          status: 'KOT_PRINTED',
          gst_enabled: applyGst,
          gst_rate: gstRate,
          service_charge_enabled: applyServiceCharge,
          service_charge_rate: serviceChargeRate,
          note: orderNote
        });
        
        // 2. Hardware action (printing) - might block if browser dialog shows
        await printKOT(deltaItems);
        
        console.log("✅ KOT Print & Sync Successful in background");
      } catch (err) {
        console.error("❌ Background KOT+Print failed:", err);
        // We might want a toast notification here instead of alert to not disrupt flow
        // alert("Failed to send KOT. Check connection."); 
      }
    })();
  };

  const handleSave = async () => {
    if (!cart || cart.length === 0) { alert("Please add at least 1 item to the order."); return; }
    if (!table) { alert("No table selected"); return; }
    await onSaveOrder(table.id, cart, 'occupied', { 
      customerName, 
      customerPhone, 
      note: orderNote,
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      paymentMethod: paymentMethod,
      gst_enabled: applyGst,
      gst_rate: gstRate,
      service_charge_enabled: applyServiceCharge,
      service_charge_rate: serviceChargeRate
    });
  };

  const handlePrintBill = async () => {
    if (!cart || cart.length === 0) { alert("Please add at least 1 item to the order."); return; }
    if (!table) { alert("No table selected"); return; }
    
    const tid = String(table.id || '').toUpperCase();
    const isTakeaway = tid.startsWith('TA-') || tid.startsWith('DL-') || tid.startsWith('TAK-') || tid.startsWith('DEL-');
    
    // Mark as completed if already paid, otherwise printed
    const finalStatus = (isTakeaway && isPaid) ? 'completed' : 'printed';

    await onSaveOrder(table.id, cart, finalStatus, { 
      customerName, 
      customerPhone, 
      note: orderNote,
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      paymentMethod: paymentMethod,
      gst_enabled: applyGst,
      gst_rate: gstRate,
      service_charge_enabled: applyServiceCharge,
      service_charge_rate: serviceChargeRate
    });
    await printBill();
  };

  const addItemToTable = async (item) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Adding items disabled.");
    if (!table) return;

    // Standardize item for backend
    const newItem = { name: item.name, price: item.price, quantity: 1, qty: 1 };
    
    // 🔥 INSTANT UI ACTION: Sync in background
    (async () => {
      try {
        const { updateOrderApi } = await import('./utils/apiClient');
        await updateOrderApi(table.id, { 
          items: [newItem], 
          status: 'OCCUPIED',
          gst_enabled: applyGst,
          gst_rate: gstRate,
          service_charge_enabled: applyServiceCharge,
          service_charge_rate: serviceChargeRate
        });
        console.log("✅ Background item add sync successful");
      } catch (err) { 
        console.error("❌ Background item add failed:", err);
      }
    })();
  };

  // 1. Sync cart when initialOrder changes (background sync)
  useEffect(() => {
    setCart(initialOrder || []);
  }, [initialOrder]);

  // 2. Sync tax & metadata ONLY on table switch or global default change
  useEffect(() => {
    if (!table) return;
    const isVacant = !table.status || table.status === 'vacant';
    
    setOrderNote(table.note || '');
    setCustomerPhone(table.phone || '');
    setCustomerName(table.customerName || '');
    setRedeemedPoints(0);
    
    // --- Tax & Service Charge Logic ---
    // For running tables, prioritize saved settings. For vacant, use defaults.
    const tableGst = table.gst_enabled !== undefined ? Boolean(table.gst_enabled) : null;
    const finalGst = isVacant ? (settings?.gstEnabled ?? false) : (tableGst !== null ? tableGst : (settings?.gstEnabled ?? false));
    setApplyGst(finalGst);
    setGstRate(isVacant ? (settings?.gstRate || 5) : (table.gst_rate || settings?.gstRate || 5));

    if (isPickup) {
      setApplyServiceCharge(false);
      setIsPaid(table.paymentStatus !== 'UNPAID' && table.payment_status !== 'UNPAID');
      setPaymentMethod(table.paymentMethod || table.payment_method || 'Cash');
    } else {
      const tableSc = table.service_charge_enabled !== undefined ? Boolean(table.service_charge_enabled) : null;
      const finalSc = isVacant ? (settings?.autoServiceCharge ?? false) : (tableSc !== null ? tableSc : (settings?.autoServiceCharge ?? false));
      setApplyServiceCharge(finalSc);
      setServiceChargeRate(isVacant ? (settings?.serviceChargeRate || 5) : (table.service_charge_rate || settings?.serviceChargeRate || 5));
    }
  }, [table?.id, settings?.gstEnabled, settings?.autoServiceCharge, settings?.gstRate, settings?.serviceChargeRate, isPickup]);

  // 3. Sync customer details if they change externally
  useEffect(() => {
    if (table) {
      setCustomerName(table.customerName || '');
      setCustomerPhone(table.phone || '');
    }
  }, [table?.customerName, table?.phone]);

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const discountAmt = applyDiscount ? (subtotal * (discountRate / 100)) : 0;
  const taxableAmount = Math.max(0, subtotal - discountAmt - redeemedPoints);
  const serviceCharge = applyServiceCharge ? (taxableAmount * (serviceChargeRate / 100)) : 0;
  const gstAmount = applyGst ? ((taxableAmount + serviceCharge) * (gstRate / 100)) : 0;
  const rawTotal = taxableAmount + serviceCharge + gstAmount;
  const grandTotal = Math.round(rawTotal);
  const roundOff = grandTotal - rawTotal;

  // Calculate globally reserved stock (qty already in other running tables/orders)
  // This satisfies the "live update" requirement so punched orders reflect immediately across the floor.
  const getReservedStock = (itemId) => {
    let reserved = 0;
    // Check all tables
    (tables || []).forEach(t => {
      if (t.id !== table?.id) { // Skip current table
        (t.orders || []).forEach(i => {
          if (i.id === itemId) reserved += i.qty;
        });
      }
    });
    // Check all non-table orders (takeaways, deliveries, online)
    (nonTableOrders || []).forEach(o => {
      if (o.id !== table?.id) { // Skip current takeaway/delivery if editing one
        (o.orders || []).forEach(i => {
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

  const handleUndo = () => {
    if (cart.length === 0) return;
    setCart(prev => {
      const lastItem = prev[prev.length - 1];
      if (!lastItem) return prev;
      
      // Allow undoing items that haven't been printed to kitchen yet
      const unprintedQty = lastItem.qty - (lastItem.printedQty || 0);
      if (unprintedQty > 0) {
        if (lastItem.qty > 1) {
          return prev.map((item, index) => 
            index === prev.length - 1 ? { ...item, qty: item.qty - 1 } : item
          );
        } else {
          return prev.slice(0, -1);
        }
      } else {
        alert("Cannot undo items already sent to kitchen (KOT).");
        return prev;
      }
    });
  };

  const clearCart = () => {
    if (window.confirm("Remove all items from current order?")) {
      setCart([]);
    }
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
    if (isPickup && (!cart || cart.length === 0)) {
      alert("Please add at least 1 item to the order.");
      return;
    }
    console.log("🔥 handleAction triggered for:", actionType);
    let updatedCart = [...cart];
    let itemsToPrint = [];

    const isKOT = actionType.includes('KOT');
    const isPrint = actionType.includes('Print');
    const isBill = actionType === 'Print Bill' || actionType.includes('Bill');
    const newStatus = isKOT ? 'kot' : isPrint ? 'printed' : 'occupied';

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
      // 🚀 NEW: Detect unprinted items for a quick KOT print before the bill
      const unprinted = cart.filter(i => (i.qty - (i.printedQty || 0)) > 0);
      if (unprinted.length > 0) {
        console.log("🛎️ Printing pending items to KOT before Bill");
        await printPosToSerial({
          orderId: table?.id,
          tableName: (table?.name && table?.name.trim() !== '') ? table.name : `Table ${table?.id}`,
          customerName, customerPhone,
          items: unprinted.map(i => ({ ...i, qty: i.qty - (i.printedQty || 0) })),
          subtotal, serviceCharge, roundOff, grandTotal,
          orderType: table?.type || 'Dine In'
        }, 'KOT', settings);
        // Mark as printed before saving
        updatedCart = cart.map(i => ({ ...i, printedQty: i.qty }));
      }
      itemsToPrint = updatedCart;
    }

    if (isPaid && actionType.includes('Save')) {
      // Settle and clear table with full analytics data
      await onSettleTable(table.id, { cart: updatedCart, subtotal, discountAmt, redeemedPoints, discountAuth, taxes: 0, grandTotal, paymentMethod, timestamp: new Date().toISOString(), phone: customerPhone, customerName, note: orderNote });
    } else {
      // Just save order state
      setCart(updatedCart); // update local state so diff tracking is consistent
      await onSaveOrder(table.id, updatedCart, newStatus, { customerName, customerPhone, note: orderNote });
    }

    if (isPrint) {
      let billNo = undefined;
      if (isBill) {
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const seqKey = `bill_seq_${today}`;
        let seq = parseInt(localStorage.getItem(seqKey) || '0', 10);
        seq += 1;
        localStorage.setItem(seqKey, seq.toString());
        billNo = seq.toString().padStart(4, '0');
      }

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
        billNumber: billNo,
        orderType: table?.type === 'Delivery' ? 'Delivery' : table?.type === 'Takeaway' ? 'Pick Up' : 'Dine In'
      }, isBill ? 'BILL' : 'KOT', settings);
    }
  };

  const availableCategories = ['All', ...CATEGORIES.map(c => typeof c === 'object' ? c.name : c).filter((cat, index, self) => self.indexOf(cat) === index)];
  const filteredItems = MENU_ITEMS
    .filter(item => {
      const itemCat = typeof item.category === 'object' ? item.category.name : item.category;
      return (activeCat === 'All' || itemCat === activeCat) &&
             item.name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (a.inStock === b.inStock) return a.name.localeCompare(b.name);
      return a.inStock ? -1 : 1;
    });

  return (
    <div className="animate-fade-in" style={{ flex: 1, display: 'flex', background: '#f3f4f6', position: 'relative', height: '100%', overflow: 'hidden' }}>

      {/* Category Sidebar */}
      <div className="no-print" style={{ width: '180px', background: 'white', display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRight: '1px solid #e2e8f0', zIndex: 10 }}>
        <div style={{ padding: '20px 16px', fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Menu</div>
        {availableCategories.map(cat => {
          const name = typeof cat === 'object' ? cat.name : cat;
          return (
            <button
              key={name}
              onClick={() => setActiveCat(name)}
              style={{ 
                padding: '16px 20px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '14px', 
                fontWeight: activeCat === name ? '800' : '500', 
                color: activeCat === name ? 'var(--primary)' : '#475569',
                borderLeft: `4px solid ${activeCat === name ? 'var(--primary)' : 'transparent'}`,
                backgroundColor: activeCat === name ? 'var(--primary)10' : 'transparent',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Main Item Grid Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb', background: '#f8fafc' }}>
        <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="no-print">
          <div style={{ fontWeight: '800', fontSize: '18px', color: '#1e293b' }}>{activeCat}</div>
          <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '10px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px', width: '300px' }}>
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Search anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '14px', color: '#1e293b' }}
            />
          </div>
        </div>

        <div className="items-grid no-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '24px', alignContent: 'flex-start' }}>
          {filteredItems.map(item => {
            const isRetail = item.type === 'retail';
            let liveStock = null;
            let isAvailable = item.inStock !== undefined ? item.inStock : true;

            if (isRetail) {
              const cartQty = cart.reduce((acc, c) => c.id === item.id ? acc + c.qty : acc, 0);
              const otherReserved = getReservedStock(item.id);
              liveStock = item.stockQuantity - otherReserved - cartQty;
              isAvailable = liveStock > 0;
            }

            return (
              <div
                key={item.id}
                className={`item-card ${String(item.type || '').toLowerCase() === 'non-veg' ? 'non-veg' : 'veg'}`}
                onClick={() => {
                  if (!IS_LOCAL) return alert("Read-Only Mode: Menu updates disabled.");
                  if (isAvailable || !isRetail) handleItemClick(item);
                }}
                style={{
                  opacity: (isAvailable && IS_LOCAL) ? 1 : 0.5,
                  cursor: (isAvailable && IS_LOCAL) ? 'pointer' : 'not-allowed',
                  background: 'white'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827', lineHeight: '1.2' }}>
                  {item.name}
                  {isRetail && <div style={{ marginTop: '4px', background: '#f0f9ff', color: '#0284c7', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Stock: {liveStock}</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: '#111827' }}>₹{item.price}</div>
                  {!isAvailable && <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: '900', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px' }}>OUT</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing Panel */}
      <div className="billing-panel no-print">
        <div style={{ background: 'var(--primary)', color: 'white', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: '900', fontSize: '15px' }}>{displayTitle}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(String(table?.id).startsWith('TAK-') || String(table?.id).startsWith('DEL-') || String(table?.id).startsWith('TA-') || String(table?.id).startsWith('DL-')) && (
              <>
                {(table.paymentStatus === 'PAID' || table.payment_status === 'PAID') ? (
                  <button 
                    onClick={() => { 
                      if(confirm(`Cancel PAID order ${table.id}?`)) {
                        onCancelOrder(table.id);
                        onBack([]); // Close ordering view
                      }
                    }} 
                    style={{ background: '#f97316', border: 'none', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    <XCircle size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }}/>Cancel Order
                  </button>
                ) : (
                  <button 
                    onClick={() => { 
                      if(confirm(`Confirm deletion of order ${table.id}?`)) {
                        onSaveOrder(table.id, [], 'free'); 
                      }
                    }} 
                    style={{ background: '#ef4444', border: 'none', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    <Trash2 size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }}/>Delete
                  </button>
                )}
              </>
            )}
            <button onClick={() => onBack(cart)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
          </div>
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
              style={{ border: '1px solid var(--primary)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', outline: 'none', background: 'white' }}
            >
              <option value={table?.id} disabled>{displayTitle}</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
              ))}
            </select>
          ) : (
            <div style={{ border: '1px solid var(--primary)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              {displayTitle}
            </div>
          )}
          <button onClick={() => onBack(cart)} style={{ background: 'transparent', border: 'none', fontSize: '11px', color: '#6b7280', cursor: 'pointer', textDecoration: 'underline' }}>
            {table && (String(table.id).startsWith('DEL-') || String(table.id).startsWith('TAK-') || String(table.id).startsWith('TA-') || String(table.id).startsWith('DL-')) ? 'Back to Online' : 'Back to Tables'}
          </button>
          <div style={{ marginLeft: 'auto', background: 'var(--primary)', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
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
              ⚠️ Required for pickup orders
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
                  {item.note && <div style={{ fontSize: '10px', color: 'var(--primary)', fontStyle: 'italic' }}>* {item.note}</div>}
                  <div style={{ fontSize: '10px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ₹{item.price} /ea
                    <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6, padding: 0 }}
                      onClick={() => {
                        setCustomNoteText(item.note || '');
                        setShowNoteModal(item);
                      }}>
                      <MessageSquare size={12} color="var(--primary)" />
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

            {applyDiscount && discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Discount ({discountRate}%)</span>
                <span style={{ fontSize: '14px', color: '#ef4444' }}>-₹{discountAmt.toFixed(2)}</span>
              </div>
            )}

            {applyServiceCharge && serviceCharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Service Charge ({serviceChargeRate}%)</span>
                <span style={{ fontSize: '14px', color: '#1e293b' }}>₹{serviceCharge.toFixed(2)}</span>
              </div>
            )}

            {applyGst && gstAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>GST ({gstRate}%)</span>
                <span style={{ fontSize: '14px', color: '#1e293b' }}>₹{gstAmount.toFixed(2)}</span>
              </div>
            )}

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
                    <input type="number" value={serviceChargeRate} onChange={(e) => setServiceChargeRate(parseFloat(e.target.value) || 0)} style={{ width: '50px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontSize: '12px' }} />
                  )}
                </div>

                {/* GST */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="gst-toggle" checked={applyGst} onChange={(e) => setApplyGst(e.target.checked)} />
                    <label htmlFor="gst-toggle" style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>GST %</label>
                  </div>
                  {applyGst && (
                    <input type="number" value={gstRate} onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)} style={{ width: '50px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontSize: '12px' }} />
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
              <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)' }}>₹{grandTotal.toFixed(2)}</div>
              {splitWays > 1 && <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 'bold' }}>₹{(grandTotal / splitWays).toFixed(2)} / person</div>}
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
                      borderColor: paymentMethod === method ? 'var(--primary)' : '#e2e8f0',
                      background: paymentMethod === method ? '#fef2f2' : 'white',
                      color: paymentMethod === method ? 'var(--primary)' : '#64748b',
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

          <div className="footer-btn-grid" style={{ padding: '8px', gap: '8px' }}>
            <button disabled={!IS_LOCAL} className="btn-maroon" onClick={handleSave} style={{ opacity: IS_LOCAL ? 1 : 0.5, cursor: IS_LOCAL ? 'pointer' : 'not-allowed' }}>Save</button>
            <button disabled={!IS_LOCAL} className="btn-maroon" onClick={handlePrintBill} style={{ opacity: IS_LOCAL ? 1 : 0.5, cursor: IS_LOCAL ? 'pointer' : 'not-allowed' }}>Print Bill</button>
            <button disabled={!IS_LOCAL} className="btn-grey" onClick={handleKOT} style={{ opacity: IS_LOCAL ? 1 : 0.5, cursor: IS_LOCAL ? 'pointer' : 'not-allowed' }}>KOT</button>
            <button disabled={!IS_LOCAL} className="btn-grey" style={{ background: '#374151', opacity: IS_LOCAL ? 1 : 0.5, cursor: IS_LOCAL ? 'pointer' : 'not-allowed' }} onClick={handleKOTPrint}>KOT & Print</button>
          </div>
          

        </div>
      </div>

      {/* Modifier Modal Overlay */}
      {showModifierModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: 'var(--radius-md)', width: '320px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
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
          <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: 'var(--radius-md)', width: '340px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
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
                style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal Overlay */}
      {showSettleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontWeight: '900', fontSize: '20px', color: '#1f2937' }}>Settle {table?.name}</h3>
              <button onClick={() => setShowSettleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#991b1b', textTransform: 'uppercase', marginBottom: '4px' }}>Total Amount Due</div>
              <div style={{ fontSize: '32px', fontWeight: '950', color: '#94161c' }}>₹{grandTotal.toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '6px' }}>CASH RECEIVED</label>
                <input 
                  type="number" 
                  value={cashReceived} 
                  onChange={(e) => setCashReceived(e.target.value)} 
                  placeholder="0.00"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #f1f5f9', fontSize: '16px', fontWeight: 'bold', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '6px' }}>UPI RECEIVED</label>
                <input 
                  type="number" 
                  value={upiReceived} 
                  onChange={(e) => setUpiReceived(e.target.value)} 
                  placeholder="0.00"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #f1f5f9', fontSize: '16px', fontWeight: 'bold', outline: 'none' }}
                />
              </div>
            </div>

            {/* Calculation */}
            {(() => {
              const totalPaid = (parseFloat(cashReceived) || 0) + (parseFloat(upiReceived) || 0);
              const change = totalPaid - grandTotal;
              return (
                <div style={{ padding: '12px', borderRadius: '10px', background: '#f8fafc', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Total Paid</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>₹{totalPaid.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Change to Return</span>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: change >= 0 ? '#10b981' : '#ef4444' }}>
                      {change >= 0 ? `₹${change.toFixed(2)}` : `Pending ₹${Math.abs(change).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              );
            })()}

            <button 
              disabled={((parseFloat(cashReceived) || 0) + (parseFloat(upiReceived) || 0)) < grandTotal}
              onClick={async () => {
                const totalPaid = (parseFloat(cashReceived) || 0) + (parseFloat(upiReceived) || 0);
                const method = (parseFloat(upiReceived) || 0) > 0 ? ((parseFloat(cashReceived) || 0) > 0 ? 'Split' : 'UPI') : 'Cash';
                await onSettleTable(table.id, { 
                  cart, subtotal, discountAmt, redeemedPoints, taxes: 0, grandTotal, 
                  paymentMethod: method, 
                  cashAmount: parseFloat(cashReceived) || 0,
                  upiAmount: parseFloat(upiReceived) || 0,
                  timestamp: new Date().toISOString(), 
                  phone: customerPhone, customerName, note: orderNote 
                });
                setShowSettleModal(false);
                if (onBack) onBack();
              }}
              style={{ 
                width: '100%', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: '950', color: 'white',
                background: ((parseFloat(cashReceived) || 0) + (parseFloat(upiReceived) || 0)) >= grandTotal ? '#10b981' : '#cbd5e1',
                cursor: ((parseFloat(cashReceived) || 0) + (parseFloat(upiReceived) || 0)) >= grandTotal ? 'pointer' : 'not-allowed'
              }}>
              COMPLETE SETTLEMENT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- ANALYTICS DASHBOARD --- */
const StatCard = ({ label, value, icon: Icon, color, subtext }) => (
  <div style={{ background: 'rgba(255,255,255,0.88)', padding: '22px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', position: 'relative', boxShadow: '0 18px 32px rgba(15, 23, 42, 0.06)' }}>
    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '900', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1.2px' }}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: '950', color: '#1e293b', letterSpacing: '-0.8px' }}>{value}</div>
    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', fontWeight: '700', lineHeight: 1.5 }}>{subtext}</div>
    <div style={{ position: 'absolute', top: '22px', right: '22px', width: '42px', height: '42px', borderRadius: '14px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={20} color={color} />
    </div>
  </div>
);

const InsightItem = ({ title, value, sub }) => (
  <div style={{ display: 'flex', gap: '12px' }}>
    <div style={{ width: '4px', background: 'var(--primary)', borderRadius: '2px' }} />
    <div>
      <div style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>{title}</div>
      <div style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', marginBottom: '2px' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>{sub}</div>
    </div>
  </div>
);

function MainApp() {
  // --- STATE INITIALIZATION (OFFLINE FIRST) ---
  const [view, setView] = useState('tables');
  const [selectedTable, setSelectedTable] = useState(null);
  const [quickSettleTable, setQuickSettleTable] = useState(null);
  const [quickPrintTable, setQuickPrintTable] = useState(null);
  const [tableToClear, setTableToClear] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [isDbLoaded, setIsDbLoaded] = useState(true); 
  const [deviceStatus, setDeviceStatus] = useState('APPROVED'); // Default for offline first
  const [isSyncing, setIsSyncing] = useState(false);
  const [deviceId, setDeviceId] = useState('LOCAL-DEVICE');
  const [cart, setCart] = useState([]);
  const [lanUrl, setLanUrl] = useState('');
  const [takeawayCounter, setTakeawayCounter] = useState(() => loadFromLocal('pos_ta_counter', 1));
  const [lastCounterDate, setLastCounterDate] = useState(() => loadFromLocal('pos_ta_date', new Date().toDateString()));

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      // Full system sync
      const res = await fetch(BASE_URL + "/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables, menu: menuItems })
      });
      const data = await res.json();
      if (data.success) {
        alert("Success: Local data synced to master server.");
      } else {
        throw new Error(data.error || "Sync failed");
      }
    } catch (err) {
      console.error("Manual sync failed:", err);
      alert("Sync Error: Could not reach the server at " + BASE_URL);
    } finally {
      setIsSyncing(false);
    }
  };

  const [loading, setLoading] = useState(!IS_LOCAL);
  console.log('📡 Base URL:', BASE_URL);

  async function fetchCloudData() {
    try {
      const res = await fetch(CLOUD_URL + "/sync", { signal: AbortSignal.timeout(5000) });
      const data = await res.json();

      setMenuItems(data.menu || []);
      setTables(data.tables || []);
      setOrderHistory(data.orders || []);
      setNonTableOrders(data.sales || []); // Mapping sales to non-table active view for viewer
      setLoading(false);
    } catch (err) {
      console.log("Cloud fetch failed", err);
    }
  }


  const handleSelectTable = (table) => {
    setSelectedTable({
      ...table,
      id: table.id !== undefined ? table.id : table.tableId,
      orders: table.orders || table.items || [],
      type: table.type || 'Dine In'
    });
    setCart([]);
    setView('ordering');
  };

  const restoreFromCloud = async () => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Cloud data restoration disabled.");
    try {
      const res = await fetch(CLOUD_URL + "/sync", { signal: AbortSignal.timeout(6000) });
      const data = await res.json();

      const newMenu = data.menu || [];
      const newTables = data.tables || [];

      saveToLocal("pos_menu", newMenu);
      saveToLocal("pos_tables", newTables);

      setMenuItems(newMenu);
      setTables(newTables);

      alert("Restored from cloud successfully!");
    } catch {
      alert("Failed to restore from cloud.");
    }
  };

  const deleteAnyOrder = async (id) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Deleting orders disabled.");
    const sid = String(id || '').trim().toUpperCase();
    if (!sid) return;
    console.log("[deleteAnyOrder] Attempting to delete ID:", sid);

    const isFloorTable = !sid.startsWith('DEL-') && !sid.startsWith('TAK-') && !sid.startsWith('TA-') && !sid.startsWith('DL-');
    
    if (isFloorTable) {
      try {
        const res = await fetch(`${BASE_URL}/table/${id}/clear`, { method: 'POST' });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Server error ${res.status}`);
        }
      } catch (err) {
        console.error("Failed to clear table:", err);
        alert("Failed to clear table: " + err.message);
      }
    } else {
      setNonTableOrders(prev => {
        if (!Array.isArray(prev)) return [];
        const order = prev.find(o => String(o.id || '').trim().toUpperCase() === sid);
        const status = (order?.paymentStatus || order?.payment_status || '').toUpperCase();
        const isPaid = status === 'PAID';
        
        console.log("[deleteAnyOrder] Order lookup result:", order?.id, "Status:", status, "isPaid:", isPaid);
        
        if (isPaid) {
          alert("Cannot delete a PAID order. Use 'Cancel Order' instead.");
          return prev;
        }
        const updated = prev.filter(o => String(o.id || '').trim().toUpperCase() !== sid);
        saveToLocal('pos_nontable_orders', updated);
        return updated;
      });
    }
  };

  const handleCancelOrder = (id) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Canceling orders disabled.");
    const sid = String(id || '').trim().toUpperCase();
    console.log("[handleCancelOrder] Attempting to cancel ID:", sid);
    setNonTableOrders(prev => {
      if (!Array.isArray(prev)) return [];
      const orderToCancel = prev.find(o => String(o.id || '').trim().toUpperCase() === sid);
      if (orderToCancel) {
        const cancelledOrder = { ...orderToCancel, status: 'CANCELED', paymentStatus: 'CANCELLED', timestamp: Date.now() };
        setOrderHistory(h => {
          const newHistory = [cancelledOrder, ...h].slice(0, 1000);
          saveToLocal('pos_order_history', newHistory);
          return newHistory;
        });
      }
      const updated = prev.filter(o => String(o.id || '').trim().toUpperCase() !== sid);
      saveToLocal('pos_nontable_orders', updated);
      return updated;
    });
  };

  const clearTableFast = (id) => {
    deleteAnyOrder(id);
  };

  const handleCreateNonTableOrder = (type) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Order creation disabled.");
    
    const today = new Date().toDateString();
    let currentCounter = takeawayCounter;

    const prefix = type === 'Delivery' ? 'DL' : 'TA';
    const formattedCounter = String(currentCounter).padStart(3, '0');
    const id = `${prefix}-${formattedCounter}`;
    
    setTakeawayCounter(currentCounter + 1);
    saveToLocal('pos_ta_counter', currentCounter + 1);

    const newOrder = {
      id,
      name: `${type} ${formattedCounter}`,
      type,
      status: 'occupied',
      orders: [],
      items: [],
      createdAt: Date.now(),
      paymentStatus: 'PAID',
      paymentMethod: 'Cash'
    };
    setNonTableOrders(prev => [...prev, newOrder]);
    setSelectedTable(newOrder);
    setCart([]);
    setView('ordering');
  };

  const manualSyncCaptainOrders = async () => {
    try {
      const res = await fetch(BASE_URL + "/tables", { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        const safeData = Array.isArray(data) ? data : (data.tables || []);
        setTables(safeData.map(t => ({
          ...t,
          status: t.status,
          orders: t.items || t.orders || t.order_items || [],
          gst_enabled: Boolean(t.gst_enabled),
          gst_rate: t.gst_rate,
          service_charge_enabled: Boolean(t.service_charge_enabled),
          service_charge_rate: t.service_charge_rate
        })));
      }
    } catch(e) {}
  };

  const loadMenu = async () => {
    localStorage.removeItem('pos_menu'); // purge old state
    try {
      const res = await fetch(BASE_URL + "/menu", { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        // Backend might return flat array OR { success, menu: {Category: [items]} }
        if (Array.isArray(data)) {
          setMenuItems(data.map(i => ({ ...i, inStock: i.available ?? i.inStock ?? true })));
        } else if (data.menu) {
          // Flatten the grouped menu
          const flatMenu = Object.values(data.menu).flat();
          setMenuItems(flatMenu.map(i => ({ ...i, inStock: i.available ?? i.inStock ?? true })));
        }
      }
    } catch (err) { 
      console.error("Failed to load menu:", err);
    }
  };

  const loadTables = async () => {
    return fetch(BASE_URL + "/tables")
      .then(res => res.json())
      .then(data => {
        const raw = Array.isArray(data) ? data : [];
        const normalized = raw.map(t => ({
          ...t,
          name:   t.name || t.table_number || String(t.id),
          type:   t.type || t.zone || 'Main Floor',
          status: t.status,
          orders: t.items || t.orders || t.order_items || [],
          gst_enabled: Boolean(t.gst_enabled),
          gst_rate: t.gst_rate,
          service_charge_enabled: Boolean(t.service_charge_enabled),
          service_charge_rate: t.service_charge_rate
        }));
        setTables(normalized);
        
        // Sync floorPlanSections with backend zones to ensure visibility in FloorDesigner
        const backendZones = [...new Set(normalized.map(t => t.type))].filter(Boolean);
        setFloorPlanSections(prev => {
          const combined = [...new Set([...prev, ...backendZones])];
          if (JSON.stringify(combined) !== JSON.stringify(prev)) {
            saveToLocal('pos_floor_sections', combined);
            return combined;
          }
          return prev;
        });
      })
      .catch(err => {
        console.error("TABLE LOAD FAILED:", err);
        setTables([]);
      });
  };

  const loadTable = async (tableId) => {
    try {
      const res = await fetch(BASE_URL + "/table/" + tableId);
      const data = await res.json();
      setCart([]); 
      setSelectedTable(data.table || data);
    } catch (err) {
      console.error("Failed to load table:", err);
    }
  };

  const addItemToTable = async (item) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Adding items disabled.");
    if (!selectedTable) return;

    // Standardize item for backend
    const newItem = { name: item.name, price: item.price, quantity: 1, qty: 1 };
    
    try {
      const { updateOrderApi } = await import('./utils/apiClient');
      await updateOrderApi(selectedTable.id, { items: [newItem], status: 'OCCUPIED' });
      // UI will update via socket table_updated or order_updated
    } catch (err) { 
      console.error("Failed to add item:", err);
      alert("Failed to add item. Check connection.");
    }
  };

  const handleGlobalSearch = (val) => {
    setGlobalSearch(val);
    if (val.length > 0 && view !== 'orderhistory') {
      setView('orderhistory');
    }
  };

  const [showSidebar, setShowSidebar] = useState(true);
  const handleUpdateDeviceStatus = async (id, status) => {
    try {
      const { updateDeviceStatus } = await import('./utils/apiClient');
      const res = await updateDeviceStatus(id, status);
      if (res.success) {
        setDevices(prev => prev.map(d => d.id === id ? { ...d, status } : d));
      }
    } catch (err) {
      alert('Failed to update device status');
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm('Forget this device?')) return;
    try {
      const { deleteDevice } = await import('./utils/apiClient');
      const res = await deleteDevice(id);
      if (res.success) {
        setDevices(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      alert('Failed to delete device');
    }
  };


  const [orderHistory, setOrderHistory] = useState(() => {
    let history = loadFromLocal('pos_order_history') || [];
    let nontables = loadFromLocal('pos_nontable_orders') || [];
    const stuckCancelled = nontables.filter(o => String(o.status || '').toUpperCase() === 'CANCELED');
    if (stuckCancelled.length > 0) {
      history = [...stuckCancelled.map(o => ({ ...o, paymentStatus: 'CANCELLED', timestamp: o.timestamp || Date.now() })), ...history].slice(0, 1000);
      saveToLocal('pos_order_history', history);
    }
    return history;
  });

  const [nonTableOrders, setNonTableOrders] = useState(() => {
    let nontables = loadFromLocal('pos_nontable_orders') || [];
    const active = nontables.filter(o => String(o.status || '').toUpperCase() !== 'CANCELED');
    if (active.length !== nontables.length) {
      saveToLocal('pos_nontable_orders', active);
    }
    return active;
  });

  // --- DAILY RESET & MIGRATION LOGIC ---
  useEffect(() => {
    const today = new Date().toDateString();
    if (lastCounterDate !== today) {
      console.log("📅 Day change detected. Resetting counters and migrating orders...");
      
      // 1. Reset Takeaway Counter
      setTakeawayCounter(1);
      saveToLocal('pos_ta_counter', 1);
      
      // 2. Migrate Previous Day's Orders
      const toMove = [];
      const toKeep = [];
      
      nonTableOrders.forEach(order => {
        const orderDate = new Date(order.createdAt || Date.now()).toDateString();
        const isToday = orderDate === today;
        const isPaid = order.paymentStatus === 'PAID' || order.payment_status === 'PAID' || order.status === 'settled' || order.status === 'completed' || order.status === 'CANCELED';
        
        if (!isToday && isPaid) {
          toMove.push({ 
            ...order, 
            status: order.status === 'CANCELED' ? 'CANCELED' : 'COMPLETED',
            migratedAt: today 
          });
        } else {
          toKeep.push(order);
        }
      });
      
      if (toMove.length > 0) {
        setOrderHistory(prev => {
          const updatedHistory = [...toMove, ...prev].slice(0, 2000);
          saveToLocal('pos_order_history', updatedHistory);
          return updatedHistory;
        });
      }
      
      setNonTableOrders(toKeep);
      saveToLocal('pos_nontable_orders', toKeep);
      
      // 3. Update lastCounterDate
      setLastCounterDate(today);
      saveToLocal('pos_ta_date', today);
    }
  }, [lastCounterDate, nonTableOrders, orderHistory]);
  const [devices, setDevices] = useState([]);
  const [settings, setSettings] = useState(() => loadFromLocal('pos_settings', {
    resName: 'Tyde Cafe',
    accentColor: '#94161c',
    paperSize: '80mm',
    serviceChargeRate: 5,
    autoServiceCharge: true,
    gstEnabled: false,
    gstRate: 5,
    billHeader: 'TYDE CAFE',
    billFooter: 'Thank You!',
    resFont: 14,
    kotFontSize: 13,
    separateKotStations: false,
    printerStations: []
  }));

  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [floorPlanSections, setFloorPlanSections] = useState(() => loadFromLocal('pos_floor_sections', ['DINE IN', 'AC', 'TERRACE']));
  const [customers, setCustomers] = useState(() => loadFromLocal('pos_customers', {}));

  useEffect(() => { if (IS_LOCAL) saveToLocal('pos_settings', settings); }, [settings]);

  // --- VERSION & CONFIG FETCH ---
  const [appVersion, setAppVersion] = useState({ version: 'v1.0-stable', lastUpdated: '2026-04-19' });

  useEffect(() => {
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setAppVersion(data))
      .catch(err => console.warn('Failed to load version info:', err));
  }, []);

  useEffect(() => {
    if (IS_LOCAL) {
      fetch(BASE_URL + "/api/lan").then(r => r.json()).then(d => setLanUrl(d.url)).catch(() => {});
      loadTables();
      loadMenu();
      
      // Load Global Settings from Backend
      fetch(BASE_URL + "/api/config/pos_settings")
        .then(r => r.json())
        .then(data => {
          if (data && Object.keys(data).length > 0) {
            setSettings(prev => {
              const normalizedData = {
                ...data,
                gstEnabled: data.gstEnabled !== undefined ? (data.gstEnabled === 1 || data.gstEnabled === true) : prev.gstEnabled,
                autoServiceCharge: data.autoServiceCharge !== undefined ? (data.autoServiceCharge === 1 || data.autoServiceCharge === true) : prev.autoServiceCharge
              };
              // Prioritize existing local templates if they exist to prevent overwrite by stale backend
              const merged = { ...normalizedData, ...prev };
              saveToLocal('pos_settings', merged);
              settingsRef.current = merged;
              return merged;
            });
          }
        })
        .catch(err => console.log("Backend settings load failed (using local only)"));
    }
    if (!IS_LOCAL) {
      fetchCloudData();
      const interval = setInterval(fetchCloudData, 3000);
      return () => clearInterval(interval);
    }
  }, []);

  // Sync settings to backend on change
  useEffect(() => {
    if (IS_LOCAL && settings) {
      const timer = setTimeout(() => {
        fetch(BASE_URL + "/api/config/pos_settings", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        }).catch(err => console.warn("Failed to sync settings to backend"));
      }, 500); // Shorter debounce
      return () => clearTimeout(timer);
    }
  }, [settings]);

  useEffect(() => { /* menuItems are backend-only — no local persistence */ }, [menuItems]);
  useEffect(() => { /* categories are backend-only — no local persistence */ }, [categories]);
  useEffect(() => { /* tables are backend-only — no local persistence */ }, [tables]);
  useEffect(() => { /* products are backend-only — no local persistence */ }, [products]);
  useEffect(() => { /* productCategories are backend-only — no local persistence */ }, [productCategories]);
  useEffect(() => { if (IS_LOCAL) saveToLocal('pos_floor_sections', floorPlanSections); }, [floorPlanSections]);
  useEffect(() => { if (IS_LOCAL) saveToLocal('pos_customers', customers); }, [customers]);
  useEffect(() => { if (IS_LOCAL) saveToLocal('pos_order_history', orderHistory); }, [orderHistory]);
  useEffect(() => { if (IS_LOCAL) saveToLocal('pos_nontable_orders', nonTableOrders); }, [nonTableOrders]);


  const syncToBackend = async (isSilent = false) => {
    // REDUNDANT in backend-driven architecture
  };

  useEffect(() => {
    if (!IS_LOCAL) return;
    const timer = setTimeout(() => {
      syncToCloud(); // Fire to new cloud URL after data changes (menu, tables, orders)
    }, 5000);
    return () => clearTimeout(timer);
  }, [menuItems, nonTableOrders, categories]);

  // Periodic Cloud Sync every 30 seconds
  useEffect(() => {
    if (!IS_LOCAL) return;
    const cloudInterval = setInterval(() => {
      console.log("☁️ 30s Interval: Syncing to cloud...");
      syncToCloud();
    }, 30000);
    return () => clearInterval(cloudInterval);
  }, []);
  
  const loadCategories = async () => {
    localStorage.removeItem('pos_categories'); // purge old state
    try {
      const res = await fetch(BASE_URL + "/categories", { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
        }
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  useEffect(() => {
    // On start: load other data
    checkForUpdate();
    loadCategories();
    loadMenu();
  }, []);

  useEffect(() => {
    localStorage.removeItem('pos_tables');
    fetch(BASE_URL + "/tables")
      .then(res => res.json())
      .then(data => {
        const raw = Array.isArray(data) ? data : [];
        const normalized = raw.map(t => ({
          ...t,
          name:   t.name || t.table_number || String(t.id),
          type:   t.type || t.zone || 'Main Floor',
          status: t.status,
          orders: t.items || t.orders || t.order_items || [],
          gst_enabled: Boolean(t.gst_enabled),
          gst_rate: t.gst_rate,
          service_charge_enabled: Boolean(t.service_charge_enabled),
          service_charge_rate: t.service_charge_rate
        }));
        setTables(normalized);
      })
      .catch(() => setTables([]));
  }, []);

  const [newCaptainOrders, setNewCaptainOrders] = useState([]);
  const processedCaptainIds = useRef(new Set());
  const socketRef = useRef(null);
  const notificationSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const settingsRef = useRef(settings);
  const menuRef = useRef([...menuItems, ...products]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    menuRef.current = [...menuItems, ...products];
  }, [menuItems, products]);

  useEffect(() => {
    // Socket.io is fully optional — POS works 100% without it
    try {
      const API_BASE_SOCKET = BASE_URL;
      socketRef.current = io(API_BASE_SOCKET, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        timeout: 5000
      });

      socketRef.current.on('connect', () => {
        setSocketConnected(true);
      });

      socketRef.current.on('connect_error', () => {
        // Silently fail — backend is optional
        setSocketConnected(false);
      });

      socketRef.current.on('table_updated', (allTables) => {
        console.log("LIVE SYNC:", Array.isArray(allTables) ? allTables.length : 'NOT_ARRAY');
        const safeTables = Array.isArray(allTables) ? allTables : [];
        const normalized = safeTables.map(t => ({
          ...t,
          name:   t.name || t.table_number || String(t.id),
          type:   t.type || t.zone || 'Main Floor',
          status: t.status, // Use backend status directly ('running' | 'vacant')
          orders: t.items || t.orders || t.order_items || [],
          gst_enabled: Boolean(t.gst_enabled),
          gst_rate: t.gst_rate,
          service_charge_enabled: Boolean(t.service_charge_enabled),
          service_charge_rate: t.service_charge_rate
        }));
        setTables(normalized);
      });

        socketRef.current.on('order_updated', (payload) => {
        console.log("📢 Sync: Order Update Received", payload?.table_number || payload?.table_id);
        
        // --- Duplicate Prevention Guard ---
        const orderUid = payload.order_id || payload.id;
        if (orderUid && processedCaptainIds.current.has(orderUid)) {
          console.log("⏭️ Sync: Order already processed, skipping print", orderUid);
          return;
        }

        const matchFn = (t) => String(t.id) === String(payload.id) || String(t.id) === String(payload.table_id) || String(t.table_number) === String(payload.table_number);

        // Use backend status directly
        setTables(prev => prev.map(t => {
          if (matchFn(t)) {
            return { 
              ...t, 
              status: payload.status, 
              orders: payload.items || [], 
              last_updated: payload.startedAt,
              gst_enabled: Boolean(payload.gst_enabled),
              gst_rate: payload.gst_rate,
              service_charge_enabled: Boolean(payload.service_charge_enabled),
              service_charge_rate: payload.service_charge_rate
            };
          }
          return t;
        }));

        setSelectedTable(prev => {
          if (prev && matchFn(prev)) {
            return { 
              ...prev, 
              status: payload.status, 
              orders: payload.items || [], 
              last_updated: payload.startedAt,
              gst_enabled: Boolean(payload.gst_enabled),
              gst_rate: payload.gst_rate,
              service_charge_enabled: Boolean(payload.service_charge_enabled),
              service_charge_rate: payload.service_charge_rate
            };
          }
          return prev;
        });

        if (payload.is_new_kot && payload.new_items && payload.new_items.length > 0) {
          // Mark as processed immediately to prevent double print
          if (orderUid) processedCaptainIds.current.add(orderUid);
          
          console.log("🖨️ Auto-printing incoming KOT for Table", payload.table_number);
          setNewCaptainOrders(prev => [{
            id: payload.order_id || payload.id || Date.now(),
            table_number: payload.table_number,
            items: payload.new_items,
            timestamp: new Date().toISOString(),
            status: 'NEW'
          }, ...prev]);

          printPosToSerial({
            orderId: payload.table_id || payload.id,
            tableName: `Table ${payload.table_number || payload.table_id || payload.id}`,
            items: payload.new_items.map(i => {
              const name = String(i.name || '').trim().toLowerCase();
              const info = menuRef.current.find(m => 
                String(m.name || '').trim().toLowerCase() === name || 
                String(m.id) === String(i.id || i.item_id)
              );
              return { 
                ...i, 
                qty: i.quantity || i.qty || 1,
                category: i.category || info?.category || 'General'
              };
            }),
            orderType: 'Dine In'
          }, 'KOT', settingsRef.current);
        }
      });

      socketRef.current.on('menu_updated', (menuPayload) => {
        console.log("MENU SYNC:", menuPayload);
        if (menuPayload && menuPayload.categories) {
          setCategories(menuPayload.categories);
        }
        if (menuPayload && menuPayload.menu) {
          const flatMenu = Array.isArray(menuPayload.menu) ? menuPayload.menu : Object.values(menuPayload.menu).flat();
          setMenuItems(flatMenu.map(i => ({ ...i, inStock: i.available ?? i.inStock ?? true })));
        } else if (Array.isArray(menuPayload)) {
           setMenuItems(menuPayload.map(i => ({ ...i, inStock: i.available ?? i.inStock ?? true })));
        }
      });

      return () => {
        if (socketRef.current) socketRef.current.disconnect();
      };
    } catch (err) {
      console.warn("⚠️ Socket.io unavailable (offline mode):", err);
    }
  }, []);

  const settleTable = async (tableId, orderDetails) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Settling tables disabled.");
    
    try {
      const { settleTableApi } = await import('./utils/apiClient');
      await settleTableApi(tableId, orderDetails.paymentMethod || 'Cash', orderDetails);
      
      // Update local history for records
      const history = loadFromLocal('pos_order_history');
      const newHistory = [{ ...orderDetails, timestamp: Date.now() }, ...history].slice(0, 1000);
      setOrderHistory(newHistory);
      saveToLocal('pos_order_history', newHistory);
    } catch (err) { 
      console.error("Settlement Failed:", err);
      alert("Failed to settle bill. Check connection.");
    }
  };

  const saveOrderToTable = async (tableId, orderItems, newStatus, extraData = {}) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Saving orders disabled.");
    const tid = String(tableId || '').trim().toUpperCase();
    if (!tid) return;

    if (orderItems.length === 0) {
      deleteAnyOrder(tid);
      return;
    }

    if (tid.startsWith('DL-') || tid.startsWith('TA-') || tid.startsWith('DEL-') || tid.startsWith('TAK-')) {
      // Local management for non-table orders (still kept for offline resilience)
      setNonTableOrders(prev => {
        const updated = prev.map(o => {
             if (String(o.id).trim().toUpperCase() === tid) {
               return { ...o, orders: orderItems, items: orderItems, status: newStatus, customerName: extraData.customerName, phone: extraData.customerPhone, note: extraData.note, paymentStatus: extraData.paymentStatus, paymentMethod: extraData.paymentMethod };
             }
             return o;
        });
        saveToLocal('pos_nontable_orders', updated);
        return updated;
      });
      setView('nontables');
    } else {
      // 1. UPDATE LOCALLY FIRST (Optimistic UI)
      setTables(prev => prev.map(t => {
        if (String(t.id).toUpperCase() === tid || String(t.table_number).toUpperCase() === tid) {
          return { 
            ...t, 
            status: newStatus || 'occupied', 
            orders: orderItems,
            gst_enabled: extraData.gst_enabled,
            gst_rate: extraData.gst_rate,
            service_charge_enabled: extraData.service_charge_enabled,
            service_charge_rate: extraData.service_charge_rate
          };
        }
        return t;
      }));
      setView('tables');
    }

    setSelectedTable(null);

    try {
      const { createOrder, updateOrderApi } = await import('./utils/apiClient');
      if (newStatus === 'kot') {
        await createOrder({
          table_number: tid,
          items: orderItems.map(i => ({ name: i.name, quantity: i.qty, price: i.price, notes: i.note || '' })),
          notes: extraData.note || '',
          gst_enabled: extraData.gst_enabled,
          gst_rate: extraData.gst_rate,
          service_charge_enabled: extraData.service_charge_enabled,
          service_charge_rate: extraData.service_charge_rate
        });
      } else {
        const isFloorTable = !tid.startsWith('DL-') && !tid.startsWith('TA-') && !tid.startsWith('DEL-') && !tid.startsWith('TAK-');
        if (isFloorTable) {
           // Normalize status for backend (it expects uppercase)
           const backendStatus = String(newStatus || 'occupied').toUpperCase();
           await updateOrderApi(tableId, { 
             items: orderItems, 
             status: backendStatus,
             gst_enabled: extraData.gst_enabled,
             gst_rate: extraData.gst_rate,
             service_charge_enabled: extraData.service_charge_enabled,
             service_charge_rate: extraData.service_charge_rate,
             note: extraData.note
           });
        }
      }
    } catch (syncErr) {
      console.warn("⚠️ saveOrderToTable Backend Sync Failed:", syncErr);
    }
  };


  const handleClearHistory = () => {
    if (window.confirm("CRITICAL: Wipe ALL historical sales data? This will reset all analytics and history. Type 'clear' to confirm.")) {
       const confirm = window.prompt("Type 'clear' below:");
       if (confirm === "clear") {
          setOrderHistory([]);
          alert("Order History Wiped.");
       }
    }
  };

  const handleFullReset = async () => {
    if (window.confirm("FACTORY RESET: This will delete orders, menu items, settings, and floor plans. You will lose everything.")) {
       const confirm = window.prompt("Type 'RESET' to wipe entire system:");
       if (confirm === "RESET") {
          try {
             await clear(); // idb-keyval.clear() wipes the entire database
             localStorage.clear();
             window.location.reload();
          } catch(err) {
             alert("Error resetting. Please clear browser storage manually.");
          }
       }
    }
  };

  const markOrderReady = (order) => {
    saveOrderToTable(order.id, order.orders, 'printed')
    alert(`Order for ${order.name} marked as ready! Front-stage notified.`);
    setView('kds')
  };

  const handleQuickPrint = (table) => {
    setQuickPrintTable(table);
  };

  const handleQuickSettleResult = (tableId, orderDetails) => {
    settleTable(tableId, orderDetails);
    setQuickSettleTable(null);
  };

  // Stats calculation for badges
  const stats = {
    liveOrders: nonTableOrders.length,
    activeTables: tables.filter(t => t.orders && t.orders.length > 0).length,
    activeOnline: nonTableOrders.length,
    pendingKot: tables.filter(t => t.orders && t.orders.length > 0).length + nonTableOrders.length
  };

  // ── Approval Wall ──────────────────────────────────────────
  if (deviceStatus === 'PENDING' || deviceStatus === 'BLOCKED') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '40px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: deviceStatus === 'PENDING' ? '#fef3c7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          {deviceStatus === 'PENDING' ? <Clock size={40} color="#d97706" /> : <X size={40} color="#dc2626" />}
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '950', color: '#111827', marginBottom: '12px' }}>
          {deviceStatus === 'PENDING' ? 'Registration Pending' : 'Access Restricted'}
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '400px', lineHeight: '1.6', marginBottom: '32px' }}>
          {deviceStatus === 'PENDING' 
            ? `Your device (ID: ${deviceId}) is waiting for administrator approval. Please ask the manager to approve this terminal in Settings > Linked Devices.`
            : 'This device has been blocked from accessing the system. Please contact your administrator.'}
        </p>
        {deviceStatus === 'PENDING' && (
          <div style={{ padding: '12px 24px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', color: '#94a3b8', fontStyle: 'italic' }}>
            Device ID: <span style={{ color: '#111827', fontWeight: 'bold' }}>{deviceId}</span>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <RefreshCw size={48} className="animate-spin" style={{ marginBottom: '20px', color: 'var(--primary)' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '900' }}>Initializing Live Dashboard...</h2>
        <p style={{ color: '#94a3b8', marginTop: '10px' }}>Connecting to cloud backend...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8fafc', overflow: 'hidden' }}>
      <GlobalStyles settings={settings} />

      {/* Quick Settlement Modals */}
      {quickSettleTable && (
        <QuickSettleModal 
          table={quickSettleTable} 
          settings={settings} 
          onClose={() => setQuickSettleTable(null)} 
          onSettle={(method, amt, change) => {
            const cartItems = quickSettleTable.orders || quickSettleTable.items || [];
            const subtotal = cartItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
            const service = settings?.autoServiceCharge ? Math.floor(subtotal * (settings.serviceChargeRate || 5) / 100) : 0;
            const gt = subtotal + service;
            handleQuickSettleResult(quickSettleTable.id, { 
              paymentMethod: method, 
              amountReceived: amt, 
              changeDue: change,
              grandTotal: gt,
              cart: cartItems
            });
          }} 
        />
      )}
      {quickPrintTable && (
        <QuickPrintModal 
          table={quickPrintTable} 
          settings={settings} 
          onClose={() => setQuickPrintTable(null)} 
          onPrint={(discountAmt, service, gstAmount, grandTotal) => {
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const seqKey = `bill_seq_${today}`;
            let seq = parseInt(localStorage.getItem(seqKey) || '0', 10);
            seq += 1;
            localStorage.setItem(seqKey, seq.toString());
            const billNo = seq.toString().padStart(4, '0');

            printPosToSerial({ 
              ...quickPrintTable, 
              items: quickPrintTable.orders, 
              tableName: quickPrintTable.name,
              subtotal: getOrderTotal(quickPrintTable.orders),
              discountAmt,
              serviceCharge: service,
              gstAmount: gstAmount,
              grandTotal,
              roundOff: (grandTotal - (getOrderTotal(quickPrintTable.orders) - discountAmt + service + gstAmount)).toFixed(2),
              billNumber: billNo,
              cashier: settings.cashierName || 'Biller'
            }, 'BILL', settings);
            setQuickPrintTable(null);
          }} 
        />
      )}

      {/* Confirmation Modal - Correctly Positioned at Root Level for Perfect Centering */}
      {tableToClear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
          <div className="animate-fade-in" style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '380px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
             <div style={{ background: '#fee2e2', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Trash2 size={32} color="#dc2626" />
             </div>
            <h3 style={{ fontSize: '24px', fontWeight: '950', marginBottom: '12px', color: '#111827', letterSpacing: '-0.5px' }}>Clear Table?</h3>
            <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '32px', lineHeight: '1.6', fontWeight: '500' }}>This will immediately remove all items from this table and restore it to vacant status. This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setTableToClear(null)}
                style={{ flex: 1, padding: '14px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '16px', fontWeight: '900', cursor: 'pointer', fontSize: '14px' }}
              >
                Go Back
              </button>
              <button
                onClick={() => { clearTableFast(tableToClear); setTableToClear(null); }}
                style={{ flex: 1, padding: '14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer', fontSize: '14px' }}
              >
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {showSidebar && (
        <AppSidebar
          activeView={view}
          onViewChange={setView}
          stats={stats}
          isConnected={socketConnected}
          isSyncing={isSyncing}
          onManualSync={handleManualSync}
          lanUrl={lanUrl}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Main Header */}
        <div style={{ background: 'var(--primary)', height: '4px' }}></div>
        <header style={{ background: 'white', padding: '0 16px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', gap: '12px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', flexShrink: 0 }}>
              <Store size={22} />
              <h1 style={{ fontSize: '17px', fontWeight: '900', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>{settings.resName}</h1>
            </div>
            <button onClick={() => setShowSidebar(!showSidebar)} style={{ padding: '7px', borderRadius: 'var(--radius-md)', background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
              <Menu size={18} />
            </button>
            <h1 style={{ fontSize: '16px', fontWeight: '950', color: '#1e293b', letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {view === 'tables' && 'Floor Plan'}
              {view === 'nontables' && 'Pickup / Online'}
              {view === 'analytics' && 'Intelligence'}
              {view === 'ordering' && `Table ${selectedTable?.name}`}
              {view === 'kds' && 'Kitchen (KDS)'}
              {view === 'captain' && 'Captain Orders'}
              {view === 'globalsettings' && 'Settings'}
              {view === 'dayclose' && 'End of Day'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* SYNC BUTTON */}
            {IS_LOCAL && (
              <button 
                onClick={syncToBackend} 
                disabled={isSyncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 18px', borderRadius: '14px', border: 'none',
                  background: isSyncing ? '#f1f5f9' : '#a3112a',
                  color: isSyncing ? '#94a3b8' : 'white',
                  fontSize: '13px', fontWeight: '950', cursor: isSyncing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', boxShadow: isSyncing ? 'none' : '0 4px 12px rgba(163, 17, 42, 0.2)'
                }}
              >
                {isSyncing ? (
                  <>Syncing...</>
                ) : (
                  <><RefreshCw size={16} /> Sync to Cloud</>
                )}
              </button>
            )}

            {/* Connection Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: socketConnected ? '#ecfdf5' : '#fef2f2', padding: '8px 14px', borderRadius: '12px', border: '1px solid', borderColor: socketConnected ? '#10b981' : '#ef4444', transition: 'all 0.3s' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: socketConnected ? '#10b981' : '#ef4444', boxShadow: `0 0 10px ${socketConnected ? '#10b981' : '#ef4444'}` }}></div>
              <span style={{ fontSize: '11px', fontWeight: '900', color: socketConnected ? '#065f46' : '#991b1b', textTransform: 'uppercase' }}>
                {socketConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '14px', padding: '4px 12px', alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => handleGlobalSearch(e.target.value)}
                placeholder="Search..."
                style={{ background: 'none', border: 'none', padding: '8px', outline: 'none', fontSize: '13px', fontWeight: '600', width: '140px' }}
              />
            </div>

            {/* GLOBAL NAVIGATION PILLS */}
            <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '5px', borderRadius: '14px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', flexShrink: 0 }}>
              <button onClick={() => setView('tables')} style={{ padding: '8px 16px', borderRadius: '10px', background: view === 'tables' ? 'var(--primary)' : 'transparent', color: view === 'tables' ? 'white' : '#64748b', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', whiteSpace: 'nowrap', boxShadow: view === 'tables' ? '0 4px 12px rgba(148,22,28,0.2)' : 'none' }}>
                Tables
              </button>
              <button onClick={() => setView('nontables')} style={{ padding: '8px 16px', borderRadius: '10px', background: view === 'nontables' ? 'var(--primary)' : 'transparent', color: view === 'nontables' ? 'white' : '#64748b', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', whiteSpace: 'nowrap', boxShadow: view === 'nontables' ? '0 4px 12px rgba(148,22,28,0.2)' : 'none' }}>
                Pickup
              </button>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          {view === 'tables' && (
            <ServiceFloor
              tables={tables}
              floorPlanSections={floorPlanSections}
              onSelectTable={handleSelectTable}
              onClearTable={clearTableFast}
              settings={settings}
              onQuickSettle={setQuickSettleTable}
              onQuickPrint={handleQuickPrint}
              globalSearch={globalSearch}
              onViewChange={setView}
              onOpenFloorDesigner={() => setView('floorplan')}
              tableToClear={tableToClear}
              setTableToClear={setTableToClear}
            />
          )}
          {view === 'nontables' && (
            <NonTableManagement orders={nonTableOrders} onSelectOrder={handleSelectTable} onCreateOrder={handleCreateNonTableOrder} onViewChange={setView} onQuickSettle={setQuickSettleTable} onQuickPrint={handleQuickPrint} onClearOrder={clearTableFast} onCancelOrder={handleCancelOrder} globalSearch={globalSearch} />
          )}
          {view === 'analytics' && (
            <ReportsHub orderHistory={orderHistory} menuItems={menuItems} tables={tables} nonTableOrders={nonTableOrders} products={products} />
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
            <KitchenDisplay 
              orders={[
                ...newCaptainOrders,
                ...tables
                  .filter(t => t.status !== 'free' && t.orders?.length > 0)
                  .map(t => ({
                    id: `table-${t.id}`,
                    table_number: t.name.replace('Table ', ''),
                    status: t.status === 'printed' ? 'READY' : 'PREPARING',
                    items: t.orders.map(o => ({
                      name: o.name,
                      quantity: o.qty,
                      notes: o.note || ''
                    }))
                  }))
              ]} 
              onUpdateStatus={async (id, status) => {
                const { updateOrderStatusPatch } = await import('./utils/apiClient');
                await updateOrderStatusPatch(id, status);
                // The socket listener will update the UI state automatically
              }} 
            />
          )}
          {view === 'captain' && (
            <CaptainOrders
              newOrders={newCaptainOrders}
              setNewOrders={setNewCaptainOrders}
              onManualSync={manualSyncCaptainOrders}
              settings={settings}
              isOnline={socketConnected}
              backendUrl={lanUrl || BASE_URL}
              menuItems={[...menuItems, ...products]}
              onInjectOrder={(apiOrder) => {
                // Map the API order into the POS table system
                const tableNum = String(apiOrder.table_number);
                const matchingTable = tables.find(t => t.name === `Table ${tableNum}` || String(t.id) === tableNum);
                if (matchingTable) {
                  const mappedItems = apiOrder.items.map(item => ({
                    id: Date.now() + Math.random(),
                    name: item.name,
                    qty: item.quantity,
                    price: item.price,
                    note: apiOrder.notes || ''
                  }));
                  setTables(prev => prev.map(t => {
                    if (t.id === matchingTable.id) {
                      return {
                        ...t,
                        order: [...(t.orders || []), ...mappedItems],
                        status: 'occupied',
                        createdAt: t.createdAt || Date.now()
                      };
                    }
                    return t;
                  }));
                }
              }}
            />
          )}
          {view === 'orderhistory' && (
            <OrderHistoryView orderHistory={orderHistory} activePickups={nonTableOrders} onSelectActive={handleSelectTable} globalSearch={globalSearch} tables={tables} />
          )}
          {view === 'globalsettings' && (
            <GlobalSettingsView 
              settings={settings} 
              onSaveSettings={setSettings} 
              onClearHistory={handleClearHistory}
              onFullReset={handleFullReset}
              devices={devices}
              onUpdateDeviceStatus={handleUpdateDeviceStatus}
              onDeleteDevice={handleDeleteDevice}
              isConnected={socketConnected}
              onRestoreData={restoreFromCloud}
              appVersion={appVersion}
              categories={categories}
            />
          )}
          {view === 'printersettings' && (
            <PrinterSettingsView settings={settings} onSaveSettings={setSettings} categories={categories} />
          )}
          {view === 'menusetup' && (
            <MenuSetupView
              categories={categories} setCategories={setCategories}
              menuItems={menuItems} setMenuItems={setMenuItems}
              loadCategories={loadCategories}
              loadMenu={loadMenu}
            />
          )}
          {view === 'productsetup' && (
            <RetailProductSetupView
              categories={productCategories} setCategories={setProductCategories}
              menuItems={products} setMenuItems={setProducts}
            />
          )}
          {view === 'floorplan' && (
            <FloorDesigner
              tables={tables}
              setTables={setTables}
              sections={floorPlanSections}
              setSections={setFloorPlanSections}
              loadTables={loadTables}
            />
          )}
          {view === 'ordering' && (
            <OrderingSystem
              table={selectedTable}
              tables={tables}
              nonTableOrders={nonTableOrders}
              initialOrder={selectedTable?.orders || []}
              MENU_ITEMS={[...menuItems, ...products]}
              CATEGORIES={Array.from(new Set([...categories, ...productCategories]))}
              settings={settings}
              customers={customers}
              onChangeTable={(oldId, newId, currentCart) => {
                if (selectedTable && oldId !== newId) {
                  const targetTable = tables.find(t => t.id === newId);
                  if (targetTable) {
                    setTables(prev => prev.map(t => {
                      if (t.id === newId) return { ...t, orders: currentCart, status: 'kot_pending', createdAt: t.createdAt || Date.now() };
                      if (t.id === oldId && (String(selectedTable.id).startsWith('DEL-') || String(selectedTable.id).startsWith('TAK-') || String(selectedTable.id).startsWith('TA-') || String(selectedTable.id).startsWith('DL-'))) {
                        return { ...t, orders: [], status: 'vacant', createdAt: null };
                      }
                      if (t.id === oldId) return { ...t, orders: [], status: 'vacant', createdAt: null };
                      return t;
                    }));
                    setSelectedTable({ ...targetTable, orders: currentCart, items: currentCart, status: 'kot_pending' });
                  }
                }
              }}
              onBack={(currentCart) => {
                if (selectedTable && (String(selectedTable.id).startsWith('DEL-') || String(selectedTable.id).startsWith('TAK-') || String(selectedTable.id).startsWith('TA-') || String(selectedTable.id).startsWith('DL-'))) {
                  // AUTO-DELETE IF EMPTY (only if currentCart is also empty)
                  const items = currentCart || [];
                  if (items.length === 0 && selectedTable.status !== 'CANCELED') {
                    deleteAnyOrder(selectedTable.id);
                  }
                  setView('nontables');
                } else {
                  setView('tables');
                }
                setSelectedTable(null);
              }}
              onSaveOrder={saveOrderToTable}
              onCancelOrder={handleCancelOrder}
              onAddItem={addItemToTable}
              onSettleTable={settleTable}
              loadTables={loadTables}
            />
          )}
        </main>
      </div>
    </div>
  );
}





class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("POS Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', background: '#fff1f2', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={48} color="#e11d48" style={{ marginBottom: '16px' }} />
          <h1 style={{ color: '#9f1239' }}>System Encountered an Error</h1>
          <p style={{ color: '#be123c', maxWidth: '500px' }}>{this.state.error?.toString()}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Reload POS System
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() { return <ErrorBoundary><MainApp /></ErrorBoundary>; }
