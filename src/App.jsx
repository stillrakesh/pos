import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { 
  Menu, Search, Store, Monitor, LayoutGrid, Clock, Bell, User, Users, Wifi,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Info, CreditCard, Banknote, Printer, Eye, Plus,
  Minus, X, Utensils, Smartphone, BarChart3, TrendingUp, PieChart, AlertTriangle, Truck, ShoppingBag, ChefHat, MessageSquare, CheckSquare, Sunset, Trash2, Package, XCircle,
  Settings2, ReceiptText, RefreshCw, RotateCcw, Percent, CheckCircle, Lock, Shield, Maximize2, Move, ArrowRightLeft, Zap, Cloud
} from 'lucide-react';
import './index.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
import * as XLSX from 'xlsx';
import { get as idbGet } from 'idb-keyval';
import { BASE_URL } from './constants';
import { printPosToSerial } from './utils/printerUtils';
import { QuickPrintModal, QuickSettleModal } from './components/billing/SettlementModals';
import DayCloseWizard from './components/billing/DayCloseWizard';
import BillDesigner from './components/settings/BillDesigner';
import PrinterSetup from './components/settings/PrinterSetup';
import ReportsHub from './components/dashboard/ReportsHub';
import InventoryManager from './components/settings/InventoryManager';
import FloorDesigner from './components/FloorDesigner';
import CaptainOrders from './components/billing/CaptainOrders';
import { formatCurrency, getOrderTotal } from './utils/formatters';
import * as orderService from './services/orderService';
import { apiService } from './services/apiService';
import logger from './services/loggerService';
import SystemDiagnosticsModal from './components/settings/SystemDiagnosticsModal';
import LanConnectModal from './components/settings/LanConnectModal';

// --- Grand Total Calculation Helper (matches backend normalization) ---
const calculateGrandTotal = (items, tableSettings) => {
  // FORCE OVERRIDE FOR TESTING
  if (tableSettings) {
    tableSettings.captainProEnabled = true;
  }
  const subtotal = getOrderTotal(items);
  
  // Discount Calculation
  const discountAmount = Number(tableSettings.discount_amount || 0);
  const discountRate = Number(tableSettings.discount_rate || 0);
  const finalDiscount = discountAmount > 0 ? discountAmount : Math.floor(subtotal * discountRate / 100);

  const scEnabled = Boolean(tableSettings.service_charge_enabled);
  const scRate = Number(tableSettings.service_charge_rate || 5);
  const scAmount = scEnabled ? Math.floor((subtotal - finalDiscount) * scRate / 100) : 0;
  
  const taxable = subtotal - finalDiscount + scAmount;
  const gstEnabled = Boolean(tableSettings.gst_enabled);
  const gstRate = Number(tableSettings.gst_rate || 5);
  const gstAmount = gstEnabled ? Math.floor(taxable * gstRate / 100) : 0;
  
  return Math.ceil(taxable + gstAmount);
};

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
    await apiService.syncToCloud({
      menu,
      tables,
      orders,
      sales: []
    });
  } catch (err) {
    console.log("Sync failed (offline mode)");
  }
}

// Modular Components & Utilities

// --- INITIAL MOCK DATA ---
const MENU_VERSION = '2';

const GlobalStyles = ({ settings }) => {
  const primaryColor = settings?.accentColor || '#94161c';
  const secondaryColor = settings?.secondaryColor || '#7c3aed';
  const bgColor = settings?.bgColor || '#f8fafc';
  const textColor = settings?.textColor || '#1e293b';
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
        :root { --sidebar-width: 180px; }
      }
      @media (max-width: 1024px) {
        :root { --sidebar-width: 160px; }
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
  const tid = String(order.table_number || order.tableNumber || order.tableId || order.id || '').toUpperCase();
  if (order.type === 'Delivery' || tid.startsWith('DEL-') || tid.startsWith('DL-')) return 'Delivery';
  if (order.type === 'Takeaway' || tid.startsWith('TAK-') || tid.startsWith('TA-')) return 'Takeaway';
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
        { id: 'pro_control', label: 'Captain Pro Mode', icon: Zap, hidden: !IS_LOCAL },
        { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, hidden: !IS_LOCAL },
      ].filter(item => !item.hidden)
    },
    {
      title: 'Management',
      hidden: !IS_LOCAL,
      items: [
        { id: 'menusetup', label: 'Menu', icon: Menu },
        { id: 'inventory', label: 'Inventory & Recipes', icon: Package, badge: stats.lowStock > 0 ? stats.lowStock : null },
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
        <div style={{ background: 'linear-gradient(135deg, #94161c 0%, #f97316 100%)', color: 'white', padding: 'clamp(6px, 0.8vw, 10px)', borderRadius: '12px', boxShadow: '0 10px 20px rgba(163, 17, 42, 0.2)' }}>
          <Store size={18} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: '600', fontSize: 'clamp(14px, 1.2vw, 18px)', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>TYDE POS</div>
          <div style={{ fontSize: 'clamp(9px, 0.75vw, 11px)', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.2px', whiteSpace: 'nowrap' }}>Management Console</div>
        </div>
      </div>

      <div style={{ margin: '0 18px 18px', padding: '16px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(163, 17, 42, 0.32), rgba(249, 115, 22, 0.18))', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#fecaca', textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: '12px' }}>Shift Snapshot</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '500' }}>{stats.liveOrders}</div>
            <div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: '500' }}>Live Orders</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: '500' }}>{formatCurrency(stats.liveRevenue)}</div>
            <div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: '500' }}>Open Value</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px' }}>
        {menuGroups.map((group, idx) => (
          <div key={idx} style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.3px', marginBottom: '12px', paddingLeft: '12px' }}>{group.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '16px',
                    border: activeView === item.id ? '1px solid rgba(249, 115, 22, 0.28)' : '1px solid transparent',
                    background: activeView === item.id ? 'linear-gradient(135deg, rgba(163, 17, 42, 0.26), rgba(249, 115, 22, 0.12))' : 'transparent',
                    color: activeView === item.id ? '#fff7ed' : '#cbd5e1',
                    cursor: 'pointer', transition: 'all 0.2s', fontWeight: activeView === item.id ? '900' : '700', fontSize: '13px', textAlign: 'left', width: '100%'
                  }}
                >
                  <item.icon size={18} style={{ opacity: activeView === item.id ? 1 : 0.75 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge ? (
                    <span style={{ minWidth: '26px', padding: '3px 8px', borderRadius: '999px', background: activeView === item.id ? 'rgba(255,255,255,0.18)' : 'rgba(148,163,184,0.18)', color: 'inherit', fontSize: '11px', fontWeight: '600' }}>
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
          <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
             <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wifi size={10} color="#10b981" /> Captain LAN Mode
             </div>
             <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: '600', wordBreak: 'break-all', fontFamily: 'monospace' }}>{lanUrl}</div>
             <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Open this URL on any mobile device on the same WiFi.</div>
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
            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
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
      fontSize: '11px', 
      fontWeight: '600', 
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
      <button onClick={onToggleSidebar} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '10px', color: '#1e293b', borderRadius: '10px' }}><Menu size={20} /></button>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '700', fontSize: '20px', color: '#0f172a', letterSpacing: '-0.5px' }}>TYDE POS</span>
        </div>
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
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
          style={{ border: '1px solid #e2e8f0', color: '#1e293b', background: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <LayoutGrid size={16} /> TABLES
        </button>
        <button 
          onClick={() => onViewChange('nontables')} 
          style={{ border: 'none', background: '#0f172a', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <ShoppingBag size={16} /> PICKUPS
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
        <div onClick={() => onViewChange('dayclose')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
          <Sunset size={18} color="#64748b" />
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Day End</span>
        </div>
        <div onClick={() => onViewChange('kds')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
          <ChefHat size={18} color="#64748b" />
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Queue</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#94161c' }}>Live</div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{stats.pendingKot} KOT</div>
        </div>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#1e293b', display: 'grid', placeItems: 'center' }}>
          <User size={20} color="white" />
        </div>
      </div>
    </div>
  </div>
);

/* --- ORDER HISTORY VIEW --- */
const OrderHistoryView = ({ orderHistory, onSelectActive, globalSearch, loadHistory, setOrderHistory, settings }) => {
  const [activeTab, setActiveTab] = useState('completed'); // 'completed', 'cancelled', 'all'
  const [localSearch, setLocalSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // 'today', 'yesterday', 'thisWeek', 'thisMonth', 'custom'
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all', 'Cash', 'UPI', 'Card', 'Split'
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'amount-desc', 'amount-asc'
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState('');

  const searchVal = globalSearch || localSearch;

  const isInDateRange = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    
    // Normalize date to midnight for accurate comparisons
    const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (dateFilter === 'today') {
      return dDate.getTime() === dToday.getTime();
    }
    if (dateFilter === 'yesterday') {
      const yesterday = new Date(dToday);
      yesterday.setDate(yesterday.getDate() - 1);
      return dDate.getTime() === yesterday.getTime();
    }
    if (dateFilter === 'thisWeek') {
      const oneWeekAgo = new Date(dToday);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return dDate.getTime() >= oneWeekAgo.getTime() && dDate.getTime() <= dToday.getTime();
    }
    if (dateFilter === 'thisMonth') {
      return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    }
    if (dateFilter === 'custom') {
      if (!customStartDate || !customEndDate) return true;
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const dStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const dEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      return dDate.getTime() >= dStart.getTime() && dDate.getTime() <= dEnd.getTime();
    }
    return true;
  };

  // 1. Filter order history
  const filteredOrders = useMemo(() => {
    return orderHistory
      .filter(o => {
        // Tab Status Filter
        if (activeTab !== 'all' && o.status !== activeTab) return false;

        // Exclude orders with 0 grandTotal or empty cart (ghost/deleted orders)
        if (Number(o.grandTotal || 0) <= 0 || !o.cart || o.cart.length === 0) return false;

        // Date Range Filter
        if (!isInDateRange(o.timestamp)) return false;

        // Payment Method Filter
        if (paymentFilter.toLowerCase() !== 'all') {
          const pm = String(o.paymentMethod || '').toUpperCase();
          const target = paymentFilter.toUpperCase();
          if (target === 'SPLIT' && (pm.includes('SPLIT') || pm.includes('+'))) {
            // matches split
          } else if (pm !== target) {
            return false;
          }
        }

        // Search Filter
        if (searchVal) {
          const s = searchVal.toLowerCase();
          const items = o.cart || [];
          const matchesSearch = 
            String(o.id).toLowerCase().includes(s) ||
            String(o.bill_number || '').toLowerCase().includes(s) ||
            String(o.customerName || '').toLowerCase().includes(s) ||
            String(o.phone || '').includes(s) ||
            String(o.table_number || '').toLowerCase().includes(s) ||
            items.some(item => (item.name || '').toLowerCase().includes(s));
          if (!matchesSearch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        const amtA = Number(a.grandTotal || 0);
        const amtB = Number(b.grandTotal || 0);

        if (sortBy === 'date-desc') return timeB - timeA;
        if (sortBy === 'date-asc') return timeA - timeB;
        if (sortBy === 'amount-desc') return amtB - amtA;
        if (sortBy === 'amount-asc') return amtA - amtB;
        return timeB - timeA;
      });
  }, [orderHistory, activeTab, dateFilter, customStartDate, customEndDate, paymentFilter, sortBy, searchVal]);

  // 2. Aggregate stats based on current filteredOrders
  const stats = useMemo(() => {
    const completed = filteredOrders.filter(o => o.status === 'completed');
    const cancelled = filteredOrders.filter(o => o.status === 'cancelled');
    const revenue = completed.reduce((acc, o) => acc + Number(o.grandTotal || 0), 0);
    const avgTicket = completed.length > 0 ? Math.round(revenue / completed.length) : 0;

    // Payment split
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let splitTotal = 0;

    completed.forEach(o => {
      const pm = String(o.paymentMethod || '').toUpperCase();
      const total = Number(o.grandTotal || 0);
      if (pm.includes('SPLIT') || pm.includes('+')) splitTotal += total;
      else if (pm.includes('CASH')) cashTotal += total;
      else if (pm.includes('UPI')) upiTotal += total;
      else if (pm.includes('CARD')) cardTotal += total;
      else cashTotal += total; // Default fallback
    });

    return {
      revenue,
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      avgTicket,
      cashTotal,
      upiTotal,
      cardTotal,
      splitTotal
    };
  }, [filteredOrders]);

  const handleExportExcel = () => {
    if (filteredOrders.length === 0) { alert("No data available to export."); return; }
    const data = filteredOrders.map(order => ({
      'Bill Number': order.bill_number || order.id,
      'Order ID': order.id,
      'Date': new Date(order.timestamp).toLocaleDateString('en-IN'),
      'Time': new Date(order.timestamp).toLocaleTimeString('en-IN'),
      'Type': order.orderType || order.type || 'Order',
      'Customer': order.customerName || 'Walk-In',
      'Phone': order.phone || 'N/A',
      'Subtotal': order.subtotal || 0,
      'Discount': order.discountAmt || 0,
      'GST': order.gstAmount || 0,
      'Service Charge': order.serviceCharge || 0,
      'Grand Total': order.grandTotal || 0,
      'Payment Mode': order.paymentMethod || 'N/A',
      'Status': String(order.status).toUpperCase(),
      'Items Summary': (order.cart || []).map(i => `${i.name} (x${i.qty || i.quantity || 1})`).join(', ')
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales History");
    ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 60 }];
    XLSX.writeFile(wb, `Sales_History_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleReprint = async (order) => {
    try {
      await printPosToSerial({
        orderId: order.id,
        tableName: order.orderType === 'Dine In' 
          ? (order.table_number ? `Table ${order.table_number}` : (order.customerName || '')) 
          : (order.customerName || ''),
        items: (order.cart || []).map(i => ({
          ...i,
          qty: i.qty || i.quantity || 1,
          price: i.price || 0
        })),
        subtotal: order.subtotal || (order.cart || []).reduce((sum, i) => sum + (i.price * (i.qty || i.quantity || 1)), 0),
        serviceCharge: order.serviceCharge || 0,
        gstAmount: order.gstAmount || 0,
        grandTotal: order.grandTotal,
        billNumber: order.bill_number || order.id || '—',
        orderType: order.orderType || 'Dine In',
        paymentMethod: order.paymentMethod || 'Cash',
        discountAmount: order.discountAmt || 0,
        timestamp: order.timestamp || null
      }, 'BILL', settings);
      alert(`Bill Reprint sent to printer for Bill #${order.bill_number || order.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to reprint bill: " + err.message);
    }
  };

  const handleEditPayment = async (orderId, newMethod) => {
    try {
      await apiService.updateBillPaymentMethod(orderId, newMethod);
      setOrderHistory(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, paymentMethod: newMethod } : o));
      setEditingPaymentId(null);
    } catch (err) {
      alert("Failed to update payment method: " + err.message);
    }
  };

  const statusConfig = {
    completed: { label: 'COMPLETED', bg: '#f0fdf4', color: '#15803d', border: '#dcfce7', dot: '#22c55e' },
    cancelled: { label: 'CANCELLED', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', color: '#334155', display: 'flex', flexDirection: 'column', height: '100%' }} className="no-scrollbar">
      
      {/* ── HEADER & CONTROLS ── */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '24px 32px', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Title, Search, Export */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.8px', margin: 0 }}>Billing & Transaction History</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', margin: 0 }}>Professional sales tracking, invoice management and reporting system</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '10px 16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
              <Search size={15} color="#64748b" />
              <input 
                value={localSearch} 
                onChange={e => setLocalSearch(e.target.value)} 
                placeholder="Search bill, table, item..." 
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: '13px', fontWeight: '600', width: '200px', color: '#0f172a' }} 
              />
            </div>
            {/* Export */}
            <button 
              onClick={handleExportExcel} 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: '0 4px 12px rgba(16,185,129,0.15)' }}
            >
              <TrendingUp size={14} /> Export Sheet
            </button>
            {/* Refresh */}
            <button 
              onClick={loadHistory} 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
            >
              <RefreshCw size={14} /> Sync DB
            </button>
          </div>
        </div>

        {/* ── ADVANCED FILTERS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            {/* Quick Date Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date:</span>
              <div style={{ display: 'flex', gap: '3px', background: '#e2e8f0', padding: '3px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'thisWeek', label: '7 Days' },
                  { key: 'thisMonth', label: 'This Month' },
                  { key: 'custom', label: 'Custom' }
                ].map(d => (
                  <button 
                    key={d.key} 
                    onClick={() => { setDateFilter(d.key); setVisibleCount(50); }} 
                    style={{
                      padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.15s',
                      background: dateFilter === d.key ? '#ffffff' : 'transparent',
                      color: dateFilter === d.key ? '#0f172a' : '#64748b',
                      boxShadow: dateFilter === d.key ? '0 2px 4px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Picker Inputs */}
            {dateFilter === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'slideIn 0.2s ease-out' }}>
                <input 
                  type="date" 
                  value={customStartDate} 
                  onChange={e => setCustomStartDate(e.target.value)} 
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', padding: '6px 10px', fontSize: '12px', fontWeight: '600' }} 
                />
                <span style={{ color: '#64748b', fontSize: '12px' }}>to</span>
                <input 
                  type="date" 
                  value={customEndDate} 
                  onChange={e => setCustomEndDate(e.target.value)} 
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', padding: '6px 10px', fontSize: '12px', fontWeight: '600' }} 
                />
              </div>
            )}

            {/* Payment Method Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment:</span>
              <div style={{ display: 'flex', gap: '3px', background: '#e2e8f0', padding: '3px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                {['All', 'Cash', 'UPI', 'Card', 'Split'].map(m => (
                  <button 
                    key={m} 
                    onClick={() => { setPaymentFilter(m); setVisibleCount(50); }} 
                    style={{
                      padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.15s',
                      background: paymentFilter === m ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                      color: paymentFilter === m ? '#ffffff' : '#64748b',
                      boxShadow: paymentFilter === m ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', outline: 'none' }}
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Amount (High to Low)</option>
                <option value="amount-asc">Amount (Low to High)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── STATS ROW (Dynamic Summaries) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          
          {/* Revenue & General Stats */}
          <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '16px', padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '500', color: '#166534', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Total Revenue</div>
            <div style={{ fontSize: '26px', fontWeight: '500', color: '#15803d' }}>₹{stats.revenue.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>Active filtered sales volume</div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Completed / Cancelled</div>
            <div style={{ fontSize: '26px', fontWeight: '600', color: '#0f172a' }}>
              {stats.completedCount} <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '600' }}>/ {stats.cancelledCount} voided</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>Transaction breakdown counts</div>
          </div>

          <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '16px', padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Average Ticket</div>
            <div style={{ fontSize: '26px', fontWeight: '500', color: '#1d4ed8' }}>₹{stats.avgTicket.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: '500' }}>Grand total average per order</div>
          </div>

          {/* Payment Type Split Breakdown */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '500' }}>
              <span style={{ color: '#d97706' }}>💵 CASH:</span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>₹{stats.cashTotal.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '500' }}>
              <span style={{ color: '#0284c7' }}>📱 UPI:</span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>₹{stats.upiTotal.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '500' }}>
              <span style={{ color: '#6d28d9' }}>💳 CARD:</span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>₹{stats.cardTotal.toLocaleString('en-IN')}</span>
            </div>
            {stats.splitTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '500' }}>
                <span style={{ color: '#be123c' }}>🔀 SPLIT:</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>₹{stats.splitTotal.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Status Selector */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content', border: '1px solid #e2e8f0', marginTop: '24px' }}>
          {[
            { id: 'completed', label: 'Completed Bills', count: stats.completedCount },
            { id: 'cancelled', label: 'Voided & Cancelled', count: stats.cancelledCount },
            { id: 'all', label: 'All History Log', count: filteredOrders.length }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => { setActiveTab(tab.id); setVisibleCount(50); setExpandedOrderId(null); }} 
              style={{
                padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.15s',
                background: activeTab === tab.id ? '#ffffff' : 'transparent',
                color: activeTab === tab.id ? '#0f172a' : '#64748b',
                boxShadow: activeTab === tab.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {tab.label}
              <span style={{ fontSize: '11px', fontWeight: '600', padding: '1px 7px', borderRadius: '20px', background: '#f1f5f9', color: activeTab === tab.id ? '#2563eb' : '#64748b', border: '1px solid #e2e8f0' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

      </div>
      
      {/* ── BILL LISTING ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }} className="no-scrollbar">
        {filteredOrders.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', background: '#ffffff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid #cbd5e1' }}>
              <ShoppingBag size={32} color="#cbd5e1" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>No history records found</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>Try adjusting your filters or date selectors above</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '1200px', margin: '0 auto' }}>
            {filteredOrders.slice(0, visibleCount).map((order, idx) => {
              const status = order.status || 'completed';
              const sc = statusConfig[status] || statusConfig.completed;
              const total = order.grandTotal || 0;
              const items = order.cart || [];
              const time = order.timestamp ? new Date(order.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
              const isExpanded = expandedOrderId === order.id;

              return (
                <div 
                  key={order.id || `idx-${idx}`} 
                  style={{
                    background: '#ffffff', borderRadius: '16px', border: `1px solid ${isExpanded ? '#3b82f6' : '#e2e8f0'}`,
                    overflow: 'hidden', transition: 'all 0.2s',
                    boxShadow: isExpanded ? '0 10px 30px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex' }}>
                    {/* Colored left strip */}
                    <div style={{ width: '4px', flexShrink: 0, background: sc.dot }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      
                      {/* Card Header Content */}
                      <div 
                        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      >
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {status === 'completed' ? <CheckCircle size={20} color="#22c55e" /> : <XCircle size={20} color="#ef4444" />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>
                              {order.customerName || (order.table_number ? `Table ${order.table_number}` : 'Walk-In')}
                            </span>
                            
                            {/* Bill / Invoice ID Badge */}
                            <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#2563eb', fontFamily: 'monospace', border: '1px solid #cbd5e1' }}>
                              BILL #{order.bill_number || order.id}
                            </span>

                            {/* Order type badge */}
                            <span style={{ fontSize: '11px', fontWeight: '500', padding: '2px 8px', borderRadius: '20px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                              {order.orderType || order.type || 'Dine In'}
                            </span>

                            {/* Payment Method */}
                            {order.status === 'completed' && (
                              <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: 'rgba(34,197,94,0.08)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.15)' }}>
                                💳 {String(order.paymentMethod).toUpperCase()}
                              </span>
                            )}
                            {order.status === 'cancelled' && (
                              <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.15)' }}>
                                VOIDED
                              </span>
                            )}
                          </div>
                          
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontWeight: '600' }}>
                            <span>🕒 {time}</span>
                            <span>📦 {items.length} item{items.length !== 1 ? 's' : ''}: {items.slice(0, 3).map(i => `${i.name}(x${i.qty || i.quantity || 1})`).join(', ')}{items.length > 3 ? ` +${items.length - 3} more` : ''}</span>
                            {order.phone && <span>📞 {order.phone}</span>}
                          </div>
                        </div>

                        {/* Amount & Quick Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <div style={{ fontSize: '20px', fontWeight: '700', color: status === 'cancelled' ? '#94a3b8' : '#0f172a', textDecoration: status === 'cancelled' ? 'line-through' : 'none' }}>
                            ₹{Number(total).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                          </div>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                            >
                              Details {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            
                            {status === 'completed' && (
                      <button 
                                onClick={() => handleReprint(order)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: '#2563eb', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                <Printer size={13} /> Reprint
                              </button>
                            )}

                            <button 
                              onClick={async () => {
                                const targetId = order.id || order.table_number || order.bill_number;
                                if (window.confirm(`Are you sure you want to permanently DELETE Bill #${order.bill_number || targetId}? This will remove it from all database records and revenue dashboards.`)) {
                                  try {
                                    await apiService.deleteOrder(targetId);
                                    setOrderHistory(prev => prev.filter(o => String(o.id) !== String(targetId) && String(o.table_number) !== String(targetId) && String(o.bill_number) !== String(targetId)));
                                    
                                    // Remove from active pickup orders state & storage if present
                                    setNonTableOrders(prev => {
                                      const updated = prev.filter(o => String(o.id) !== String(targetId) && String(o.id) !== String(order.table_number));
                                      saveToLocal('pos_nontable_orders', updated);
                                      return updated;
                                    });
                                  } catch (err) {
                                    alert("Failed to delete bill: " + (err?.message || err));
                                  }
                                }
                              }}
                              style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Details Block */}
                      {isExpanded && (
                        <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date & Time</div>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>{time}</div>
                            </div>
                            <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Billing Type</div>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>{order.orderType || order.type || 'Dine In'}</div>
                            </div>
                            <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'relative' }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode</div>
                              {editingPaymentId === order.id ? (
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                  <select 
                                    value={editingPaymentMethod} 
                                    onChange={e => setEditingPaymentMethod(e.target.value)}
                                    style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: '500', padding: '2px 4px', outline: 'none' }}
                                  >
                                    <option value="Cash">CASH</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Card">CARD</option>
                                    <option value="Split">SPLIT</option>
                                  </select>
                                  <button onClick={() => handleEditPayment(order.id, editingPaymentMethod)} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
                                  <button onClick={() => setEditingPaymentId(null)} style={{ background: '#cbd5e1', color: '#475569', border: 'none', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>X</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{order.paymentMethod || 'N/A'}</span>
                                  {status === 'completed' && (
                                    <button 
                                      onClick={() => { setEditingPaymentId(order.id); setEditingPaymentMethod(order.paymentMethod || 'Cash'); }}
                                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                                    >
                                      ✏️ Edit
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer Phone</div>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>{order.phone || 'N/A'}</div>
                            </div>
                          </div>

                          {/* Items Breakdown Table */}
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#ffffff', marginBottom: '16px' }}>
                            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#64748b', display: 'flex', letterSpacing: '0.5px' }}>
                              <div style={{ flex: 1 }}>ITEM DETAIL</div>
                              <div style={{ width: '80px', textAlign: 'center' }}>QTY</div>
                              <div style={{ width: '100px', textAlign: 'right' }}>PRICE</div>
                              <div style={{ width: '120px', textAlign: 'right' }}>AMOUNT</div>
                            </div>
                            <div>
                              {items.map((item, i) => {
                                const qty = item.qty || item.quantity || 1;
                                return (
                                  <div key={i} style={{ padding: '12px 16px', display: 'flex', borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
                                    <div style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: '#334155' }}>{item.name}</div>
                                    <div style={{ width: '80px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#d97706' }}>x{qty}</div>
                                    <div style={{ width: '100px', textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#64748b' }}>₹{Number(item.price || 0).toLocaleString()}</div>
                                    <div style={{ width: '120px', textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>₹{(Number(item.price || 0) * qty).toLocaleString()}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bill Totals breakdown matching industry receipt standard */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500', color: '#64748b' }}>
                                <span>Subtotal:</span>
                                <span style={{ color: '#0f172a' }}>₹{Number(order.subtotal || total).toLocaleString()}</span>
                              </div>

                              {Number(order.discountAmt || 0) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500', color: '#dc2626' }}>
                                  <span>Discount:</span>
                                  <span>-₹{Number(order.discountAmt).toLocaleString()}</span>
                                </div>
                              )}

                              {Number(order.serviceCharge || 0) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500', color: '#64748b' }}>
                                  <span>Service Charge:</span>
                                  <span style={{ color: '#0f172a' }}>+₹{Number(order.serviceCharge).toLocaleString()}</span>
                                </div>
                              )}

                              {Number(order.gstAmount || 0) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500', color: '#64748b' }}>
                                  <span>CGST/SGST:</span>
                                  <span style={{ color: '#0f172a' }}>+₹{Number(order.gstAmount).toLocaleString()}</span>
                                </div>
                              )}

                              {Number(order.tipAmount || 0) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500', color: '#2563eb' }}>
                                  <span>Tips:</span>
                                  <span>+₹{Number(order.tipAmount).toLocaleString()}</span>
                                </div>
                              )}

                              {(() => {
                                const calculatedRaw = (Number(order.subtotal || total) - Number(order.discountAmt || 0) + Number(order.serviceCharge || 0) + Number(order.gstAmount || 0));
                                const diff = Number(total) - calculatedRaw;
                                return Math.abs(diff) > 0.01 ? (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '500', color: '#64748b' }}>
                                    <span>Round Off:</span>
                                    <span style={{ color: '#0f172a' }}>{diff >= 0 ? '+' : ''}₹{diff.toFixed(2)}</span>
                                  </div>
                                ) : null;
                              })()}

                              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                                <span>Grand Total:</span>
                                <span style={{ color: '#16a34a' }}>₹{Number(total).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            })}

            {visibleCount < filteredOrders.length && (
              <button 
                onClick={() => setVisibleCount(v => v + 50)}
                style={{
                  marginTop: '16px',
                  padding: '14px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '16px',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
                onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseOut={e => e.currentTarget.style.background = '#ffffff'}
              >
                Load More Transaction Logs ({filteredOrders.length - visibleCount} remaining) <ChevronDown size={15} />
              </button>
            )}
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
      setCategories(categories.filter(c => c !== catName));
    }
  };

  const addItem = async () => {
    try {
      const { success, item } = await orderService.addMenuItem({
        ...newItem,
        type: 'retail',
        stockQuantity: parseInt(newItem.stockQuantity, 10) || 0,
        inStock: parseInt(newItem.stockQuantity, 10) > 0
      }, categories);
      if (success) {
        setMenuItems(prev => [...prev, item]);
        setNewItem({ name: '', price: '', stockQuantity: '', cat: categories[0] || '' });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteItem = async (id) => {
    if (window.confirm("Are you sure you want to remove this product?")) {
      const { success } = await orderService.removeMenuItem(id);
      if (success) setMenuItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const toggleStock = async (id) => {
    const item = (menuItems || []).find(i => i.id === id);
    if (!item) return;
    const nextStock = !item.inStock;
    setMenuItems(prev => prev.map(i => i.id === id ? { ...i, inStock: nextStock } : i));
    await orderService.updateMenuStock(id, { inStock: nextStock });
  };

  const updateQuantity = async (id, newQty) => {
    const q = parseInt(newQty, 10) || 0;
    setMenuItems(prev => prev.map(i => i.id === id ? { ...i, stockQuantity: q, inStock: q > 0 } : i));
    await orderService.updateMenuStock(id, { stockQuantity: q, inStock: q > 0 });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }} className="animate-fade-in no-scrollbar">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '24px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package size={28} color="#3b82f6" /> Retail Product Setup
        </h2>

        {/* Categories Section */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#334155' }}>Retail Categories</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input type="text" placeholder="New Category Name" value={newCat} onChange={e => setNewCat(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <button onClick={addCategory} className="btn-pp btn-pp-primary">Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {categories.map(cat => {
              const name = typeof cat === 'object' ? cat.name : cat;
              return (
                <div key={name} style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {name} <button onClick={() => deleteCategory(name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inventory Items Section */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#334155' }}>Product Inventory</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto', gap: '10px', alignItems: 'center', marginBottom: '24px' }}>
            <input type="text" placeholder="Product Name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input type="number" placeholder="Price (₹)" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input type="number" placeholder="Stock Qty" value={newItem.stockQuantity} onChange={e => setNewItem({ ...newItem, stockQuantity: e.target.value })} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <select value={newItem.cat} onChange={e => setNewItem({ ...newItem, cat: e.target.value })} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}>
              {categories.map(cat => {
                const name = typeof cat === 'object' ? cat.name : cat;
                return <option key={name} value={name}>{name}</option>
              })}
            </select>
            <button onClick={addItem} className="btn-pp btn-pp-primary" style={{ padding: '10px 20px', background: '#3b82f6' }}>Add</button>
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#334155', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>Current Stock</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {menuItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: item.inStock ? 'white' : '#fef2f2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#3b82f6' }}></div>
                  <div style={{ fontWeight: '500', color: '#1e293b' }}>{item.name}</div>
                  <div style={{ color: '#64748b', fontSize: '13px' }}>{typeof item.cat === 'object' ? item.cat.name : item.cat}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontWeight: '500', color: '#94161c' }}>₹{item.price}</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Qty:</span>
                    <input type="number" value={item.stockQuantity} onChange={e => updateQuantity(item.id, e.target.value)} style={{ width: '60px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center' }} />
                  </div>

                  <button onClick={() => toggleStock(item.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: item.inStock ? '#ecfdf5' : 'transparent', color: item.inStock ? '#10b981' : '#ef4444', borderColor: item.inStock ? '#10b981' : '#ef4444' }}>
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

const ModsEditorModal = ({ modifierGroups, setModifierGroups, addOns, setAddOns, onClose }) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [newAddOnName, setNewAddOnName] = useState('');
  const [newAddOnPrice, setNewAddOnPrice] = useState('');

  const addGroup = () => {
    if (newGroupName.trim()) {
      setModifierGroups([...modifierGroups, { name: newGroupName.trim(), options: [] }]);
      setNewGroupName('');
    }
  };

  const addGroupOption = (groupIndex, optionName, optionPrice) => {
    if (optionName.trim()) {
      const newGroups = [...modifierGroups];
      newGroups[groupIndex].options.push({ name: optionName.trim(), priceDelta: Number(optionPrice) || 0 });
      setModifierGroups(newGroups);
    }
  };

  const removeGroup = (index) => {
    setModifierGroups(modifierGroups.filter((_, i) => i !== index));
  };

  const removeGroupOption = (groupIndex, optionIndex) => {
    const newGroups = [...modifierGroups];
    newGroups[groupIndex].options = newGroups[groupIndex].options.filter((_, i) => i !== optionIndex);
    setModifierGroups(newGroups);
  };

  const addAddOn = () => {
    if (newAddOnName.trim()) {
      setAddOns([...addOns, { name: newAddOnName.trim(), priceDelta: Number(newAddOnPrice) || 0 }]);
      setNewAddOnName('');
      setNewAddOnPrice('');
    }
  };

  const removeAddOn = (index) => {
    setAddOns(addOns.filter((_, i) => i !== index));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '500px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: '600', fontSize: '18px', color: '#1e293b' }}>Modifiers & Add-ons</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        {/* MODIFIER GROUPS */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontWeight: '600', fontSize: '14px', marginBottom: '8px', color: '#475569' }}>Modifier Groups (e.g. Size, Spice Level)</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="New Group Name" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <button onClick={addGroup} style={{ padding: '8px 12px', background: '#3b82f6', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Add Group</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {modifierGroups.map((grp, gIdx) => (
              <div key={gIdx} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px' }}>{grp.name}</strong>
                  <button onClick={() => removeGroup(gIdx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Remove Group</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {grp.options.map((opt, oIdx) => (
                    <div key={oIdx} style={{ fontSize: '12px', background: 'white', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{opt.name} {opt.priceDelta ? `(+₹${opt.priceDelta})` : ''}</span>
                      <X size={12} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => removeGroupOption(gIdx, oIdx)} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input id={`opt-name-${gIdx}`} placeholder="Option Name" style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <input id={`opt-price-${gIdx}`} type="number" placeholder="+₹ Price" style={{ width: '80px', padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <button 
                    onClick={() => {
                      const nInput = document.getElementById(`opt-name-${gIdx}`);
                      const pInput = document.getElementById(`opt-price-${gIdx}`);
                      addGroupOption(gIdx, nInput.value, pInput.value);
                      nInput.value = ''; pInput.value = '';
                    }}
                    style={{ padding: '6px 10px', fontSize: '12px', background: '#e2e8f0', color: '#475569', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ADD-ONS */}
        <div>
          <h4 style={{ fontWeight: '500', fontSize: '14px', marginBottom: '8px', color: '#475569' }}>Optional Add-ons</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input value={newAddOnName} onChange={e => setNewAddOnName(e.target.value)} placeholder="Add-on Name" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input value={newAddOnPrice} onChange={e => setNewAddOnPrice(e.target.value)} type="number" placeholder="+₹ Price" style={{ width: '100px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <button onClick={addAddOn} style={{ padding: '8px 12px', background: '#3b82f6', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {addOns.map((addon, aIdx) => (
              <div key={aIdx} style={{ fontSize: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{addon.name} (+₹{addon.priceDelta})</span>
                <X size={14} style={{ cursor: 'pointer', color: '#10b981' }} onClick={() => removeAddOn(aIdx)} />
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} style={{ marginTop: '24px', width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
          Done
        </button>
      </div>
    </div>
  );
};

const RichModifierModal = ({ item, onAddToCart, onClose }) => {
  // Initialize state based on item's modifier_groups and add_ons
  const [selectedGroups, setSelectedGroups] = useState(() => {
    const init = {};
    if (item.modifier_groups) {
      item.modifier_groups.forEach((grp, idx) => {
        if (grp.options && grp.options.length > 0) {
          init[idx] = grp.options[0].name; // default to first option
        }
      });
    }
    return init;
  });

  const [selectedAddOns, setSelectedAddOns] = useState({}); // { [addonIndex]: boolean }
  const [selectedLegacyModifier, setSelectedLegacyModifier] = useState(null);

  const handleAdd = () => {
    let nameNoteParts = [];
    let priceDelta = 0;
    let modIdParts = [];

    if (item.modifiers && item.modifiers.length > 0 && selectedLegacyModifier) {
      if (selectedLegacyModifier !== 'Regular') {
        nameNoteParts.push(selectedLegacyModifier);
        modIdParts.push(selectedLegacyModifier);
        const match = selectedLegacyModifier.match(/\(\+₹(\d+)\)/);
        if (match) priceDelta += parseInt(match[1], 10);
      }
    }

    if (item.modifier_groups) {
      item.modifier_groups.forEach((grp, idx) => {
        const selName = selectedGroups[idx];
        if (selName) {
          const opt = grp.options.find(o => o.name === selName);
          if (opt) {
            nameNoteParts.push(selName);
            modIdParts.push(selName);
            priceDelta += (opt.priceDelta || 0);
          }
        }
      });
    }

    if (item.add_ons) {
      item.add_ons.forEach((addon, idx) => {
        if (selectedAddOns[idx]) {
          nameNoteParts.push(`Add ${addon.name}`);
          modIdParts.push(addon.name);
          priceDelta += (addon.priceDelta || 0);
        }
      });
    }

    const payload = {
      nameNote: nameNoteParts.length > 0 ? ` - ${nameNoteParts.join(', ')}` : '',
      modId: modIdParts.length > 0 ? `-${modIdParts.join('-')}` : '',
      priceDelta
    };
    onAddToCart(item, payload);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '400px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: '600', fontSize: '18px', color: '#1e293b' }}>Customize {item.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        {/* Legacy Modifiers */}
        {item.modifiers && item.modifiers.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontWeight: '500', fontSize: '14px', marginBottom: '12px', color: '#475569' }}>Select Option</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {item.modifiers.map(mod => (
                <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: selectedLegacyModifier === mod ? '#ecfdf5' : '#f8fafc', padding: '12px', borderRadius: '8px', border: `1px solid ${selectedLegacyModifier === mod ? '#10b981' : '#e2e8f0'}` }}>
                  <input type="radio" name="legacyMod" checked={selectedLegacyModifier === mod} onChange={() => setSelectedLegacyModifier(mod)} />
                  <span style={{ fontSize: '14px', fontWeight: selectedLegacyModifier === mod ? 'bold' : '500', color: selectedLegacyModifier === mod ? '#065f46' : '#334155' }}>{mod}</span>
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: selectedLegacyModifier === 'Regular' ? '#ecfdf5' : '#f8fafc', padding: '12px', borderRadius: '8px', border: `1px solid ${selectedLegacyModifier === 'Regular' ? '#10b981' : '#e2e8f0'}` }}>
                <input type="radio" name="legacyMod" checked={selectedLegacyModifier === 'Regular'} onChange={() => setSelectedLegacyModifier('Regular')} />
                <span style={{ fontSize: '14px', fontWeight: selectedLegacyModifier === 'Regular' ? 'bold' : '500', color: selectedLegacyModifier === 'Regular' ? '#065f46' : '#334155' }}>Regular (No Mods)</span>
              </label>
            </div>
          </div>
        )}

        {/* Rich Modifier Groups */}
        {item.modifier_groups && item.modifier_groups.map((grp, gIdx) => (
          <div key={gIdx} style={{ marginBottom: '20px' }}>
            <h4 style={{ fontWeight: '500', fontSize: '14px', marginBottom: '12px', color: '#475569' }}>{grp.name}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {grp.options.map((opt, oIdx) => (
                <label key={oIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: selectedGroups[gIdx] === opt.name ? '#ecfdf5' : '#f8fafc', padding: '12px', borderRadius: '8px', border: `1px solid ${selectedGroups[gIdx] === opt.name ? '#10b981' : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="radio" name={`grp-${gIdx}`} checked={selectedGroups[gIdx] === opt.name} onChange={() => setSelectedGroups({...selectedGroups, [gIdx]: opt.name})} />
                    <span style={{ fontSize: '14px', fontWeight: selectedGroups[gIdx] === opt.name ? 'bold' : '500', color: selectedGroups[gIdx] === opt.name ? '#065f46' : '#334155' }}>{opt.name}</span>
                  </div>
                  {opt.priceDelta > 0 && <span style={{ fontSize: '13px', fontWeight: '500', color: '#059669' }}>+₹{opt.priceDelta}</span>}
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Rich Add-ons */}
        {item.add_ons && item.add_ons.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontWeight: '500', fontSize: '14px', marginBottom: '12px', color: '#475569' }}>Optional Add-ons</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {item.add_ons.map((addon, aIdx) => (
                <label key={aIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: selectedAddOns[aIdx] ? '#eff6ff' : '#f8fafc', padding: '12px', borderRadius: '8px', border: `1px solid ${selectedAddOns[aIdx] ? '#3b82f6' : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={!!selectedAddOns[aIdx]} onChange={(e) => setSelectedAddOns({...selectedAddOns, [aIdx]: e.target.checked})} />
                    <span style={{ fontSize: '14px', fontWeight: selectedAddOns[aIdx] ? 'bold' : '500', color: selectedAddOns[aIdx] ? '#1e40af' : '#334155' }}>{addon.name}</span>
                  </div>
                  {addon.priceDelta > 0 && <span style={{ fontSize: '13px', fontWeight: '600', color: '#2563eb' }}>+₹{addon.priceDelta}</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleAdd} style={{ marginTop: '12px', width: '100%', padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
          Add to Order
        </button>
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
  const [shortCode, setShortCode] = useState("");
  const [modifierGroups, setModifierGroups] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [showModsEditor, setShowModsEditor] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState("All");
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(typeof categories[0] === 'object' ? categories[0].name : categories[0]);
    }
  }, [categories, selectedCategory]);

  const addCategory = async () => {
    setFormError('');
    setFormSuccess('');
    const trimmed = (newCat || '').trim();
    if (!trimmed) {
      setFormError("Please enter a Category Name");
      return;
    }
    const catStrList = categories.map(c => typeof c === 'object' ? c.name : c);
    const exists = catStrList.some(c => String(c).toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setFormError(`Category "${trimmed}" already exists`);
      return;
    }
    const updatedCats = [...categories, trimmed];
    setCategories(updatedCats);
    setSelectedCategory(trimmed);
    setNewCat('');
    setFormSuccess(`Category "${trimmed}" added successfully! Select it below to add items.`);
    try {
      await apiService.saveCategories(updatedCats);
    } catch (err) {
      console.warn("Offline Mode: Category created locally.", err);
    }
  };

  const deleteCategory = (catName) => {
    if (window.confirm(`Are you sure you want to delete the category "${catName}"? This will not delete the items in this category.`)) {
      setCategories(categories.filter(c => (typeof c === 'object' ? c.name : c) !== catName));
      if (selectedCategory === catName) {
        const remaining = categories.filter(c => (typeof c === 'object' ? c.name : c) !== catName);
        setSelectedCategory(remaining.length > 0 ? (typeof remaining[0] === 'object' ? remaining[0].name : remaining[0]) : '');
      }
    }
  };

  const addItem = async () => {
    setFormError('');
    setFormSuccess('');

    if (!name || !name.trim()) {
      setFormError("Please enter the Item Name");
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      setFormError("Please enter a valid Price (e.g. 150)");
      return;
    }
    if (!selectedCategory) {
      setFormError("Please select a Category");
      return;
    }

    try {
      if (editingId) {
        // UPDATE MODE
        const updatedData = { 
          name: name.trim(), 
          price: Number(price), 
          category: selectedCategory, 
          type, 
          short_code: shortCode.trim(), 
          modifier_groups: modifierGroups, 
          add_ons: addOns,
          inStock: true,
          available: true
        };
        const res = await apiService.updateMenuItem(editingId, updatedData);
        if (res.success) {
          setMenuItems(prev => prev.map(i => i.id === editingId ? { ...i, ...updatedData } : i));
          setEditingId(null);
          setName("");
          setPrice("");
          setShortCode("");
          setModifierGroups([]);
          setAddOns([]);
          setFormSuccess(`Item "${updatedData.name}" updated successfully!`);
        }
      } else {
        // ADD MODE — Default inStock: true
        const { success, item } = await orderService.addMenuItem({ 
          name: name.trim(), 
          price: Number(price), 
          category: selectedCategory, 
          type, 
          short_code: shortCode.trim(), 
          modifier_groups: modifierGroups, 
          add_ons: addOns,
          inStock: true,
          available: true
        }, categories);
        if (success) {
          const newItemWithStock = { ...item, inStock: true, available: true };
          setMenuItems(prev => [...prev, newItemWithStock]);
          setName("");
          setPrice("");
          setShortCode("");
          setModifierGroups([]);
          setAddOns([]);
          setFormSuccess(`Item "${newItemWithStock.name}" added to ${selectedCategory}!`);
        }
      }
    } catch (err) {
      setFormError(err.message || "Failed to add item");
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(String(item.price));
    setSelectedCategory(typeof item.category === 'object' ? item.category.name : (item.category || "General"));
    setType(item.type || 'Veg');
    setShortCode(item.short_code || "");
    setModifierGroups(item.modifier_groups || []);
    setAddOns(item.add_ons || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteItem = async (id) => {
    if (window.confirm("Are you sure you want to remove this item from the menu?")) {
      const { success } = await orderService.removeMenuItem(id);
      if (success) setMenuItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const toggleStock = async (id) => {
    const targetItem = menuItems.find(i => i.id === id);
    if (!targetItem) return;
    const currentStock = targetItem.inStock ?? targetItem.available ?? true;
    const nextStock = !currentStock;

    // Instant local UI update
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, inStock: nextStock, available: nextStock } : item));

    // Persist to server
    try {
      await apiService.updateMenuItem(id, { available: nextStock, inStock: nextStock });
    } catch (e) {
      console.warn("Failed to persist stock update to server:", e);
    }
  };

  const clearAllItems = () => {
    if (window.confirm("CRITICAL ACTION: Are you sure you want to delete ALL menu items? This cannot be undone.")) {
      if (window.confirm("Are you ABSOLUTELY sure? This will wipe your inventory.")) {
        setMenuItems([]);
      }
    }
  };

  // Helper to extract category name string
  const getCatStr = (cat) => typeof cat === 'object' ? cat.name : cat;

  // Filtered menu items by search and active category tab
  const filteredMenuItems = menuItems.filter(item => {
    const itemCat = item.category || getCatStr(item.cat) || "General";
    const matchesSearch = searchTerm === "" || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.short_code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemCat.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = activeCategoryTab === "All" || itemCat.toLowerCase() === activeCategoryTab.toLowerCase();
    
    return matchesSearch && matchesTab;
  });

  // Group filtered menu items by category
  const groupedMenu = filteredMenuItems.reduce((acc, item) => {
    const cat = item.category || getCatStr(item.cat) || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Category counts for tab badges
  const categoryCounts = categories.reduce((acc, cat) => {
    const cName = getCatStr(cat);
    acc[cName] = menuItems.filter(i => (i.category || getCatStr(i.cat) || "General").toLowerCase() === cName.toLowerCase()).length;
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }} className="animate-fade-in no-scrollbar">
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '500', marginBottom: '24px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Utensils size={28} color="#10b981" /> Menu & Inventory Setup
        </h2>

        {/* Categories Section */}
        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#334155' }}>Categories</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="New Category Name (e.g. Desserts)"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <button onClick={addCategory} className="btn-pp btn-pp-primary" style={{ background: '#10b981', padding: '10px 20px' }}>Add Category</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {categories.map(cat => {
              const catName = getCatStr(cat);
              return (
                <div key={catName} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                  {catName}
                  <button onClick={() => deleteCategory(catName)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#ef4444' }}>
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
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#334155' }}>
              {editingId ? "Edit Menu Item" : "Add Menu Item"}
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const ok = await apiService.syncAppData(undefined, menuItems, categories);
                    if (ok) alert("Menu synced to all devices!");
                    else alert("Sync failed. Check connection.");
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setSyncing(false);
                  }
                }}
                disabled={syncing}
                style={{
                  background: '#f0f9ff',
                  color: '#0284c7',
                  border: '1px solid #bae6fd',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  opacity: syncing ? 0.6 : 1
                }}
              >
                <RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} className={syncing ? "animate-spin" : ""} /> Sync to Cloud
              </button>
              <button
                onClick={clearAllItems}
                style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Clear All
              </button>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Add new items or manage current inventory stock below.</p>
          
          {/* Inline Error & Success Banners (Non-blocking UI) */}
          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>⚠️ {formError}</span>
              <button onClick={() => setFormError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', padding: 0 }}><X size={16} /></button>
            </div>
          )}
          {formSuccess && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>✅ {formSuccess}</span>
              <button onClick={() => setFormSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', padding: 0 }}><X size={16} /></button>
            </div>
          )}
          
          {/* Clean 2-Row Form Layout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            {/* Row 1: Primary Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>Item Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Cold Coffee"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>Price (₹) *</label>
                <input
                  type="number"
                  placeholder="Price"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>Category *</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontSize: '13px' }}
                >
                  <option value="">Select Category</option>
                  {categories.map((cat, i) => {
                    const catName = getCatStr(cat);
                    return (
                      <option key={i} value={catName}>
                        {catName}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontSize: '13px' }}
                >
                  <option value="Veg">🟢 Veg</option>
                  <option value="Non-Veg">🔴 Non-Veg</option>
                </select>
              </div>
            </div>

            {/* Row 2: Secondary Options & Action Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                <div style={{ flex: 1, maxWidth: '180px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '500', color: '#475569', display: 'block', marginBottom: '4px' }}>Short Code</label>
                  <input
                    type="text"
                    placeholder="e.g. cc"
                    value={shortCode}
                    onChange={e => setShortCode(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Modifiers</label>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowModsEditor(true);
                    }} 
                    style={{ 
                      padding: '9px 14px', 
                      borderRadius: '6px', 
                      border: '1px solid #cbd5e1', 
                      background: (modifierGroups.length > 0 || addOns.length > 0) ? '#f0fdf4' : 'white', 
                      color: (modifierGroups.length > 0 || addOns.length > 0) ? '#166534' : '#334155',
                      borderColor: (modifierGroups.length > 0 || addOns.length > 0) ? '#bbf7d0' : '#cbd5e1',
                      cursor: 'pointer', 
                      fontSize: '13px',
                      fontWeight: '600' 
                    }}
                  >
                    {modifierGroups.length > 0 || addOns.length > 0 ? `Mods (${modifierGroups.length}/${addOns.length})` : '+ Add Modifiers'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {editingId && (
                  <button 
                    onClick={() => {
                      setEditingId(null);
                      setName(""); setPrice(""); setShortCode("");
                      setModifierGroups([]); setAddOns([]);
                    }} 
                    style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}
                  >
                    Cancel
                  </button>
                )}
                <button 
                  onClick={addItem} 
                  className="btn-pp btn-pp-primary" 
                  style={{ 
                    padding: '9px 24px', 
                    background: editingId ? '#2563eb' : '#10b981', 
                    color: 'white', 
                    fontWeight: '600', 
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  {editingId ? 'Save Changes' : '+ Add Item'}
                </button>
              </div>
            </div>
          </div>

          {/* Current Menu Header & Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#334155', margin: 0 }}>Current Menu</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Showing {filteredMenuItems.length} of {menuItems.length} items
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Search menu items..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '7px 12px 7px 30px', borderRadius: '20px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', width: '220px' }}
              />
            </div>
          </div>

          {/* Category Filter Tabs Bar */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9' }} className="no-scrollbar">
            <button
              onClick={() => setActiveCategoryTab("All")}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: activeCategoryTab === "All" ? '#10b981' : '#f1f5f9',
                color: activeCategoryTab === "All" ? 'white' : '#475569',
                borderColor: activeCategoryTab === "All" ? '#10b981' : '#e2e8f0'
              }}
            >
              All ({menuItems.length})
            </button>

            {categories.map((cat, i) => {
              const catName = getCatStr(cat);
              const count = categoryCounts[catName] || 0;
              const isActive = activeCategoryTab.toLowerCase() === catName.toLowerCase();
              return (
                <button
                  key={i}
                  onClick={() => setActiveCategoryTab(catName)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: isActive ? '#10b981' : '#f1f5f9',
                    color: isActive ? 'white' : '#475569',
                    borderColor: isActive ? '#10b981' : '#e2e8f0'
                  }}
                >
                  {catName} ({count})
                </button>
              );
            })}
          </div>

          {/* Grouped Menu List */}
          {Object.keys(groupedMenu).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
              No menu items found. Add items above to get started!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {Object.entries(groupedMenu).map(([catName, items]) => (
                <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Category Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', letterSpacing: '-0.2px' }}>
                      {catName}
                    </span>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '11px', fontWeight: '600', padding: '2px 10px', borderRadius: '12px' }}>
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* Category Items */}
                  {items.map(item => {
                    const isInStock = item.inStock ?? item.available ?? true;
                    const hasMods = (item.modifier_groups && item.modifier_groups.length > 0) || (item.add_ons && item.add_ons.length > 0);
                    const modCount = (item.modifier_groups?.length || 0) + (item.add_ons?.length || 0);

                    return (
                      <div 
                        key={item.id} 
                        style={{ 
                          display: 'flex', 
                          justify: 'space-between', 
                          alignItems: 'center', 
                          padding: '14px 18px', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '10px', 
                          background: isInStock ? 'white' : '#fef2f2',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Left: Item Info Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid', borderColor: String(item.type || '').toLowerCase() === 'veg' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: String(item.type || '').toLowerCase() === 'veg' ? '#10b981' : '#ef4444' }}></div>
                          </div>
                          
                          <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px', marginRight: '4px' }}>
                            {item.name}
                          </div>

                          <div style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '500', padding: '3px 10px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            {catName}
                          </div>

                          {item.short_code && (
                            <div style={{ background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', border: '1px solid #dbeafe' }}>
                              CODE: {item.short_code.toUpperCase()}
                            </div>
                          )}

                          {hasMods && (
                            <div style={{ background: '#f0fdf4', color: '#166534', fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                              ✨ {modCount} {modCount === 1 ? 'Modifier' : 'Modifiers'}
                            </div>
                          )}
                        </div>

                        {/* Right: Dedicated Price Tag + Action Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ 
                            fontWeight: '600', 
                            color: '#94161c', 
                            fontSize: '14px', 
                            background: '#fff5f5', 
                            padding: '4px 12px', 
                            borderRadius: '8px', 
                            border: '1px solid #ffe4e6',
                            marginRight: '6px'
                          }}>
                            ₹{item.price}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setName(`${item.name} (Copy)`);
                              setPrice(String(item.price));
                              setSelectedCategory(catName);
                              setType(item.type || 'Veg');
                              setShortCode(item.short_code ? `${item.short_code}_c` : '');
                              setModifierGroups(item.modifier_groups || []);
                              setAddOns(item.add_ons || []);
                              setEditingId(null);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            title="Duplicate item"
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '500', cursor: 'pointer', background: '#f8fafc', color: '#475569' }}
                          >
                            Copy
                          </button>

                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '500', cursor: 'pointer', background: '#ffffff', color: '#1e293b' }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleStock(item.id)}
                            style={{ 
                              padding: '6px 14px', 
                              borderRadius: '6px', 
                              border: '1px solid', 
                              fontSize: '12px', 
                              fontWeight: '600', 
                              cursor: 'pointer', 
                              background: isInStock ? '#ecfdf5' : '#fef2f2', 
                              color: isInStock ? '#047857' : '#b91c1c', 
                              borderColor: isInStock ? '#a7f3d0' : '#fecaca' 
                            }}
                          >
                            {isInStock ? 'In Stock' : 'Out of Stock'}
                          </button>

                          <button 
                            onClick={() => deleteItem(item.id)} 
                            title="Delete item"
                            style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', cursor: 'pointer', color: '#ef4444', padding: '5px 8px', display: 'flex', alignItems: 'center' }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      
      {showModsEditor && (
        <ModsEditorModal
          modifierGroups={modifierGroups}
          setModifierGroups={setModifierGroups}
          addOns={addOns}
          setAddOns={setAddOns}
          onClose={() => setShowModsEditor(false)}
        />
      )}
    </div>
  );
};

/* --- FLOOR PLAN SETUP VIEW (Extracted to src/components/FloorDesigner.jsx) --- */

/* --- SYSTEM SETTINGS VIEW --- */
/* --- ADVANCED GLOBAL SETTINGS VIEW --- */
const GlobalSettingsView = ({ settings, onSaveSettings, onClearHistory, onFullReset, devices = [], onUpdateDeviceStatus, onDeleteDevice, isConnected, onRestoreData, appVersion, categories, onOpenDiagnostics }) => {
  const [activeTab, setActiveTab] = useState('design');
  const [localSettings, setLocalSettings] = useState(settings);
  const [notification, setNotification] = useState(null);

  const [cloudDashboardUrl, setCloudDashboardUrl] = useState('https://tyde-dashboard-tan.vercel.app');
  const [cloudApiKey, setCloudApiKey] = useState('');
  const [cloudSyncStatus, setCloudSyncStatus] = useState(null);
  const [syncingCloud, setSyncingCloud] = useState(false);

  useEffect(() => {
    fetch('/api/analytics/cloud-sync')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.config?.cloudUrl) setCloudDashboardUrl(data.config.cloudUrl);
          if (data.config?.apiKey) setCloudApiKey(data.config.apiKey);
          if (data.status) setCloudSyncStatus(data.status);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveCloudSyncConfig = async () => {
    setSyncingCloud(true);
    try {
      const res = await fetch('/api/analytics/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cloudApiKey, cloudUrl: cloudDashboardUrl })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Cloud Dashboard API key saved! Live sync active.');
      } else {
        showNotification(data.error || 'Failed to save cloud sync config', 'error');
      }
    } catch (err) {
      showNotification('Error saving cloud sync settings', 'error');
    } finally {
      setSyncingCloud(false);
    }
  };

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
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: 'white', padding: '0 16px', overflowX: 'auto', flexShrink: 0 }} className="no-scrollbar">
        {[
          { id: 'design', label: 'Design', icon: <Monitor size={16} /> },
          { id: 'billing', label: 'Bill', icon: <ReceiptText size={16} /> },
          { id: 'connection', label: 'Server', icon: <Wifi size={16} /> },
          { id: 'printer', label: 'Printer', icon: <Printer size={16} /> },
          { id: 'taxes', label: 'Taxes', icon: <Percent size={16} /> },
          { id: 'devices', label: 'Devices', icon: <Smartphone size={16} /> },
          { id: 'security', label: 'Security', icon: <Shield size={16} /> },
          { id: 'system', label: 'System', icon: <Settings2 size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', padding: '14px 18px', fontSize: '13px', fontWeight: '600', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
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
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                <Monitor size={20} color="var(--primary)" /> Color Theme Control
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Primary / Highlight Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" name="accentColor" value={localSettings.accentColor} onChange={handleChange} style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
                    <input type="text" name="accentColor" value={localSettings.accentColor} onChange={handleChange} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#111827' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Secondary Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" name="secondaryColor" value={localSettings.secondaryColor || '#7c3aed'} onChange={handleChange} style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
                    <input type="text" name="secondaryColor" value={localSettings.secondaryColor || '#7c3aed'} onChange={handleChange} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#111827' }} />
                  </div>
                </div>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: '600', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                <LayoutGrid size={20} color="var(--primary)" /> Floor Plan & Shapes
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Corner Styling</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['0', '8', '24'].map(r => (
                      <button key={r} onClick={() => setLocalSettings(prev => ({ ...prev, borderRadius: r }))} style={{ flex: 1, padding: '10px', borderRadius: `${r}px`, border: `2px solid ${localSettings.borderRadius === r ? localSettings.accentColor : '#e2e8f0'}`, background: localSettings.borderRadius === r ? `${localSettings.accentColor}10` : 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>{r === '0' ? 'Square' : r === '24' ? 'Pill' : `${r}px`}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Table Geometry</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['square', 'circle'].map(shape => (
                      <button key={shape} onClick={() => setLocalSettings(prev => ({ ...prev, tableShape: shape }))} style={{ flex: 1, padding: '10px', borderRadius: shape === 'circle' ? '50px' : '4px', border: `2px solid ${localSettings.tableShape === shape ? localSettings.accentColor : '#e2e8f0'}`, background: localSettings.tableShape === shape ? `${localSettings.accentColor}10` : 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize' }}>{shape}</button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleSave} style={{ marginTop: '20px', padding: '14px', background: localSettings.accentColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Save Interface Customization</button>
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
            <span style={{ fontWeight: '500', fontSize: '14px' }}>{notification.message}</span>
          </div>
        )}

        {activeTab === 'connection' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Cloud Dashboard API Sync Box */}
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                  <Cloud size={20} color="var(--primary)" /> Cloud Dashboard API Sync Configuration
                </h3>
                <span style={{ fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a' }}>
                  {cloudSyncStatus?.status === 'connected' ? 'LIVE SYNC ACTIVE' : 'READY TO CONNECT'}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Cloud Dashboard URL
                </label>
                <input
                  type="text"
                  value={cloudDashboardUrl}
                  onChange={(e) => setCloudDashboardUrl(e.target.value)}
                  placeholder="https://tyde-dashboard-tan.vercel.app"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600', background: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Cloud API Key (From your Vercel Dashboard → API & Settings tab)
                </label>
                <input
                  type="text"
                  value={cloudApiKey}
                  onChange={(e) => setCloudApiKey(e.target.value)}
                  placeholder="Paste key here (e.g. tyde_live_...)"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700', fontFamily: 'monospace', background: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                  {cloudSyncStatus?.lastSyncAt ? `Last Synced: ${new Date(cloudSyncStatus.lastSyncAt).toLocaleString()}` : 'Enter your API key and click Save & Sync Now'}
                </div>
                <button
                  onClick={handleSaveCloudSyncConfig}
                  disabled={syncingCloud}
                  style={{ padding: '12px 24px', borderRadius: '10px', background: 'var(--primary)', color: 'white', fontWeight: '600', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Cloud size={16} /> {syncingCloud ? 'Syncing...' : 'Save & Sync Now'}
                </button>
              </div>
            </div>

            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                   <Wifi size={20} color={isConnected ? '#10b981' : '#64748b'} /> Global Backend Configuration
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444' }}></div>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: isConnected ? '#10b981' : '#dc2626' }}>
                    {isConnected ? 'LIVE CONNECTION' : 'DISCONNECTED'}
                  </span>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', margin: 0 }}>Connection Stats</h4>
                  <button
                    onClick={onOpenDiagnostics}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#0f172a', color: '#38bdf8', border: '1px solid #334155', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    <Zap size={14} color="#38bdf8" /> Open System Diagnostics & Logs
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                   <div style={{ fontSize: '12px', color: '#64748b' }}>WebSocket Status: <b style={{ color: isConnected ? '#10b981' : '#dc2626' }}>{isConnected ? 'Active' : 'Idle'}</b></div>
                   <div style={{ fontSize: '12px', color: '#64748b' }}>Project Base Endpoint: <b>{BASE_URL}</b></div>
                </div>
              </div>

              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>Cloud Data Restoration</h4>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Fetch missing menus and tables straight from the cloud system.</p>
                <button 
                  onClick={onRestoreData} 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'white', fontWeight: '600', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
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
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                   <Percent size={20} color="var(--primary)" /> Global Taxes & Charges
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Default Rules</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* GST Settings */}
                <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                   <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '16px' }}>GST Configuration</h4>
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
                   <h4 style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '16px' }}>Service Charge</h4>
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

              <button onClick={handleSave} style={{ alignSelf: 'flex-start', padding: '12px 24px', background: localSettings.accentColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Save Tax Rules</button>
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                  <Smartphone size={20} color="var(--primary)" /> Linked Captain Terminals
                </h3>
                <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '12px', color: '#64748b', fontWeight: '500' }}>{devices.length} Total</span>
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
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{device.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {device.id} • Seen: {new Date(device.created_at).toLocaleTimeString()}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ 
                          fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '6px',
                          background: device.status === 'APPROVED' ? '#dcfce7' : device.status === 'BLOCKED' ? '#fee2e2' : '#fef9c3',
                          color: device.status === 'APPROVED' ? '#166534' : device.status === 'BLOCKED' ? '#991b1b' : '#854d0e'
                        }}>
                          {device.status}
                        </span>
                        
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {device.status !== 'APPROVED' && (
                             <button onClick={() => onUpdateDeviceStatus(device.id, 'APPROVED')} style={{ height: '32px', padding: '0 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Approve</button>
                          )}
                          {device.status !== 'BLOCKED' && (
                             <button onClick={() => onUpdateDeviceStatus(device.id, 'BLOCKED')} style={{ height: '32px', padding: '0 12px', background: 'white', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Block</button>
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

        {activeTab === 'security' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                <Shield size={20} color="#0ea5e9" /> Data Security & Privacy
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>Enable PIN Lock</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Require a PIN to access Dashboard, Settlement, and Reports.</div>
                </div>
                <button 
                  onClick={() => {
                    const next = !localSettings.securityEnabled;
                    setLocalSettings(prev => ({ ...prev, securityEnabled: next }));
                    if (next && !localSettings.securityPin) {
                      setLocalSettings(prev => ({ ...prev, securityPin: '0000' }));
                    }
                  }}
                  style={{ width: '50px', height: '26px', borderRadius: '13px', background: localSettings.securityEnabled ? localSettings.accentColor : '#cbd5e1', border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ position: 'absolute', top: '3px', left: localSettings.securityEnabled ? '27px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></div>
                </button>
              </div>

              {localSettings.securityEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fade-in 0.3s' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Security PIN (4 Digits)</label>
                      <input 
                        type="text" 
                        maxLength={4}
                        name="securityPin" 
                        value={localSettings.securityPin || ''} 
                        onChange={handleChange}
                        placeholder="0000"
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '18px', fontWeight: '600', letterSpacing: '4px', textAlign: 'center' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Recovery Mobile Number</label>
                      <input 
                        type="text" 
                        name="securityPhone" 
                        value={localSettings.securityPhone || ''} 
                        onChange={handleChange}
                        placeholder="For PIN recovery"
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ padding: '14px', background: '#fff9db', borderRadius: '10px', border: '1px solid #f9eb95', display: 'flex', gap: '12px' }}>
                    <AlertTriangle size={20} color="#f59f00" />
                    <div style={{ fontSize: '12px', color: '#856404' }}>
                      <strong>Important:</strong> If you forget your PIN, you can reset it using the recovery number. Keep the recovery number active.
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleSave} style={{ marginTop: '10px', padding: '14px', background: localSettings.accentColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Update Security Settings</button>
            </div>
            
            {/* CAPTAIN APP SECURITY */}
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wifi size={20} /> Captain App Security
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>Require Captain App PIN</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Waiters must enter a PIN to access the table network.</div>
                </div>
                <button 
                  onClick={() => {
                    const next = !localSettings.captainSecurityEnabled;
                    setLocalSettings(prev => ({ ...prev, captainSecurityEnabled: next }));
                    if (next && !localSettings.captainSecurityPin) {
                      setLocalSettings(prev => ({ ...prev, captainSecurityPin: '1234' }));
                    }
                  }}
                  style={{ width: '50px', height: '26px', borderRadius: '13px', background: localSettings.captainSecurityEnabled ? localSettings.accentColor : '#cbd5e1', border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ position: 'absolute', top: '3px', left: localSettings.captainSecurityEnabled ? '27px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></div>
                </button>
              </div>

              {localSettings.captainSecurityEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fade-in 0.3s' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Captain PIN (4-6 Digits)</label>
                      <input 
                        type="text" 
                        maxLength={6}
                        name="captainSecurityPin" 
                        value={localSettings.captainSecurityPin || ''} 
                        onChange={handleChange}
                        placeholder="1234"
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '18px', fontWeight: '600', letterSpacing: '4px', textAlign: 'center' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ padding: '14px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', display: 'flex', gap: '12px', flex: 1 }}>
                        <Lock size={20} color="#3b82f6" />
                        <div style={{ fontSize: '12px', color: '#1e40af' }}>
                          This PIN is independent from the main POS security. Give this PIN to your floor staff.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleSave} style={{ marginTop: '10px', padding: '14px', background: localSettings.accentColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Update Captain Security</button>
            </div>

            {/* CAPTAIN PRO SECURITY */}
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#821a1d' }}>
                <Zap size={20} color="#821a1d" /> Captain Pro (Service Floor Mode)
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>Enable Captain Pro Mode</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Allows remote billing, settlement, and table clearing from Captain App.</div>
                </div>
                <button 
                  onClick={() => {
                    const next = !Boolean(localSettings?.captainProEnabled);
                    setLocalSettings(prev => ({ ...prev, captainProEnabled: next }));
                    if (next && !localSettings?.captainProPin) {
                      setLocalSettings(prev => ({ ...prev, captainProPin: '0000' }));
                    }
                  }}
                  style={{ width: '50px', height: '26px', borderRadius: '13px', background: localSettings?.captainProEnabled ? '#821a1d' : '#cbd5e1', border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ position: 'absolute', top: '3px', left: localSettings?.captainProEnabled ? '27px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></div>
                </button>
              </div>

              {Boolean(localSettings?.captainProEnabled) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fade-in 0.3s' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Pro Mode PIN (4-6 Digits)</label>
                      <input 
                        type="text" 
                        maxLength={6}
                        name="captainProPin" 
                        value={localSettings?.captainProPin || '0000'} 
                        onChange={handleChange}
                        placeholder="0000"
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '18px', fontWeight: '600', letterSpacing: '4px', textAlign: 'center' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ padding: '14px', background: '#fff7ed', borderRadius: '10px', border: '1px solid #ffedd5', display: 'flex', gap: '12px', flex: 1 }}>
                        <Shield size={20} color="#f97316" />
                        <div style={{ fontSize: '12px', color: '#9a3412' }}>
                          Give this PIN only to Senior Captains. It allows final billing and settlement of tables.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleSave} style={{ marginTop: '10px', padding: '14px', background: '#821a1d', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Update Pro Security</button>
            </div>

          </div>
        )}

        {activeTab === 'system' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} /> Danger Zone: Data Management
              </h3>
              
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Software Version</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{appVersion?.version || 'v1.0-stable'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Last Official Update</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{appVersion?.lastUpdated || '2026-04-19'}</div>
                  </div>
                </div>
                {appVersion?.notes && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b', fontStyle: 'italic', paddingBottom: appVersion?.history ? '12px' : '0', borderBottom: appVersion?.history ? '1px solid #e2e8f0' : 'none' }}>
                    Note: {appVersion.notes}
                  </div>
                )}
                {appVersion?.history && appVersion.history.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '13px', color: '#334155', fontWeight: '500', marginBottom: '8px' }}>Version History</div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {appVersion.history.map((hist, idx) => (
                        <div key={idx} style={{ padding: '8px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#1e293b' }}>{hist.version}</span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{hist.date}</span>
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
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#991b1b', marginBottom: '4px' }}>Clear Analytics & History</div>
                  <div style={{ fontSize: '11px', color: '#b91c1c', marginBottom: '12px', opacity: 0.8 }}>Wipe all past orders. Active orders will remain.</div>
                  <button onClick={onClearHistory} style={{ width: '100%', padding: '10px', background: 'white', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Clear All Orders</button>
                </div>
                <div style={{ padding: '16px', background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#991b1b', marginBottom: '4px' }}>WIPE ENTIRE SYSTEM</div>
                  <div style={{ fontSize: '11px', color: '#b91c1c', marginBottom: '12px', opacity: 0.8 }}>Factory reset everything! This cannot be undone.</div>
                  <button onClick={onFullReset} style={{ width: '100%', padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>ERASE ALL DATA</button>
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
    <div className="view-container no-scrollbar">
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
            <Printer size={24} color="#64748b" /> Hardware Receipt Configuration
          </h2>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Bill Header (Text Logo)</label>
            <input type="text" name="billHeader" value={localSettings.billHeader} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#111827' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Bill Footer Message</label>
            <input type="text" name="billFooter" value={localSettings.billFooter} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#111827' }} />
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>Separate KOT by Station</div>
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

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Custom KOT Stations</label>
              <button onClick={() => {
                const name = window.prompt("Enter new Station Name (e.g. Beverages, Pizza):");
                if (name) {
                  setLocalSettings(prev => ({
                    ...prev,
                    printerStations: [...(prev.printerStations || []), { id: Date.now().toString(), name, categories: [] }]
                  }));
                }
              }} style={{ padding: '6px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>+ Add Station</button>
            </div>

            <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>Group categories into stations. Any category not assigned to a station will print together as "Main Kitchen".</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(localSettings.printerStations || []).map(station => (
                <div key={station.id} style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>{station.name}</div>
                    <button onClick={() => {
                      if (window.confirm('Remove this station?')) {
                        setLocalSettings(prev => ({ ...prev, printerStations: prev.printerStations.filter(s => s.id !== station.id) }));
                      }
                    }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Remove</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {categories.map(cat => {
                      const name = typeof cat === 'object' ? cat.name : cat;
                      const isSelected = station.categories.includes(name);
                      return (
                        <label key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', border: `1px solid ${isSelected ? 'var(--primary)' : '#cbd5e1'}`, padding: '4px 10px', borderRadius: '20px', background: isSelected ? 'var(--primary)' : 'white', color: isSelected ? 'white' : '#475569', cursor: 'pointer', transition: 'all 0.2s' }}>
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

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#334155', marginBottom: '12px' }}>Print Typography</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <select name="printFontFamily" value={localSettings.printFontFamily} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontSize: '12px', color: '#111827' }}>
                <option value="Helvetica, Arial, sans-serif">Sans-Serif</option>
                <option value="'Courier New', Courier, monospace">Monospace</option>
              </select>
              <input type="number" name="printFontSize" value={localSettings.printFontSize} onChange={handleChange} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#111827' }} />
            </div>
          </div>

          <button onClick={handleSave} style={{ marginTop: '20px', padding: '14px', background: localSettings.accentColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', boxShadow: `0 4px 6px -1px ${localSettings.accentColor}30` }}>
            Save Printer Configurations
          </button>
        </div>
      </div>
    </div>
  );
};

const ShiftHistoryView = ({ history, onClose }) => {
  return (
    <div style={{ padding: '24px', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minHeight: '300px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>Active Table Shifts</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
      </div>
      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          No active table shifts for running orders.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {history.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontWeight: '500', color: '#1e293b' }}>Table {s.from}</span>
                <span style={{ margin: '0 12px', color: '#94a3b8' }}>➔</span>
                <span style={{ fontWeight: '500', color: '#10b981' }}>Table {s.to}</span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ServiceFloor = ({ tables, floorPlanSections, onSelectTable, onClearTable, settings, onQuickSettle, onQuickPrint, globalSearch, onViewChange, onOpenFloorDesigner, tableToClear, setTableToClear, shiftHistory }) => {
  const [showShiftHistory, setShowShiftHistory] = useState(false);

  console.log("ServiceFloor Tables:", tables.map(t => ({ id: t.id, status: t.status, total: t.total, items: t.orders?.length })));
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("serviceFloorViewMode") || 'grid');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStats, setShowStats] = useState(false);
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
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px', background: 'linear-gradient(180deg, #f8fafc 0%, #fff7ed 100%)' }} className="no-scrollbar">

      {showStats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '24px' }}>
          <StatCard label="Occupancy" value={`${occupancyRate}%`} icon={LayoutGrid} color="#f97316" subtext={`${occupiedTables.length}/${tables.length} tables active`} />
          <StatCard label="Open Tickets" value={formatCurrency(openRevenue)} icon={CreditCard} color="#94161c" subtext={`Avg open bill ${formatCurrency(avgOpenTicket)}`} />
          <StatCard label="Ready To Settle" value={printedTables.length} icon={CheckSquare} color="#10b981" subtext="Printed bills awaiting payment" />
          <StatCard label="Delayed Tables" value={delayedTables.length} icon={AlertTriangle} color="#f59e0b" subtext="Orders older than 45 minutes" />
        </div>
      )}

      {/* Service Floor Header & Control Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {/* Row 1: Title, Stats Toggle & Floor Management Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', letterSpacing: '-0.5px', margin: 0 }}>
              Service Floor
            </h2>
            <button
              onClick={() => setShowStats(s => !s)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '600', padding: '5px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', background: showStats ? '#fff7ed' : 'white', color: showStats ? '#f97316' : '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <BarChart3 size={13} />
              {showStats ? 'Hide Stats' : 'Show Stats'}
              {showStats ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowShiftHistory(true)}
              style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#111827', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowRightLeft size={15} /> Shift History
            </button>
            <button
              onClick={onOpenFloorDesigner}
              style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#111827', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LayoutGrid size={15} /> Edit Floor Plan
            </button>

            <div style={{ display: 'flex', gap: '14px', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', paddingLeft: '8px', borderLeft: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '3px' }}></div> Vacant</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#fed7aa', borderRadius: '3px' }}></div> Running</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#bbf7d0', borderRadius: '3px' }}></div> Printed</div>
            </div>
          </div>
        </div>

        {/* Row 2: View Mode Switcher, Status Filters & Zoom Slider Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* View Mode Segmented Control */}
            <div style={{ display: 'flex', gap: '4px', background: 'white', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              {['map', 'grid', 'table'].map(mode => (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode);
                    localStorage.setItem("serviceFloorViewMode", mode);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === mode ? '#94161c' : 'transparent',
                    color: viewMode === mode ? 'white' : '#64748b',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {mode === 'map' ? 'Map View' : mode === 'grid' ? 'Grid' : 'Table View'}
                </button>
              ))}
            </div>

            <div style={{ width: '1px', height: '24px', background: '#cbd5e1' }} />

            {/* Status Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {statusFilters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: statusFilter === filter.id ? '1px solid #fecaca' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    background: statusFilter === filter.id ? '#fff1f2' : 'white',
                    color: statusFilter === filter.id ? '#9f1239' : '#64748b',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Zoom Slider (Only in Map mode) */}
          {viewMode === 'map' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'white', padding: '5px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zoom: {zoom}%</span>
              <input 
                type="range"
                min="10"
                max="150"
                step="5"
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ cursor: 'pointer', width: '90px', accentColor: '#94161c' }}
              />
            </div>
          )}
        </div>
      </div>

      {activeSections.map(section => (
        <div key={section} style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            {section} SECTION
          </h2>

          {viewMode === 'map' ? (
            <div style={{
              position: 'relative', 
              height: `${Math.min(750, 1300 * (zoom / 100) + 48)}px`, 
              background: '#ffffff', 
              borderRadius: '20px', 
              border: '1px solid #e2e8f0', 
              overflow: 'auto',
              backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)', 
              backgroundSize: '24px 24px', 
              padding: '24px'
            }}>
              <div style={{
                width: `${1900 * (zoom / 100)}px`,
                height: `${1300 * (zoom / 100)}px`,
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{ 
                  transform: `scale(${zoom / 100})`, 
                  transformOrigin: "top left",
                  width: '1900px',
                  height: '1300px',
                  position: 'absolute',
                  left: 0,
                  top: 0
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
                        width: '160px',
                        height: '175px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '12px 12px 10px 12px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Top Row: Table Name & Compact Timer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.4px' }}>Table</div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {table.name.replace('Table ', '')}
                          </div>
                        </div>
                        {isRunning && (
                          <div style={{ flexShrink: 0 }}>
                             <TimeElapsed createdAt={table.createdAt} />
                          </div>
                        )}
                      </div>

                      {/* Middle: Status & Price */}
                      <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2px 0' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: isRunning ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
                          {table.status === 'draft' ? '🔵 DRAFT' : 
                           (table.status === 'kot_pending' || table.status === 'kot_printed' || table.status === 'occupied') ? '🟡 RUNNING' : 
                           (table.status === 'billing' || table.status === 'printed') ? '🟢 BILLING' : '○ VACANT'}
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: isRunning ? 'var(--primary)' : '#e2e8f0', margin: '2px 0', lineHeight: 1 }}>
                          {tableTotal > 0 ? `₹${Math.ceil(tableTotal)}` : '--'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', marginTop: '2px' }}>
                          {isRunning ? `${(table.items?.length || table.orders?.length || 0)} items` : 'No items'}
                        </div>
                      </div>

                      {/* Bottom: Action Row */}
                      {isRunning && (
                         <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: '1px solid rgba(0,0,0,0.06)', width: '100%', justifyContent: 'center', marginTop: 'auto' }}>
                           <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); onQuickPrint(table); }} title="Print KOT" style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 4px', borderRadius: '10px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><Printer size={15} color="#64748b" /></button>
                           <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); onQuickSettle(table); }} title="Settle Bill" style={{ flex: 1, background: '#111827', border: 'none', padding: '6px 4px', borderRadius: '10px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><CheckSquare size={15} color="white" /></button>
                           <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); setTableToClear(table.id); }} title="Discard" style={{ flex: 1, background: '#fff1f2', border: 'none', padding: '6px 4px', borderRadius: '10px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><Trash2 size={15} color="#ef4444" /></button>
                         </div>
                      )}
                    </div>
                  );
                })}

                </div>
              </div>
            </div>

          ) : viewMode === 'grid' ? (
            <div className="pp-table-grid no-scrollbar">
              {filteredTables.filter(t => t.type === section).map(table => {
                const tableTotal = table.total || 0;
                const isRunning = table.status !== 'vacant';
                
                return (
                  <div
                    key={table.id}
                    onClick={() => onSelectTable(table)}
                    className={`pp-table-card status-${table.status || 'blank'}`}
                    style={{
                      height: '175px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '12px 12px 10px 12px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Top Row: Table Name & Compact Timer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.4px' }}>Table</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2px 0' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: isRunning ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
                        {table.status === 'draft' ? '🔵 DRAFT' : 
                         (table.status === 'kot_pending' || table.status === 'kot_printed' || table.status === 'occupied') ? '🟡 RUNNING' : 
                         (table.status === 'billing' || table.status === 'printed') ? '🟢 BILLING' : '○ VACANT'}
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: isRunning ? 'var(--primary)' : '#e2e8f0', margin: '2px 0', lineHeight: 1 }}>
                        {tableTotal > 0 ? `₹${Math.ceil(tableTotal)}` : '--'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', marginTop: '2px' }}>
                        {isRunning ? `${table.orders?.length || 0} items` : 'No items'}
                      </div>
                    </div>

                    {/* Bottom: Action Row */}
                    {isRunning && (
                       <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: '1px solid rgba(0,0,0,0.06)', width: '100%', justifyContent: 'center', marginTop: 'auto' }}>
                         <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); onQuickPrint(table); }} title="Print KOT" style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 4px', borderRadius: '10px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><Printer size={15} color="#64748b" /></button>
                         <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); onQuickSettle(table); }} title="Settle Bill" style={{ flex: 1, background: '#111827', border: 'none', padding: '6px 4px', borderRadius: '10px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><CheckSquare size={15} color="white" /></button>
                         <button disabled={!IS_LOCAL} onClick={(e) => { e.stopPropagation(); setTableToClear(table.id); }} title="Discard" style={{ flex: 1, background: '#fff1f2', border: 'none', padding: '6px 4px', borderRadius: '10px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: IS_LOCAL ? 1 : 0.5 }}><Trash2 size={15} color="#ef4444" /></button>
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Table Name</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Capacity</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Running Time</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '500', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Items</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '500', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Total</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '500', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTables.filter(t => t.type === section).map(table => {
                    const tableTotal = table.total || 0;
                    const isRunning = table.status !== 'vacant';
                    const isPrinted = table.status === 'billing';

                    return (
                      <tr 
                        key={table.id}
                        onClick={() => onSelectTable(table)}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                            {table.name.replace('Table ', '')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: '#64748b' }}>
                          {table.seats || 4} Pax
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            background: table.status === 'draft' ? '#eff6ff' : 
                                        isPrinted ? '#dcfce7' : 
                                        isRunning ? '#ffedd5' : '#f1f5f9',
                            color: table.status === 'draft' ? '#1d4ed8' : 
                                   isPrinted ? '#15803d' : 
                                   isRunning ? '#c2410c' : '#475569'
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: table.status === 'draft' ? '#1d4ed8' : 
                                          isPrinted ? '#15803d' : 
                                          isRunning ? '#c2410c' : '#475569'
                            }} />
                            {table.status === 'draft' ? 'Draft' : 
                             isPrinted ? 'Ready to Bill' : 
                             isRunning ? 'Running' : 'Vacant'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569', fontWeight: '700' }}>
                          {isRunning ? <TimeElapsed createdAt={table.createdAt} /> : '--'}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '13px', color: '#64748b', fontWeight: '700' }}>
                          {isRunning ? `${table.orders?.length || 0} items` : '--'}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: '700', color: isRunning ? 'var(--primary)' : '#94a3b8' }}>
                          {tableTotal > 0 ? `₹${Math.ceil(tableTotal)}` : '--'}
                        </td>
                        <td style={{ padding: '10px 20px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {isRunning ? (
                              <>
                                <button disabled={!IS_LOCAL} onClick={() => onQuickPrint(table)} title="Print KOT" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', opacity: IS_LOCAL ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94161c'; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                ><Printer size={14} color="#64748b" /><span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>KOT</span></button>
                                <button disabled={!IS_LOCAL} onClick={() => onQuickSettle(table)} title="Settle Bill" style={{ background: '#111827', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', opacity: IS_LOCAL ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#1e293b'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
                                ><CheckSquare size={14} color="white" /><span style={{ fontSize: '11px', fontWeight: '600', color: 'white' }}>Settle</span></button>
                                <button disabled={!IS_LOCAL} onClick={() => setTableToClear(table.id)} title="Discard" style={{ background: '#fff1f2', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: IS_LOCAL ? 'pointer' : 'not-allowed', opacity: IS_LOCAL ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#ffe4e6'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; }}
                                ><Trash2 size={14} color="#ef4444" /><span style={{ fontSize: '11px', fontWeight: '600', color: '#ef4444' }}>Clear</span></button>
                              </>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>--</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      ))}
      {showShiftHistory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ width: '400px' }}>
             <ShiftHistoryView history={shiftHistory} onClose={() => setShowShiftHistory(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

/* --- KITCHEN DISPLAY SYSTEM (Industry Grade) --- */
const KitchenDisplay = () => {
  const PIPELINE = ['NEW', 'PREPARING', 'READY'];
  const [tickets, setTickets] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, total: 0 });
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('pipeline'); // pipeline | history
  const [lastTicketCount, setLastTicketCount] = useState(0);
  const audioRef = useRef(null);
  const prevTicketIdsRef = useRef(new Set());

  const loadTickets = async () => {
    try {
      const data = await apiService.fetchKdsTickets();
      const newTickets = data || [];
      
      // Audio alert for NEW incoming tickets
      const newIds = new Set(newTickets.map(t => t.id));
      const prevIds = prevTicketIdsRef.current;
      const hasNewTicket = newTickets.some(t => !prevIds.has(t.id) && t.status === 'NEW');
      if (hasNewTicket && prevIds.size > 0) {
        playAlert();
      }
      prevTicketIdsRef.current = newIds;
      
      setTickets(newTickets);
    } catch (e) {
      console.error('Failed to load KDS tickets', e);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiService.fetchKdsStats();
      setStats(data || { active: 0, completed: 0, total: 0 });
    } catch (e) { console.error(e); }
  };

  const loadHistory = async () => {
    try {
      const data = await apiService.fetchAllKdsTickets();
      setAllTickets(data || []);
    } catch (e) { console.error(e); }
  };

  const playAlert = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Play 3 short beeps
      [0, 0.15, 0.30].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.1);
      });
    } catch (e) { /* audio not available */ }
  };

  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState('ALL');

  useEffect(() => {
    loadTickets();
    loadStats();
    
    // Load stations strictly from printer settings via backend config
    apiService.fetchConfig('pos_settings').then((settings) => {
      let loadedStations = [];
      if (settings && settings.printerStations && Array.isArray(settings.printerStations) && settings.printerStations.length > 0) {
        loadedStations = settings.printerStations;
      }
      setStations(loadedStations);
    }).catch(e => console.error("Failed to load stations", e));

    const timerInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerInterval);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const kdsSocket = io(BASE_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling']
    });

    kdsSocket.on('kds_updated', () => { 
      loadTickets(); 
      loadStats(); 
      if (activeTabRef.current === 'history') loadHistory(); 
    });

    return () => kdsSocket.disconnect();
  }, []);

  const handleUpdateStatus = async (id, nextStatus) => {
    // Optimistic update
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
    try {
      await apiService.updateKdsTicket(id, nextStatus);
      loadStats();
    } catch (e) {
      console.error(e);
      loadTickets(); // revert on error
    }
  };

  const handleItemStatus = async (ticketId, originalIndex, newStatus) => {
    // Optimistic update using the original index
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t;
      const updatedItems = t.items.map((item, idx) => idx === originalIndex ? { ...item, itemStatus: newStatus } : item);
      const allStatuses = updatedItems.map(i => i.itemStatus || 'NEW');
      let derived = 'NEW';
      if (allStatuses.every(s => s === 'SERVED')) derived = 'SERVED';
      else if (allStatuses.every(s => s === 'READY' || s === 'SERVED')) derived = 'READY';
      else if (allStatuses.some(s => s === 'PREPARING' || s === 'READY' || s === 'SERVED')) derived = 'PREPARING';
      return { ...t, items: updatedItems, status: derived };
    }));
    try {
      await apiService.updateKdsItemStatus(ticketId, originalIndex, newStatus);
      loadStats();
    } catch (e) {
      console.error(e);
      loadTickets();
    }
  };

  const handleRecall = async (id) => {
    try {
      await apiService.updateKdsTicket(id, 'NEW');
      loadTickets();
      loadStats();
      if (activeTab === 'history') loadHistory();
    } catch (e) { console.error(e); }
  };

  const getWaitMins = (createdAt) => (now - new Date(createdAt).getTime()) / 60000;

  const getUrgencyColor = (createdAt) => {
    const m = getWaitMins(createdAt);
    if (m > 20) return { bg: '#991b1b', border: '#dc2626', text: '#fca5a5', pulse: true };
    if (m > 15) return { bg: '#9a3412', border: '#ea580c', text: '#fdba74', pulse: true };
    if (m > 10) return { bg: '#854d0e', border: '#d97706', text: '#fcd34d', pulse: false };
    return { bg: '#166534', border: '#16a34a', text: '#86efac', pulse: false };
  };

  const formatWaitTime = (createdAt) => {
    const diffSecs = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
    const m = Math.floor(diffSecs / 60);
    const s = diffSecs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Pre-filter tickets based on selected station
  const filteredTickets = tickets.map(t => {
    // Attach original index for safe updates
    const itemsWithIndex = (t.items || []).map((item, index) => ({ ...item, originalIndex: index }));
    
    let stationItems = itemsWithIndex;
    if (selectedStation !== 'ALL') {
      const stationConfig = stations.find(s => s.name === selectedStation);
      if (stationConfig && stationConfig.categories) {
        stationItems = itemsWithIndex.filter(item => {
          const cat = typeof item.category === 'object' ? item.category.name : item.category;
          return stationConfig.categories.includes(cat);
        });
      }
    }
    
    // Filter out SERVED items — they're done and should vanish from the KDS
    const activeItems = stationItems.filter(i => (i.itemStatus || 'NEW') !== 'SERVED');
    
    // Hide ticket if it has no active items for this station
    if (activeItems.length === 0) return null;
    
    return { ...t, items: activeItems };
  }).filter(Boolean);

  // Group and split tickets by status for columns
  const kdsCards = [];
  filteredTickets.forEach(t => {
    const newItems = t.items.filter(i => (i.itemStatus || 'NEW') === 'NEW');
    const preparingItems = t.items.filter(i => i.itemStatus === 'PREPARING');
    const readyItems = t.items.filter(i => i.itemStatus === 'READY');

    if (newItems.length > 0) {
      kdsCards.push({
        ...t,
        id: `${t.id}-NEW`,
        originalId: t.id,
        items: newItems,
        localStatus: 'NEW'
      });
    }
    if (preparingItems.length > 0) {
      kdsCards.push({
        ...t,
        id: `${t.id}-PREPARING`,
        originalId: t.id,
        items: preparingItems,
        localStatus: 'PREPARING'
      });
    }
    if (readyItems.length > 0) {
      kdsCards.push({
        ...t,
        id: `${t.id}-READY`,
        originalId: t.id,
        items: readyItems,
        localStatus: 'READY'
      });
    }
  });

  // Batch summary: aggregate all visible items across all tickets
  const batchSummary = useMemo(() => {
    const map = {};
    filteredTickets.forEach(t => {
      (t.items || []).forEach(item => {
        const key = item.name;
        const qty = Number(item.qty || item.quantity || 1);
        const st = item.itemStatus || 'NEW';
        if (!map[key]) map[key] = { name: key, NEW: 0, PREPARING: 0, READY: 0, totalQty: 0, entries: [] };
        map[key][st] = (map[key][st] || 0) + qty;
        map[key].totalQty += qty;
        map[key].entries.push({ ticketId: t.id, originalIndex: item.originalIndex, itemStatus: st, qty });
      });
    });
    return Object.values(map).sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredTickets]);

  const avgWait = () => {
    const activeTickets = filteredTickets;
    if (activeTickets.length === 0) return '0:00';
    const totalSecs = activeTickets.reduce((acc, t) => acc + Math.floor((now - new Date(t.created_at).getTime()) / 1000), 0);
    const avgSecs = Math.floor(totalSecs / activeTickets.length);
    return `${Math.floor(avgSecs / 60)}:${String(avgSecs % 60).padStart(2, '0')}`;
  };

  const overdueCount = filteredTickets.filter(t => getWaitMins(t.created_at) > 15).length;

  // Column data uses localStatus from split kdsCards
  const newTickets = kdsCards.filter(t => t.localStatus === 'NEW');
  const preparingTickets = kdsCards.filter(t => t.localStatus === 'PREPARING');
  const readyTickets = kdsCards.filter(t => t.localStatus === 'READY');

  const columnConfig = [
    { key: 'NEW', label: 'INCOMING', icon: '🔴', color: '#dc2626', items: newTickets, nextAction: 'START COOKING', nextStatus: 'PREPARING' },
    { key: 'PREPARING', label: 'COOKING', icon: '🔥', color: '#ea580c', items: preparingTickets, nextAction: 'READY TO SERVE', nextStatus: 'READY' },
    { key: 'READY', label: 'READY', icon: '✅', color: '#16a34a', items: readyTickets, nextAction: null, nextStatus: null },
  ];

  const renderTicketCard = (ticket, nextAction, nextStatus) => {
    const urgency = getUrgencyColor(ticket.created_at);
    const isOverdue = getWaitMins(ticket.created_at) > 15;
    const tStatus = ticket.localStatus || ticket.status || 'NEW';
    
    return (
      <div key={ticket.id} style={{
        background: 'linear-gradient(145deg, #1e293b 0%, #172033 100%)',
        borderRadius: 'clamp(10px, 1vw, 16px)',
        border: `2px solid ${urgency.border}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
        animation: urgency.pulse ? 'pulse 2s infinite' : 'slideIn 0.3s ease-out',
        transition: 'all 0.3s ease',
        flexShrink: 0
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${urgency.bg} 0%, ${urgency.bg}dd 100%)`,
          padding: 'clamp(8px, 1vw, 14px) clamp(12px, 1.2vw, 18px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${urgency.border}40`
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '2px' }}>
              TABLE {ticket.table_number || '—'}
            </div>
            <div style={{ fontWeight: '700', fontSize: 'clamp(13px, 1.1vw, 16px)', color: 'white', letterSpacing: '-0.3px' }}>
              KOT #{String(ticket.originalId || ticket.id).padStart(4, '0')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 'clamp(16px, 1.5vw, 22px)',
              fontWeight: '700',
              fontFamily: "'JetBrains Mono', monospace",
              color: urgency.text,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Clock size={15} />
              {formatWaitTime(ticket.created_at)}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>
              {formatTime(ticket.created_at)}
            </div>
          </div>
        </div>

        {/* Items with per-item controls */}
        <div style={{ padding: 'clamp(4px, 0.5vw, 8px) clamp(8px, 1vw, 14px)', flex: 1 }}>
          {(ticket.items || []).map((item, idx) => {
            const origIdx = item.originalIndex != null ? item.originalIndex : idx;
            const iStatus = item.itemStatus || 'NEW';
            const iColor = iStatus === 'READY' ? '#22c55e' : iStatus === 'PREPARING' ? '#f97316' : '#94a3b8';
            const nextItemStatus = iStatus === 'NEW' ? 'PREPARING' : iStatus === 'PREPARING' ? 'READY' : null;
            
            return (
              <div key={origIdx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 8px',
                margin: '2px 0',
                borderRadius: '10px',
                background: iStatus === 'READY' ? 'rgba(34,197,94,0.06)' : iStatus === 'PREPARING' ? 'rgba(249,115,22,0.06)' : 'transparent',
                borderBottom: idx < ticket.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                opacity: iStatus === 'READY' ? 0.55 : 1,
                transition: 'all 0.25s ease'
              }}>
                {/* Item status indicator */}
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: iColor, flexShrink: 0,
                  boxShadow: `0 0 8px ${iColor}80`,
                  transition: 'all 0.3s ease'
                }} />
                
                {/* Item name + comment */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: '600', fontSize: '14px', color: '#f1f5f9',
                    textDecoration: iStatus === 'READY' ? 'line-through' : 'none',
                    textDecorationColor: 'rgba(255,255,255,0.3)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {item.name}
                  </div>
                  {(item.notes || item.comment) && (
                    <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: '500', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MessageSquare size={10} /> {item.notes || item.comment}
                    </div>
                  )}
                </div>
                
                {/* Qty badge */}
                <div style={{
                  fontSize: '14px', fontWeight: '600', color: '#fbbf24',
                  background: 'rgba(251,191,36,0.12)', padding: '4px 10px',
                  borderRadius: '8px', minWidth: '36px', textAlign: 'center',
                  border: '1px solid rgba(251,191,36,0.15)'
                }}>
                  ×{item.qty || item.quantity || 1}
                </div>

                {/* Per-item action button */}
                {nextItemStatus && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleItemStatus(ticket.originalId || ticket.id, origIdx, nextItemStatus); }}
                    style={{
                      background: nextItemStatus === 'PREPARING'
                        ? 'linear-gradient(135deg, #ea580c, #dc2626)'
                        : 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: 'white', border: 'none', borderRadius: '10px',
                      padding: '8px 14px', fontSize: '11px', fontWeight: '600',
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
                      whiteSpace: 'nowrap', transition: 'all 0.2s',
                      boxShadow: nextItemStatus === 'PREPARING'
                        ? '0 4px 12px rgba(234,88,12,0.3)'
                        : '0 4px 12px rgba(22,163,74,0.3)',
                      minWidth: '72px'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.filter = 'brightness(1.15)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'brightness(1)'; }}
                  >
                    {nextItemStatus === 'PREPARING' ? '🔥 Cook' : '✅ Done'}
                  </button>
                )}
                {iStatus === 'READY' && (
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#4ade80', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <CheckCircle size={13} /> Done
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom action bar */}
        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Bulk action: Mark all visible station items to next status */}
          {tStatus !== 'READY' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const items = ticket.items || [];
                const allNew = items.every(i => (i.itemStatus || 'NEW') === 'NEW');
                const bulkNext = allNew ? 'PREPARING' : 'READY';
                items.forEach((item) => {
                  const origIdx = item.originalIndex != null ? item.originalIndex : 0;
                  const cur = item.itemStatus || 'NEW';
                  if (cur !== 'READY') handleItemStatus(ticket.originalId || ticket.id, origIdx, bulkNext);
                });
              }}
              style={{
                flex: 1,
                background: tStatus === 'NEW'
                  ? 'linear-gradient(135deg, #ea580c, #dc2626)'
                  : 'linear-gradient(135deg, #16a34a, #059669)',
                color: 'white', border: 'none', padding: '16px',
                fontWeight: '600', fontSize: '13px', cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s',
                borderRadius: '0 0 14px 14px'
              }}
              onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
              onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
            >
              {tStatus === 'NEW' ? '🔥 Start All' : '✅ All Ready'} <ChevronDown size={16} />
            </button>
          )}
          {/* SERVED button for READY tickets — marks only visible station items as SERVED */}
          {tStatus === 'READY' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const items = ticket.items || [];
                items.forEach((item) => {
                  const origIdx = item.originalIndex != null ? item.originalIndex : 0;
                  handleItemStatus(ticket.originalId || ticket.id, origIdx, 'SERVED');
                });
              }}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: 'white', border: 'none', padding: '16px',
                fontWeight: '600', fontSize: '13px', cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s',
                borderRadius: '0 0 14px 14px',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
              onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
            >
              🍽 Mark Served
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#0f172a', color: 'white', overflow: 'hidden' }}>
      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* TOP BAR */}
      <div style={{
        padding: 'clamp(10px, 1.2vw, 16px) clamp(14px, 1.5vw, 24px)',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 1vw, 16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ChefHat size={22} color="#f87171" strokeWidth={2.5} />
            <h2 style={{ fontSize: 'clamp(16px, 1.5vw, 22px)', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Kitchen Display</h2>
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[{ key: 'pipeline', label: 'Live Queue' }, { key: 'batch', label: '📦 Batch Prep' }, { key: 'history', label: 'History' }].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: 'clamp(5px, 0.6vw, 8px) clamp(10px, 1.2vw, 20px)',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === tab.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: activeTab === tab.key ? 'white' : '#64748b',
                fontWeight: '600',
                fontSize: 'clamp(11px, 0.9vw, 13px)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>{tab.label}</button>
            ))}
          </div>
        </div>

        {/* Station Selector - Segmented Pills */}
        {stations.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '5px 8px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 4px' }}>Station</span>
            {[{ name: 'ALL', label: 'ALL' }, ...stations].map(s => {
              const isActive = selectedStation === s.name;
              const stName = s.label || String(s.name).toUpperCase();
              return (
                <button
                  key={s.name}
                  onClick={() => setSelectedStation(s.name)}
                  style={{
                    padding: 'clamp(4px, 0.5vw, 7px) clamp(8px, 1vw, 16px)',
                    borderRadius: '10px',
                    border: isActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                    background: isActive ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'transparent',
                    color: isActive ? 'white' : '#94a3b8',
                    fontWeight: '600',
                    fontSize: 'clamp(10px, 0.85vw, 12px)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: isActive ? '0 4px 12px rgba(59,130,246,0.25)' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseOver={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseOut={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >{stName}</button>
              );
            })}
          </div>
        )}

        {/* Stats Bar */}
        <div style={{ display: 'flex', gap: 'clamp(4px, 0.6vw, 12px)', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Overdue Alert */}
          {overdueCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(220,38,38,0.15)', border: '1px solid #dc2626',
              padding: '8px 14px', borderRadius: '12px',
              animation: 'pulse 1.5s infinite'
            }}>
              <AlertTriangle size={16} color="#f87171" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#fca5a5' }}>{overdueCount} OVERDUE</span>
            </div>
          )}

          {[
            { label: 'Active', value: stats.active, color: '#3b82f6' },
            { label: 'Avg Wait', value: avgWait(), color: '#f59e0b' },
            { label: 'Done Today', value: stats.completed, color: '#10b981' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: 'clamp(4px, 0.6vw, 8px) clamp(8px, 1vw, 16px)',
              borderRadius: '12px',
              textAlign: 'center',
              minWidth: 'clamp(50px, 5vw, 72px)'
            }}>
              <div style={{ fontSize: 'clamp(13px, 1.2vw, 18px)', fontWeight: '500', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 'clamp(9px, 0.7vw, 11px)', fontWeight: '500', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}

          {/* Clock */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: 'clamp(4px, 0.6vw, 8px) clamp(8px, 1vw, 16px)',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 'clamp(13px, 1.2vw, 18px)', fontWeight: '700', color: '#e2e8f0', fontFamily: 'monospace' }}>
              {new Date(now).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div style={{ fontSize: 'clamp(9px, 0.7vw, 11px)', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>CLOCK</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      {activeTab === 'pipeline' ? (
        /* ---- PIPELINE VIEW (3 Kanban Columns) ---- */
        <div style={{ flex: 1, display: 'flex', gap: '2px', overflow: 'hidden', minHeight: 0, maxHeight: '100%' }}>
          {columnConfig.map(col => (
            <div key={col.key} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255,255,255,0.02)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              overflow: 'hidden',
              minHeight: 0,
              maxHeight: '100%'
            }}>
              <div style={{
                padding: 'clamp(8px, 1vw, 14px) clamp(12px, 1.2vw, 20px)',
                background: `${col.color}15`,
                borderBottom: `2px solid ${col.color}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{col.icon}</span>
                  <span style={{ fontSize: 'clamp(12px, 0.9vw, 14px)', fontWeight: '700', color: col.color, letterSpacing: '1px' }}>{col.label}</span>
                </div>
                <div style={{
                  background: col.color,
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '14px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {col.items.length}
                </div>
              </div>

              {/* Column Body - Scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(6px, 0.8vw, 12px)', display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.8vw, 12px)' }}>
                {col.items.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#334155' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>{col.icon}</div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>No tickets</div>
                  </div>
                )}
                {col.items.map(ticket => renderTicketCard(ticket, col.nextAction, col.nextStatus))}
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'batch' ? (
        /* ---- BATCH PREP VIEW ---- */
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="no-scrollbar">
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', margin: '0 0 6px 0' }}>Batch Preparation View</h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>All items aggregated across active tickets. Change status in bulk to batch-prepare identical items.</p>
            </div>

            {batchSummary.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px', color: '#334155' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
                <div style={{ fontSize: '16px', fontWeight: '700' }}>No active items</div>
              </div>
            )}

            <div style={{ display: 'grid', gap: '10px' }}>
              {batchSummary.map(item => {
                const hasNew = item.NEW > 0;
                const hasPrep = item.PREPARING > 0;
                const hasReady = item.READY > 0;
                return (
                  <div key={item.name} style={{
                    background: 'linear-gradient(145deg, #1e293b, #172033)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    transition: 'all 0.2s'
                  }}>
                    {/* Item name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '16px', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginTop: '4px' }}>
                        Total: {item.totalQty} across {item.entries.length} orders
                      </div>
                    </div>

                    {/* Status breakdown pills */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {hasNew && (
                        <div style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid #dc2626', padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#fca5a5' }}>{item.NEW}</span>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#f87171' }}>NEW</span>
                        </div>
                      )}
                      {hasPrep && (
                        <div style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid #f97316', padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#fdba74' }}>{item.PREPARING}</span>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#fb923c' }}>COOKING</span>
                        </div>
                      )}
                      {hasReady && (
                        <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#86efac' }}>{item.READY}</span>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#4ade80' }}>READY</span>
                        </div>
                      )}
                    </div>

                    {/* Batch action buttons */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {hasNew && (
                        <button
                          onClick={() => {
                            item.entries.forEach(e => {
                              if (e.itemStatus === 'NEW') handleItemStatus(e.ticketId, e.originalIndex, 'PREPARING');
                            });
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #ea580c, #dc2626)',
                            color: 'white', border: 'none', borderRadius: '10px',
                            padding: '10px 16px', fontSize: '11px', fontWeight: '600',
                            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
                            whiteSpace: 'nowrap', transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(234,88,12,0.25)'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          🔥 Cook All {item.NEW}
                        </button>
                      )}
                      {hasPrep && (
                        <button
                          onClick={() => {
                            item.entries.forEach(e => {
                              if (e.itemStatus === 'PREPARING') handleItemStatus(e.ticketId, e.originalIndex, 'READY');
                            });
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #16a34a, #15803d)',
                            color: 'white', border: 'none', borderRadius: '10px',
                            padding: '10px 16px', fontSize: '11px', fontWeight: '600',
                            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
                            whiteSpace: 'nowrap', transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(22,163,74,0.25)'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          ✅ Ready All {item.PREPARING}
                        </button>
                      )}
                      {hasReady && (
                        <button
                          onClick={() => {
                            item.entries.forEach(e => {
                              if (e.itemStatus === 'READY') handleItemStatus(e.ticketId, e.originalIndex, 'SERVED');
                            });
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            color: 'white', border: 'none', borderRadius: '10px',
                            padding: '10px 16px', fontSize: '11px', fontWeight: '600',
                            cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
                            whiteSpace: 'nowrap', transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          🍽 Serve All {item.READY}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="no-scrollbar">
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#94a3b8', margin: 0 }}>Today's Completed Tickets</h3>
              <button onClick={loadHistory} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
                fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {allTickets.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px', color: '#334155' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontSize: '16px', fontWeight: '700' }}>No tickets today yet</div>
              </div>
            )}

            <div style={{ display: 'grid', gap: '8px' }}>
              {allTickets.map(ticket => (
                <div key={ticket.id} style={{
                  background: '#1e293b',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid rgba(255,255,255,0.06)',
                  opacity: ticket.status === 'READY' || ticket.status === 'SERVED' ? 0.7 : 1
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: ticket.status === 'NEW' ? '#dc262620' : ticket.status === 'PREPARING' ? '#ea580c20' : '#16a34a20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: ticket.status === 'NEW' ? '#f87171' : ticket.status === 'PREPARING' ? '#fb923c' : '#4ade80',
                      fontWeight: '600', fontSize: '12px'
                    }}>
                      {ticket.status === 'READY' ? '✓' : ticket.status === 'PREPARING' ? '🔥' : '●'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#e2e8f0' }}>
                        KOT #{String(ticket.id).padStart(4, '0')} — Table {ticket.table_number || '—'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        {(ticket.items || []).map(i => `${i.qty || i.quantity || 1}× ${i.name}`).join(', ')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
                        color: ticket.status === 'READY' ? '#4ade80' : ticket.status === 'PREPARING' ? '#fb923c' : '#f87171',
                        background: ticket.status === 'READY' ? '#16a34a15' : ticket.status === 'PREPARING' ? '#ea580c15' : '#dc262615',
                        padding: '4px 10px', borderRadius: '6px'
                      }}>
                        {ticket.status}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{formatTime(ticket.created_at)}</div>
                    </div>

                    {(ticket.status === 'READY' || ticket.status === 'SERVED') && (
                      <button onClick={() => handleRecall(ticket.id)} style={{
                        background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                        color: '#fbbf24', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                        fontWeight: '600', fontSize: '11px', textTransform: 'uppercase'
                      }}>
                        Recall
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NonTableManagement = ({ orders, onSelectOrder, onCreateOrder, onViewChange, onQuickSettle, onQuickPrint, onClearOrder, onCancelOrder, globalSearch, onCompleteAllPickups }) => {
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
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px', background: '#f8fafc' }} className="no-scrollbar">
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>Pickup Orders Dashboard</h2>
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
            onClick={onCompleteAllPickups}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'white',
              color: '#10b981',
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Complete All Orders
          </button>
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
              fontWeight: '600',
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
            <div style={{ color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>No matching pickup orders found.</div>
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
                     <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--primary)' }}>{order.id}</div>
                     <div style={{ 
                       fontSize: '11px', fontWeight: '600', padding: '2px 6px', borderRadius: '6px',
                       background: (order.paymentStatus === 'UNPAID' || order.payment_status === 'UNPAID') ? '#fef2f2' : '#f0fdf4',
                       color: (order.paymentStatus === 'UNPAID' || order.payment_status === 'UNPAID') ? '#ef4444' : '#10b981',
                       border: `1px solid ${(order.paymentStatus === 'UNPAID' || order.payment_status === 'UNPAID') ? '#fecaca' : '#bbf7d0'}`,
                       textTransform: 'uppercase'
                     }}>
                       {order.paymentStatus || order.payment_status || 'PAID'}
                     </div>
                   </div>
                   <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>{order.customerName || order.name}</div>
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
                  <div style={{ fontWeight: '500', fontSize: '16px', color: 'var(--primary)' }}>₹{tableTotal}</div>
                </div>
              </div>

              {/* Absolute Action Controls (Upper Right) */}
              <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', zIndex: 100 }}>
                <div style={{ fontSize: '11px', background: bg, color: text, padding: '4px 8px', borderRadius: '6px', fontWeight: '500', border: `1px solid ${border}`, textTransform: 'uppercase' }}>{order.type}</div>
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
                  <p style={{ fontWeight: '600', marginBottom: '16px', color: '#1e293b', fontSize: '14px' }}>
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
                      style={{ background: '#821a1d', color: '#fff', padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: '600', fontSize: '13px' }}
                    >
                      YES
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConfirmingAction(null); }}
                      style={{ background: '#f1f5f9', color: '#475569', padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: '600', fontSize: '13px' }}
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


const ProcessingOverlay = ({ type }) => {
  const message = type === 'KOT' ? 'Printing KOT...' : type === 'Bill' ? 'Printing Bill...' : 'Processing...';
  
  return (
    <div style={{ 
      position: 'absolute', 
      inset: 0, 
      background: 'rgba(255, 255, 255, 0.4)', 
      backdropFilter: 'blur(4px)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 9999,
      borderRadius: 'inherit'
    }}>
      <div style={{ 
        background: 'white', 
        padding: '24px 40px', 
        borderRadius: '20px', 
        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid #f1f5f9'
      }}>
        <div className="spinner-premium" style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #f1f5f9', 
          borderTop: '4px solid var(--primary)', 
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1e293b',
          letterSpacing: '-0.5px'
        }}>
          {message}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};


const MergeTableModal = ({ currentTable, tables, onMerge, onClose }) => {
  const [selectedTargetId, setSelectedTargetId] = useState('');
  
  // Only show active/occupied tables to merge WITH
  const mergeableTables = tables.filter(t => t.id !== currentTable.id && (t.status === 'occupied' || t.status === 'running' || t.status === 'billing' || t.status === 'kot_pending' || t.status === 'kot_printed'));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: '600', fontSize: '18px', color: '#1e293b' }}>Merge Table</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <p style={{ fontSize: '14px', color: '#475569', marginBottom: '16px' }}>
          Merge <strong>{currentTable.name}</strong> into another active table. All items will be transferred to the target table, and {currentTable.name} will be cleared.
        </p>
        <select 
          value={selectedTargetId} 
          onChange={e => setSelectedTargetId(e.target.value)}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '24px', fontSize: '14px' }}
        >
          <option value="" disabled>Select Target Table</option>
          {mergeableTables.map(t => (
            <option key={t.id} value={t.id}>{t.name} (Status: {t.status})</option>
          ))}
        </select>
        
        <button 
          onClick={() => selectedTargetId && onMerge(selectedTargetId)}
          disabled={!selectedTargetId}
          style={{ width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: selectedTargetId ? 'pointer' : 'not-allowed', opacity: selectedTargetId ? 1 : 0.5 }}
        >
          Merge Tables
        </button>
      </div>
    </div>
  );
};

const SplitTableModal = ({ currentTable, cart, onSplit, onClose }) => {
  const [newTableName, setNewTableName] = useState(`${currentTable.name} - Split`);
  const [selectedItemIds, setSelectedItemIds] = useState({}); // { cartItemId: boolean }

  const handleToggle = (cartItemId) => {
    setSelectedItemIds(prev => ({ ...prev, [cartItemId]: !prev[cartItemId] }));
  };

  const handleSplit = () => {
    const itemsToMove = cart.filter(item => selectedItemIds[item.cartItemId]);
    if (itemsToMove.length === 0) return alert("Select at least one item to split.");
    if (!newTableName.trim()) return alert("Enter a name for the new table.");
    onSplit(newTableName, itemsToMove);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '450px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontWeight: '600', fontSize: '18px', color: '#1e293b' }}>Split Table</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        
        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>New Table Name</label>
        <input 
          value={newTableName} 
          onChange={e => setNewTableName(e.target.value)}
          placeholder="e.g. Table 4 - B"
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '16px', fontSize: '14px' }}
        />

        <label style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '8px' }}>Select Items to Move</label>
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }} className="no-scrollbar">
          {cart.map(item => (
            <label key={item.cartItemId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedItemIds[item.cartItemId] ? '#eff6ff' : 'transparent' }}>
              <input 
                type="checkbox" 
                checked={!!selectedItemIds[item.cartItemId]} 
                onChange={() => handleToggle(item.cartItemId)} 
                style={{ width: '16px', height: '16px' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{item.name}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Qty: {item.qty}</div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>₹{item.price * item.qty}</div>
            </label>
          ))}
        </div>

        <button 
          onClick={handleSplit}
          style={{ width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', marginTop: '16px' }}
        >
          Confirm Split
        </button>
      </div>
    </div>
  );
};


const OrderingSystem = ({ table, tables, nonTableOrders, initialOrder, onBack, onSaveOrder, onCancelOrder, onAddItem, onSettleTable, onChangeTable, onCartSync, MENU_ITEMS, CATEGORIES, customers, settings, loadTables, suppressLocalKotPrint }) => {
  // Fix redundant 'Table Table' title
  const displayTitle = table?.name?.toLowerCase().includes('table') 
    ? table.name 
    : `Table ${table?.name || table?.id || '...'}`;

  // --- CORE STATE ---
  const [cart, setCart] = useState(initialOrder || []);
  const [activeCat, setActiveCat] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingType, setProcessingType] = useState(null); // 'KOT', 'Bill', or 'Save'
  const isPickup = table?.type === 'Takeaway' || table?.type === 'Delivery';

  // --- CRM & ORDER INFO ---
  const [customerPhone, setCustomerPhone] = useState(table?.phone || table?.customerPhone || '');
  const [customerName, setCustomerName] = useState(table?.customerName || table?.customer_name || '');
  const [customerInfo, setCustomerInfo] = useState(null);
  const [redeemedPoints, setRedeemedPoints] = useState(0);
  const [orderNote, setOrderNote] = useState(table?.note || '');

  // Sync state when table prop changes
  useEffect(() => {
    const isVacant = !table?.status || table.status.toLowerCase() === 'vacant' || table.status.toLowerCase() === 'available';
    setCustomerPhone(isVacant ? '' : (table?.phone || table?.customerPhone || ''));
    setCustomerName(isVacant ? '' : (table?.customerName || table?.customer_name || ''));
    setOrderNote(table?.note || '');
  }, [table?.id]);

  // --- CRM Auto-Fetch ---
  useEffect(() => {
    if (customerPhone.length >= 10 && IS_LOCAL) {
      apiService.fetchCustomer(customerPhone).then(res => {
        if (res.success && res.customer) {
          setCustomerInfo(res.customer);
          if (!customerName) setCustomerName(res.customer.name);
        } else {
          setCustomerInfo(null);
        }
      }).catch(e => console.error("Failed to fetch CRM data:", e));
    } else {
      setCustomerInfo(null);
    }
  }, [customerPhone]);

  // --- MODALS & UI ---
  const [showModifierModal, setShowModifierModal] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(null);
  const [customNoteText, setCustomNoteText] = useState('');
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showTipEntry, setShowTipEntry] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // --- TABLE CONTROLS ---
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [reprintSelected, setReprintSelected] = useState([]);

  // --- BILLING & TAXES ---
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
  const [discountAuth, setDiscountAuth] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(table?.paymentMethod || table?.payment_method || 'Cash');
  const [isPaid, setIsPaid] = useState(isPickup ? (table?.paymentStatus !== 'UNPAID' && table?.payment_status !== 'UNPAID') : false);
  const [cashReceived, setCashReceived] = useState('');
  const [upiReceived, setUpiReceived] = useState('');
  const [tipAmount, setTipAmount] = useState('0');

  // 🔥 NEW REQUESTED LOGIC
  // printKOT: prints EXACTLY the items passed in — no internal re-filtering.
  // Callers are responsible for passing only the new/delta items.
  const printKOT = async (items) => {
    if (!items || items.length === 0) return;
    await printPosToSerial({
      orderId: table?.id,
      tableName: table?.name || `Table ${table?.id}`,
      customerName, customerPhone,
      items: items,
      subtotal, serviceCharge, roundOff, grandTotal,
      orderType: table?.type || 'Dine In'
    }, 'KOT', settings);
  };

  const printBill = async () => {
    // 1. Get or Generate Bill Number from server to ensure it's session-locked
    let billNo = table?.bill_number;
    if (!billNo) {
      try {
        const res = await apiService.getBillNumber(table.id);
        billNo = res.bill_number;
      } catch (err) {
        console.error("Failed to get bill number:", err);
        // Fallback to local if server fails, though backend is now source of truth
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const seqKey = `bill_seq_${today}`;
        let seq = parseInt(localStorage.getItem(seqKey) || '0', 10);
        seq += 1;
        localStorage.setItem(seqKey, seq.toString());
        billNo = seq.toString().padStart(4, '0');
      }
    }

    await printPosToSerial({
      orderId: table?.id,
      tableName: table?.name || `Table ${table?.id}`,
      customerName, customerPhone,
      items: cart,
      subtotal, serviceCharge, gstAmount, discountAmt, discountRate: Number(discountRate || 0), roundOff, grandTotal,
      billNumber: billNo,
      orderType: table?.type || 'Dine In'
    }, 'BILL', settings);
  };

  // handleKOT: Send KOT to kitchen ONLY. No printing whatsoever.
  const handleKOT = async () => {
    if (isProcessing) return;
    setProcessingType('KOT');
    setIsProcessing(true);

    const tid = String(table.id || '').toUpperCase();
    const isTakeaway = isPickup;

    // Compute delta for alert check (using current scope cart is fine for the alert)
    const deltaItems = cart.map(item => {
      const existing = (initialOrder || []).find(i => i.name === item.name);
      const existingQty = existing ? (existing.qty || existing.quantity || 0) : 0;
      const newQty = item.qty - existingQty;
      if (newQty > 0) return { ...item, qty: newQty, quantity: newQty };
      return null;
    }).filter(Boolean);

    if (deltaItems.length === 0 && (initialOrder || []).length === 0) {
      alert("No new items to send to KOT");
      setIsProcessing(false);
      setProcessingType(null);
      return;
    }

    if (isTakeaway) {
      suppressLocalKotPrint.current = true;
      try {
        await onSaveOrder(table.id, cart, 'kot_pending', {
          customerName, customerPhone, note: orderNote,
          paymentStatus: isPaid ? 'PAID' : 'UNPAID',
          paymentMethod: paymentMethod,
          gst_enabled: applyGst, gst_rate: gstRate,
          service_charge_enabled: applyServiceCharge, service_charge_rate: serviceChargeRate,
          redeemedPoints: redeemedPoints || 0
        });
      } finally {
        setTimeout(() => { suppressLocalKotPrint.current = false; }, 3000);
        setIsProcessing(false);
        setProcessingType(null);
      }
      setCart([]);
      if (onBack) onBack(cart);
      return;
    }

    // Instant UI feedback
    const cartToSync = [...cart];
    setCart([]);
    
    if (onBack) onBack(cartToSync);

    suppressLocalKotPrint.current = true;
    orderService.syncKOT(table.id, cartToSync, {
      customerName, customerPhone, customer_name: customerName, phone: customerPhone,
      gst_enabled: applyGst, gst_rate: gstRate,
      service_charge_enabled: applyServiceCharge, service_charge_rate: serviceChargeRate,
      note: orderNote
    })
    .catch(async (err) => {
      console.error("❌ Background KOT failed, falling back to local print:", err);
      // FALLBACK: If server sync fails, trigger a local print so the order isn't lost for the kitchen
      try {
        await printPosToSerial({
          orderId: table?.id,
          tableName: table?.name || `Table ${table?.id}`,
          customerName, customerPhone,
          items: deltaItems,
          subtotal, serviceCharge, roundOff, grandTotal,
          orderType: table?.type || 'Dine In'
        }, 'KOT', settings);
        alert("⚠️ Connection Issue: KOT saved locally and printed, but failed to sync with server.");
      } catch (printErr) {
        alert("❌ CRITICAL: KOT failed to sync AND failed to print locally. Please check your printer and connection.");
      }
    })
    .finally(() => {
      setIsProcessing(false);
      setProcessingType(null);
      setTimeout(() => { suppressLocalKotPrint.current = false; }, 3000);
    });
  };

  // handleKOTPrint: Send KOT to kitchen AND print ONLY the newly added items.
  const handleKOTPrint = async () => {
    if (isProcessing) return;
    if (!cart || cart.length === 0) { alert("No items to send"); return; }
    if (!table) { alert("No table selected"); return; }

    setProcessingType('KOT');
    setIsProcessing(true);
    const tid = String(table.id || '').toUpperCase();
    const isTakeaway = isPickup;

    // Compute ONLY the newly added items (delta vs what's already on the server)
    const deltaItems = cart.map(item => {
      const existing = (initialOrder || []).find(i => i.name === item.name);
      const existingQty = existing ? (existing.qty || existing.quantity || 0) : 0;
      const newQty = item.qty - existingQty;
      if (newQty > 0) return { ...item, qty: newQty, quantity: newQty, isDelta: true };
      return null;
    }).filter(Boolean);

    if (deltaItems.length === 0) {
      setReprintSelected([]);
      setShowReprintModal(true);
      setIsProcessing(false);
      setProcessingType(null);
      return;
    }

    if (isTakeaway) {
      // Print first (we still have state in scope), then save
      await printPosToSerial({
        orderId: table?.id,
        tableName: table?.name || `Table ${table?.id}`,
        customerName, customerPhone,
        items: deltaItems,
        subtotal, serviceCharge, roundOff, grandTotal,
        orderType: table?.type || 'Dine In'
      }, 'KOT', settings);
      
      suppressLocalKotPrint.current = true;
      try {
        await onSaveOrder(table.id, cart, 'kot_printed', {
          customerName, customerPhone, note: orderNote,
          paymentStatus: isPaid ? 'PAID' : 'UNPAID',
          paymentMethod: paymentMethod,
          gst_enabled: applyGst, gst_rate: gstRate,
          service_charge_enabled: applyServiceCharge, service_charge_rate: serviceChargeRate,
          redeemedPoints: redeemedPoints || 0
        });
      } finally {
        setTimeout(() => { suppressLocalKotPrint.current = false; }, 3000);
        setIsProcessing(false);
        setProcessingType(null);
      }
      
      setCart([]);
      if (onBack) onBack(cart);
      return;
    }

    // Print IMMEDIATELY while we still have state in scope (before navigation)
    await printPosToSerial({
      orderId: table?.id,
      tableName: table?.name || `Table ${table?.id}`,
      customerName, customerPhone,
      items: deltaItems,
      subtotal, serviceCharge, roundOff, grandTotal,
      orderType: table?.type || 'Dine In'
    }, 'KOT', settings);

    // Instant UI feedback
    const fullCartForSync = [...cart];
    setCart([]);
    if (onBack) onBack(fullCartForSync);

    // Background sync — suppress the socket bounce-back auto-print on THIS terminal
    (async () => {
      try {
        suppressLocalKotPrint.current = true;
        await apiService.updateOrder(table.id, {
          items: fullCartForSync,
          status: 'KOT_PRINTED',
          customerName, customerPhone, customer_name: customerName, phone: customerPhone,
          gst_enabled: applyGst,
          gst_rate: gstRate,
          service_charge_enabled: applyServiceCharge,
          service_charge_rate: serviceChargeRate,
          note: orderNote
        });
        console.log("✅ KOT Print & Sync Successful");
      } catch (err) {
        console.error("❌ Background KOT+Print sync failed:", err);
        alert("⚠️ KOT Printed locally, but failed to sync with server. Please check connection.");
      } finally {
        setIsProcessing(false);
        setProcessingType(null);
        setTimeout(() => { suppressLocalKotPrint.current = false; }, 3000);
      }
    })();
  };

  const handleSave = async () => {
    if (isProcessing) return;
    if (!cart || cart.length === 0) { alert("Please add at least 1 item to the order."); return; }
    if (!table) { alert("No table selected"); return; }
    const currentStatus = String(table.status || 'vacant').toLowerCase();
    const occupiedStatuses = ['draft', 'kot_pending', 'kot_printed', 'billing', 'occupied', 'running'];
    const isAlreadyOccupied = occupiedStatuses.includes(currentStatus);
    const statusToSend = isAlreadyOccupied ? currentStatus : 'occupied';

    setProcessingType('Save');
    setIsProcessing(true);
    suppressLocalKotPrint.current = true;
    
    try {
      await onSaveOrder(table.id, cart, statusToSend, { 
        customerName, 
        customerPhone, 
        note: orderNote,
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        paymentMethod: paymentMethod,
        gst_enabled: applyGst,
        gst_rate: gstRate,
        service_charge_enabled: applyServiceCharge,
        service_charge_rate: serviceChargeRate,
        redeemedPoints: redeemedPoints || 0
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => { suppressLocalKotPrint.current = false; }, 3000);
    }
  };

  const handlePrintBill = async () => {
    if (isProcessing) return;
    setProcessingType('Bill');
    setIsProcessing(true);
    try {
      const tid = String(table.id || '').toUpperCase();
      const isTakeaway = isPickup;
    
    // Mark as completed if already paid, otherwise printed
    const finalStatus = (isTakeaway && isPaid) ? 'completed' : 'printed';

    // 🖨️ PRINT FIRST (before navigation) so we still have cart + totals in scope
    await printBill();

    // Then save to backend and navigate away
    await onSaveOrder(table.id, cart, finalStatus, { 
      customerName, 
      customerPhone, 
      note: orderNote,
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      paymentMethod: paymentMethod,
      gst_enabled: applyGst,
      gst_rate: gstRate,
      service_charge_enabled: applyServiceCharge,
      service_charge_rate: serviceChargeRate,
      redeemedPoints: redeemedPoints || 0
    });
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
    }
  };

  const handleMergeSubmit = async (targetTableId) => {
    try {
      await apiService.mergeTables(table.id, targetTableId);
      alert("Tables merged successfully!");
      setShowMergeModal(false);
      if (onBack) onBack(); // Go back to floor plan to see changes
    } catch (err) {
      alert("Merge failed: " + err.message);
    }
  };

  const handleSplitSubmit = async (newTableName, itemsToMove) => {
    try {
      await apiService.splitTable(table.id, { newTableName, items: itemsToMove });
      alert("Table split successfully!");
      setShowSplitModal(false);
      if (onBack) onBack(); // Go back to floor plan to see changes
    } catch (err) {
      alert("Split failed: " + err.message);
    }
  };

  const addItemToTable = async (item) => {
    // Items are only synced to the backend when the user explicitly punches
    // the order via handleKOT / handleKOTPrint. No auto-sync on item click.
  };

  // 1. Sync cart when initialOrder changes (background sync)
  useEffect(() => {
    // Ensure every item loaded from server has a cartItemId so addToCart
    // can correctly find & increment qty instead of adding a duplicate line.
    const normalized = (initialOrder || []).map(item => ({
      ...item,
      qty: item.qty || item.quantity || 1,
      cartItemId: item.cartItemId || String(item.id || item.name || Math.random())
    }));
    setCart(normalized);
  }, [initialOrder]);

  // 2. Sync tax & metadata ONLY on table switch or global default change
  useEffect(() => {
    if (!table) return;
    const isVacant = !table.status || table.status === 'vacant';
    
    setOrderNote(table.note || '');
    setCustomerPhone(isVacant ? '' : (table.phone || ''));
    setCustomerName(isVacant ? '' : (table.customerName || table.customer_name || ''));
    setRedeemedPoints(0);
    setTipAmount('0');
    
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
  const grandTotal = Math.ceil(rawTotal);
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
    const isInStock = item.inStock ?? item.available ?? true;
    if (!isInStock) {
      alert(`${item.name} is currently Out of Stock.`);
      return;
    }
    if ((item.modifiers && item.modifiers.length > 0) || 
        (item.modifier_groups && item.modifier_groups.length > 0) || 
        (item.add_ons && item.add_ons.length > 0)) {
      setShowModifierModal(item);
    } else {
      addToCart(item);
    }
  };

  const addToCart = (item, selectedModifier = null) => {
    let errorToAlert = null;
    setCart(prev => {
      try {
        return orderService.calculateAddToCart(item, prev, tables, nonTableOrders, table, selectedModifier);
      } catch (err) {
        errorToAlert = err.message;
        return prev;
      }
    });
    if (onCartSync) onCartSync();
    if (errorToAlert) alert(errorToAlert);
    setShowModifierModal(null);
  };

  const handleUndo = () => {
    let errorToAlert = null;
    setCart(prev => {
      try {
        return orderService.calculateUndo(prev);
      } catch (err) {
        errorToAlert = err.message;
        return prev;
      }
    });
    if (onCartSync) onCartSync();
    if (errorToAlert) alert(errorToAlert);
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
    if (onCartSync) onCartSync();
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
      await onSettleTable(table.id, { 
        cart: updatedCart, 
        subtotal, 
        serviceCharge,
        gstAmount,
        discountAmt, 
        redeemedPoints, 
        discountAuth, 
        taxes: 0, 
        grandTotal, 
        paymentMethod, 
        timestamp: new Date().toISOString(), 
        phone: customerPhone, 
        customerName, 
        type: table?.type || 'Dine In',
        note: orderNote 
      });
    } else {
      // Just save order state
      setCart(updatedCart); // update local state so diff tracking is consistent
      await onSaveOrder(table.id, updatedCart, newStatus, { customerName, customerPhone, note: orderNote });
    }

    if (isPrint) {
      let billNo = table?.bill_number;
      if (isBill && !billNo) {
        try {
          const res = await fetch(`/api/billing/bill-number/${table.id}`);
          const data = await res.json();
          billNo = data.bill_number;
        } catch (e) { console.error("Bill number fetch failed:", e); }
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
      const query = searchQuery.toLowerCase().trim();
      const matchesName = item.name.toLowerCase().includes(query);
      const matchesShortCode = item.short_code && String(item.short_code).toLowerCase().includes(query);
      
      const isFilteringByCategory = activeCat !== 'All';
      const hasQuery = query.length > 0;
      
      // If searching, show match regardless of category. If not searching, respect category.
      const categoryMatch = !isFilteringByCategory || itemCat === activeCat || hasQuery;
      
      return categoryMatch && (matchesName || matchesShortCode);
    })
    .sort((a, b) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return a.name.localeCompare(b.name);
      
      // 1. Exact Short Code Match (Highest Priority)
      const aExactSC = a.short_code && a.short_code.toLowerCase() === query;
      const bExactSC = b.short_code && b.short_code.toLowerCase() === query;
      if (aExactSC && !bExactSC) return -1;
      if (!aExactSC && bExactSC) return 1;

      // 2. Short Code Starts With (Second Priority)
      const aStartsSC = a.short_code && a.short_code.toLowerCase().startsWith(query);
      const bStartsSC = b.short_code && b.short_code.toLowerCase().startsWith(query);
      if (aStartsSC && !bStartsSC) return -1;
      if (!aStartsSC && bStartsSC) return 1;

      // 3. Name Starts With
      const aStartsName = a.name.toLowerCase().startsWith(query);
      const bStartsName = b.name.toLowerCase().startsWith(query);
      if (aStartsName && !bStartsName) return -1;
      if (!aStartsName && bStartsName) return 1;

      // 4. Stock Availability
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      
      // 5. Default Name Sort
      return a.name.localeCompare(b.name);
    });

  return (
    <div style={{ flex: 1, display: 'flex', background: '#f1f5f9', position: 'relative', height: '100%', overflow: 'hidden' }}>

      {/* Category Sidebar */}
      <div className="no-print menu-sidebar" style={{ background: 'white', display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRight: '1px solid #e2e8f0', zIndex: 10 }}>
        <div style={{ padding: '20px 16px', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Menu</div>
        {availableCategories.map(cat => {
          const name = typeof cat === 'object' ? cat.name : cat;
          return (
            <button
              key={name}
              onClick={() => setActiveCat(name)}
              style={{ 
                padding: 'clamp(10px, 1.2vw, 16px) clamp(12px, 1.5vw, 20px)', border: 'none', background: 'transparent', textAlign: 'left', fontSize: 'clamp(11.5px, 1vw, 14px)', 
                fontWeight: activeCat === name ? '600' : '400', 
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div style={{ padding: 'clamp(10px, 1.2vw, 16px) clamp(14px, 1.5vw, 24px)', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }} className="no-print">
          <div style={{ fontWeight: '700', fontSize: 'clamp(14px, 1.2vw, 18px)', color: '#1e293b', whiteSpace: 'nowrap' }}>{activeCat}</div>
          <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: 'clamp(6px, 0.8vw, 10px) clamp(10px, 1vw, 16px)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '340px', minWidth: '120px' }}>
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Search anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredItems && filteredItems.length > 0) {
                    const firstItem = filteredItems[0];
                    const isRetail = firstItem.type === 'retail';
                    const cartQty = cart.reduce((acc, c) => c.id === firstItem.id ? acc + c.qty : acc, 0);
                    const otherReserved = getReservedStock(firstItem.id);
                    const liveStock = firstItem.stockQuantity - otherReserved - cartQty;
                    const isAvailable = isRetail ? liveStock > 0 : (firstItem.inStock ?? firstItem.available ?? true);
                    if (isAvailable) {
                      handleItemClick(firstItem);
                      setSearchQuery('');
                    } else {
                      alert(`${firstItem.name} is currently Out of Stock.`);
                    }
                  }
                }
              }}
              style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '14px', color: '#1e293b' }}
            />
          </div>
        </div>

        <div className="items-grid no-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: 'clamp(10px, 1.5vw, 24px)', alignContent: 'flex-start' }}>
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
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', lineHeight: '1.2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>{item.name}</span>
                  {isRetail && <div style={{ marginTop: '4px', background: '#f0f9ff', color: '#0284c7', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' }}>Stock: {liveStock}</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>₹{item.price}</div>
                  {!isAvailable && <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600', background: '#fef2f2', padding: '2px 6px', borderRadius: '6px' }}>OUT</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing Panel */}
      <div className="billing-panel no-print">
        <div style={{ padding: '8px 12px', display: 'flex', borderBottom: '1px solid #e2e8f0', alignItems: 'center', gap: '8px', background: '#ffffff', flexWrap: 'wrap' }}>
          <button onClick={() => onBack(cart)} style={{ background: '#f1f5f9', border: 'none', color: '#475569', padding: '7px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Back">
            <ChevronLeft size={18} />
          </button>
          {tables ? (
            <select
              value={table?.id || ''}
              onChange={(e) => {
                if (onChangeTable && e.target.value !== String(table?.id)) {
                  onChangeTable(table.id, e.target.value, cart);
                }
              }}
              style={{ 
                border: '2px solid var(--primary)', 
                color: '#0f172a', 
                padding: '6px 10px', 
                borderRadius: '8px', 
                fontSize: '13px', 
                fontWeight: '600', 
                outline: 'none', 
                background: '#ffffff',
                cursor: 'pointer',
                minWidth: '90px',
                flexShrink: 0
              }}
            >
              <option value={table?.id} disabled style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{displayTitle}</option>
              {tables.map(t => {
                const rawStatus = String(t.status || '').toLowerCase();
                const statusLabel = rawStatus === 'kot_pending' || rawStatus === 'kot_printed' ? 'Running' : rawStatus === 'billed' ? 'Billed' : rawStatus === 'vacant' ? 'Vacant' : (t.status || 'Active');
                return (
                  <option 
                    key={t.id} 
                    value={t.id} 
                    style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px', padding: '6px' }}
                  >
                    {t.name} ({statusLabel})
                  </option>
                );
              })}
            </select>
          ) : (
            <div style={{ border: '2px solid var(--primary)', color: '#0f172a', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', flexShrink: 0 }}>
              {displayTitle}
            </div>
          )}
          {table?.covers && <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}><Users size={12} /> {table.covers}</span>}

          {/* Merge / Split for Dine-In tables */}
          {!isPickup && IS_LOCAL && (
            <>
              <button 
                onClick={() => setShowMergeModal(true)}
                style={{ padding: '5px 10px', fontSize: '11px', fontWeight: '500', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Merge
              </button>
              <button 
                onClick={() => setShowSplitModal(true)}
                style={{ padding: '5px 10px', fontSize: '11px', fontWeight: '500', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Split
              </button>
            </>
          )}

          {/* Cancel/Delete for Pickup orders */}
          {(String(table?.id).startsWith('TAK-') || String(table?.id).startsWith('DEL-') || String(table?.id).startsWith('TA-') || String(table?.id).startsWith('DL-')) && (
            <>
              {(table.paymentStatus === 'PAID' || table.payment_status === 'PAID') ? (
                <button 
                  onClick={() => { 
                    if(confirm(`Cancel PAID order ${table.id}?`)) {
                      onCancelOrder(table.id);
                      onBack([]);
                    }
                  }} 
                  style={{ padding: '5px 10px', fontSize: '11px', fontWeight: '600', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', cursor: 'pointer', color: '#c2410c', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  <XCircle size={13} /> Cancel
                </button>
              ) : (
                <button 
                  onClick={() => { 
                    if(confirm(`Confirm deletion of order ${table.id}?`)) {
                      onSaveOrder(table.id, [], 'free'); 
                    }
                  }} 
                  style={{ padding: '5px 10px', fontSize: '11px', fontWeight: '600', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', color: '#dc2626', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </>
          )}

          <div style={{ marginLeft: 'auto', background: 'var(--primary)', color: 'white', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', flexShrink: 0 }}>
            {table?.type === 'Delivery' ? 'Delivery' : table?.type === 'Takeaway' ? 'Takeaway' : 'Dine In'}
          </div>
        </div>

        {/* --- CRM & CUSTOMER INFO SECTION --- */}
        <div style={{ padding: '12px 16px', background: isPickup ? '#faf5ff' : '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: (customerInfo || isPickup) ? '10px' : '0' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: isPickup ? 'var(--secondary)' : '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer Name (Optional)</label>
              <input
                type="text"
                placeholder="Walk-In"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', fontSize: '13px', fontWeight: '600', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', background: 'white', color: '#1e293b' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: isPickup ? 'var(--secondary)' : '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number (Optional)</label>
              <input
                type="text"
                placeholder="Mobile number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', fontSize: '13px', fontWeight: '600', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', background: 'white', color: '#1e293b' }}
                maxLength="10"
              />
            </div>
          </div>

          {customerInfo && (
            <div style={{ padding: '10px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', fontSize: '12px', color: '#065f46', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                  <User size={14} />
                  <span>Visit #{customerInfo.visits}</span>
                </div>
                <span style={{ fontWeight: '600' }}>{customerInfo.loyalty_points} Pts Available</span>
              </div>
              {customerInfo.loyalty_points > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid #a7f3d0', paddingTop: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600' }}>Redeem:</span>
                  <input
                    type="number"
                    min="0"
                    max={customerInfo.loyalty_points}
                    value={redeemedPoints}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRedeemedPoints(val > customerInfo.loyalty_points ? customerInfo.loyalty_points : val);
                    }}
                    style={{ width: '65px', padding: '5px 8px', fontSize: '12px', fontWeight: '500', border: '1px solid #a7f3d0', borderRadius: '6px', outline: 'none' }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: '600', opacity: 0.7 }}>(-₹{redeemedPoints})</span>
                </div>
              )}
            </div>
          )}
          {isPickup && (!customerName || customerPhone.length < 10) && (
            <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '500', marginTop: '6px' }}>
              ⚠️ Required for pickup orders
            </div>
          )}
        </div>
        {/* --- END CRM SECTION --- */}

        <div style={{ padding: '10px 16px', display: 'flex', fontSize: '11px', fontWeight: '600', color: '#94a3b8', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.8px', background: '#f8fafc' }}>
          <div style={{ flex: 1 }}>Items</div>
          <div style={{ width: '100px', textAlign: 'center' }}>Qty.</div>
          <div style={{ width: '85px', textAlign: 'right' }}>Price</div>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4, padding: '40px 20px' }}>
              <Utensils size={52} color="#cbd5e1" />
              <div style={{ fontWeight: '600', fontSize: '14px', marginTop: '12px', color: '#94a3b8' }}>No Items Added</div>
              <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>Select items from the menu</div>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={item.cartItemId} style={{ 
                padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 16px)', 
                display: 'flex', 
                alignItems: 'center', 
                borderBottom: '1px solid #f1f5f9',
                background: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                transition: 'background 0.15s ease'
              }}>
                {/* Item Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'clamp(12px, 1vw, 14px)', fontWeight: '600', color: '#1e293b', lineHeight: '1.3', marginBottom: '3px' }}>
                    {item.name}
                  </div>
                  {item.note && (
                    <div style={{ fontSize: '11px', color: 'var(--primary)', fontStyle: 'italic', fontWeight: '600', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MessageSquare size={10} /> {item.note}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <span>₹{item.price} /ea</span>
                    <button 
                      style={{ border: 'none', background: '#f1f5f9', cursor: 'pointer', padding: '3px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#64748b', fontWeight: '500' }}
                      onClick={() => {
                        setCustomNoteText(item.note || '');
                        setShowNoteModal(item);
                      }}
                    >
                      <MessageSquare size={11} color="var(--primary)" />
                      Note
                    </button>
                  </div>
                </div>

                {/* Qty Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: 'clamp(70px, 7vw, 100px)', justifyContent: 'center' }}>
                  <button 
                    style={{ 
                      width: 'clamp(22px, 2vw, 28px)', height: 'clamp(22px, 2vw, 28px)', borderRadius: '6px', border: '1px solid #e2e8f0', 
                      background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }} 
                    onClick={() => updateQty(item.cartItemId, -1)}
                  >
                    <Minus size={14} color="#64748b" />
                  </button>
                  <span style={{ 
                    fontSize: '14px', fontWeight: '600', color: '#1e293b', 
                    width: '32px', textAlign: 'center',
                    background: '#f1f5f9', borderRadius: '6px', padding: '4px 0',
                    border: '1px solid #e2e8f0'
                  }}>
                    {item.qty}
                  </span>
                  <button 
                    style={{ 
                      width: 'clamp(22px, 2vw, 28px)', height: 'clamp(22px, 2vw, 28px)', borderRadius: '6px', border: '1px solid #e2e8f0', 
                      background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }} 
                    onClick={() => updateQty(item.cartItemId, 1)}
                  >
                    <Plus size={14} color="#64748b" />
                  </button>
                </div>

                {/* Line Total */}
                <div style={{ width: 'clamp(55px, 6vw, 85px)', textAlign: 'right', fontSize: 'clamp(12px, 1vw, 14px)', fontWeight: '600', color: '#0f172a' }}>
                  ₹{item.price * item.qty}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Financials & Footer */}
        <div style={{ background: '#fff', borderTop: '2px solid #e2e8f0' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
            {/* Subtotal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>Subtotal</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>₹{subtotal.toFixed(2)}</span>
            </div>

            {applyDiscount && discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: '600' }}>Discount ({discountRate}%)</span>
                <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '700' }}>-₹{discountAmt.toFixed(2)}</span>
              </div>
            )}

            {applyServiceCharge && serviceCharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Service Charge ({serviceChargeRate}%)</span>
                <span style={{ fontSize: '14px', color: '#334155', fontWeight: '700' }}>₹{serviceCharge.toFixed(2)}</span>
              </div>
            )}

            {applyGst && gstAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>GST ({gstRate}%)</span>
                <span style={{ fontSize: '14px', color: '#334155', fontWeight: '700' }}>₹{gstAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Advanced Options Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px',
                marginTop: '10px',
                background: showAdvanced ? '#f1f5f9' : '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                letterSpacing: '0.3px'
              }}
            >
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Advanced Options
            </button>

            {showAdvanced && (
              <div style={{ marginTop: '12px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }} className="animate-fade-in">
                {/* Discount */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="discount-toggle" checked={applyDiscount} onChange={(e) => setApplyDiscount(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                    <label htmlFor="discount-toggle" style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Discount %</label>
                  </div>
                  {applyDiscount && (
                    <input type="number" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} style={{ width: '55px', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', fontSize: '13px', fontWeight: '700' }} />
                  )}
                </div>

                {/* Service Charge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="service-toggle" checked={applyServiceCharge} onChange={(e) => setApplyServiceCharge(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                    <label htmlFor="service-toggle" style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Service Charge %</label>
                  </div>
                  {applyServiceCharge && (
                    <input type="number" value={serviceChargeRate} onChange={(e) => setServiceChargeRate(parseFloat(e.target.value) || 0)} style={{ width: '55px', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', fontSize: '13px', fontWeight: '700' }} />
                  )}
                </div>

                {/* GST */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="gst-toggle" checked={applyGst} onChange={(e) => setApplyGst(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                    <label htmlFor="gst-toggle" style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>GST %</label>
                  </div>
                  {applyGst && (
                    <input type="number" value={gstRate} onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)} style={{ width: '55px', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', fontSize: '13px', fontWeight: '700' }} />
                  )}
                </div>

                {/* Split Bill */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Split Bill (Ways)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button style={{ width: '28px', height: '28px', border: '1px solid #cbd5e1', background: 'white', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700' }} onClick={() => setSplitWays(Math.max(1, splitWays - 1))}>−</button>
                    <span style={{ fontSize: '14px', fontWeight: '700', width: '24px', textAlign: 'center' }}>{splitWays}</span>
                    <button style={{ width: '28px', height: '28px', border: '1px solid #cbd5e1', background: 'white', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700' }} onClick={() => setSplitWays(splitWays + 1)}>+</button>
                  </div>
                </div>

                {/* Order Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Order Note / Instructions</label>
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Add general instructions for this order..."
                    style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px', minHeight: '60px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Loyalty Redeemed */}
                {redeemedPoints > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontSize: '13px', fontWeight: '700', padding: '8px 0', borderTop: '1px dashed #fecaca' }}>
                    <span>Points Redeemed</span>
                    <span>-₹{redeemedPoints.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grand Total & Payment */}
          <div style={{ padding: 'clamp(10px, 1vw, 16px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc', borderTop: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Total Amount</div>
              <div style={{ fontSize: 'clamp(20px, 2vw, 28px)', fontWeight: '700', color: 'var(--primary)', letterSpacing: '-1px', lineHeight: '1' }}>₹{grandTotal.toFixed(2)}</div>
              {splitWays > 1 && <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '500', marginTop: '4px' }}>₹{(grandTotal / splitWays).toFixed(2)} / person</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['Cash', 'Card', 'UPI'].map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    style={{
                      padding: 'clamp(5px, 0.5vw, 8px) clamp(8px, 0.9vw, 14px)',
                      borderRadius: '8px',
                      border: '2px solid',
                      borderColor: paymentMethod === method ? 'var(--primary)' : '#e2e8f0',
                      background: paymentMethod === method ? '#fef2f2' : 'white',
                      color: paymentMethod === method ? 'var(--primary)' : '#64748b',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {method}
                  </button>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isPaid} onChange={() => setIsPaid(!isPaid)} style={{ accentColor: 'var(--primary)' }} />
                <span style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>Mark as Paid</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="footer-btn-grid" style={{ padding: '10px', gap: '8px' }}>
            <button disabled={!IS_LOCAL || isProcessing} className="btn-maroon" onClick={handleSave} style={{ opacity: (IS_LOCAL && !isProcessing) ? 1 : 0.5, cursor: (IS_LOCAL && !isProcessing) ? 'pointer' : 'not-allowed' }}>{isProcessing ? 'Saving...' : 'SAVE'}</button>
            <button disabled={!IS_LOCAL || isProcessing} className="btn-maroon" onClick={handlePrintBill} style={{ opacity: (IS_LOCAL && !isProcessing) ? 1 : 0.5, cursor: (IS_LOCAL && !isProcessing) ? 'pointer' : 'not-allowed' }}>PRINT BILL</button>
            <button disabled={!IS_LOCAL || isProcessing} className="btn-grey" onClick={handleKOT} style={{ opacity: (IS_LOCAL && !isProcessing) ? 1 : 0.5, cursor: (IS_LOCAL && !isProcessing) ? 'pointer' : 'not-allowed' }}>KOT</button>
            <button disabled={!IS_LOCAL || isProcessing} className="btn-grey" style={{ background: '#334155', opacity: (IS_LOCAL && !isProcessing) ? 1 : 0.5, cursor: (IS_LOCAL && !isProcessing) ? 'pointer' : 'not-allowed' }} onClick={handleKOTPrint}>KOT & PRINT</button>
          </div>
          

        </div>
      </div>

      {/* Table Management Modals */}
      {showMergeModal && (
        <MergeTableModal
          currentTable={table}
          tables={tables}
          onMerge={handleMergeSubmit}
          onClose={() => setShowMergeModal(false)}
        />
      )}
      {showSplitModal && (
        <SplitTableModal
          currentTable={table}
          cart={cart}
          onSplit={handleSplitSubmit}
          onClose={() => setShowSplitModal(false)}
        />
      )}

      {/* KOT Reprint Modal */}
      {showReprintModal && cart.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-fade-in" style={{ background: 'white', borderRadius: '16px', width: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>Reprint KOT</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Select items from the cart to reprint KOT</p>
                </div>
                <button onClick={() => setShowReprintModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748b', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>
              {/* Select All */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={reprintSelected.length === cart.length}
                  onChange={(e) => {
                    if (e.target.checked) setReprintSelected(cart.map((_, i) => i));
                    else setReprintSelected([]);
                  }}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                Select All ({cart.length} items)
              </label>
            </div>

            {/* Items List */}
            <div style={{ padding: '8px 16px', overflowY: 'auto', flex: 1 }}>
              {cart.map((item, idx) => {
                const isChecked = reprintSelected.includes(idx);
                return (
                  <label
                    key={idx}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 8px',
                      borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s',
                      background: isChecked ? '#fef2f2' : 'transparent',
                      borderBottom: idx < cart.length - 1 ? '1px solid #f8fafc' : 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setReprintSelected(prev =>
                          prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                        );
                      }}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      {item.note && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Note: {item.note}</div>}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', flexShrink: 0 }}>×{item.qty}</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', flexShrink: 0, minWidth: '50px', textAlign: 'right' }}>₹{(item.price * item.qty).toFixed(0)}</div>
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowReprintModal(false)}
                style={{ flex: 1, padding: '12px', fontSize: '13px', fontWeight: '600', background: '#f1f5f9', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#475569' }}
              >
                Cancel
              </button>
              <button
                disabled={reprintSelected.length === 0}
                onClick={async () => {
                  const selectedItems = reprintSelected.map(i => ({ ...cart[i] }));
                  setShowReprintModal(false);
                  await printPosToSerial({
                    orderId: table?.id,
                    tableName: table?.name || `Table ${table?.id}`,
                    customerName, customerPhone,
                    items: selectedItems,
                    subtotal, serviceCharge, roundOff, grandTotal,
                    orderType: table?.type || 'Dine In'
                  }, 'KOT', settings);
                }}
                style={{
                  flex: 2, padding: '12px', fontSize: '13px', fontWeight: '700',
                  background: reprintSelected.length > 0 ? 'var(--primary)' : '#e2e8f0',
                  border: 'none', borderRadius: '10px', cursor: reprintSelected.length > 0 ? 'pointer' : 'not-allowed',
                  color: reprintSelected.length > 0 ? 'white' : '#94a3b8',
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <Printer size={15} /> Reprint KOT ({reprintSelected.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifier Modal Overlay */}
      {showModifierModal && (
        <RichModifierModal
          item={showModifierModal}
          onAddToCart={addToCart}
          onClose={() => setShowModifierModal(null)}
        />
      )}



      {/* Kitchen Note Modal */}
      {showNoteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-fade-in" style={{ background: 'white', padding: '24px', borderRadius: 'var(--radius-md)', width: '340px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: '600', fontSize: '18px', color: '#1e293b' }}>Kitchen Instructions</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Add special requests for {showNoteModal.name}</p>
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
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setCart(prev => prev.map(i => i.cartItemId === showNoteModal.cartItemId ? { ...i, note: '' } : i));
                  setShowNoteModal(null);
                }}
                style={{ flex: 1, padding: '12px', background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                Clear Note
              </button>
              <button
                onClick={() => {
                  setCart(prev => prev.map(i => i.cartItemId === showNoteModal.cartItemId ? { ...i, note: customNoteText } : i));
                  setShowNoteModal(null);
                }}
                style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
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
              <h3 style={{ fontWeight: '600', fontSize: '20px', color: '#1e293b' }}>Settle {table?.name}</h3>
              <button onClick={() => setShowSettleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#991b1b', textTransform: 'uppercase', marginBottom: '4px' }}>Total Amount Due</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#94161c' }}>₹{grandTotal.toFixed(2)}</div>
            </div>
            
            {/* Breakdown Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: applyServiceCharge ? '#991b1b' : '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Service Charge ({serviceChargeRate}%)</span>
                  <button onClick={() => setApplyServiceCharge(!applyServiceCharge)} style={{ width: '28px', height: '16px', borderRadius: '8px', background: applyServiceCharge ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '2px', left: applyServiceCharge ? '14px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }}></div>
                  </button>
                </div>
                <span>₹{serviceCharge.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: applyGst ? '#166534' : '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>GST ({gstRate}%)</span>
                  <button onClick={() => setApplyGst(!applyGst)} style={{ width: '28px', height: '16px', borderRadius: '8px', background: applyGst ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '2px', left: applyGst ? '14px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }}></div>
                  </button>
                </div>
                <span>₹{gstAmount.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>CASH RECEIVED</label>
                <input 
                  type="number" 
                  value={cashReceived} 
                  onChange={(e) => setCashReceived(e.target.value)} 
                  placeholder="0.00"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #f1f5f9', fontSize: '16px', fontWeight: '600', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>UPI RECEIVED</label>
                <input 
                  type="number" 
                  value={upiReceived} 
                  onChange={(e) => setUpiReceived(e.target.value)} 
                  placeholder="0.00"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #f1f5f9', fontSize: '16px', fontWeight: '600', outline: 'none' }}
                />
              </div>
              {!isPickup && (
                <div style={{ marginTop: '4px' }}>
                  {!showTipEntry ? (
                    <button 
                      onClick={() => setShowTipEntry(true)}
                      style={{ background: 'none', border: 'none', color: parseFloat(tipAmount) > 0 ? '#047857' : '#f59e0b', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}
                    >
                      <Plus size={14} /> {parseFloat(tipAmount) > 0 ? `STAFF TIP: ₹${parseFloat(tipAmount).toFixed(2)} (Tap to Edit)` : 'ADD STAFF TIP'}
                    </button>
                  ) : (
                    <div style={{ padding: '12px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Zap size={13} color="#f59e0b"/>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#9a3412' }}>STAFF TIP</span>
                        </div>
                        <button onClick={() => { setShowTipEntry(false); setTipAmount('0'); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#94a3b8', fontSize: '14px' }}>₹</span>
                          <input 
                            autoFocus
                            type="number" 
                            value={tipAmount} 
                            onChange={(e) => setTipAmount(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && setShowTipEntry(false)}
                            placeholder="0.00"
                            style={{ width: '100%', padding: '10px 10px 10px 28px', borderRadius: '8px', border: '2px solid #fed7aa', background: 'white', fontSize: '14px', fontWeight: '600', outline: 'none', color: '#9a3412' }}
                          />
                        </div>
                        <button 
                          onClick={() => setShowTipEntry(false)}
                          style={{ padding: '0 12px', borderRadius: '8px', background: '#10b981', color: 'white', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                        >
                          <CheckCircle size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Calculation */}
            {(() => {
              const totalPaid = (parseFloat(cashReceived) || 0) + (parseFloat(upiReceived) || 0);
              const change = totalPaid - grandTotal;
              return (
                <div style={{ padding: '12px', borderRadius: '10px', background: '#f8fafc', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>Total Paid</span>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>₹{totalPaid.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Change to Return</span>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: change >= 0 ? '#10b981' : '#ef4444' }}>
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
                  tipAmount: parseFloat(tipAmount) || 0,
                  timestamp: new Date().toISOString(), 
                  phone: customerPhone, customerName, note: orderNote,
                  service_charge_enabled: applyServiceCharge,
                  service_charge_rate: serviceChargeRate,
                  gst_enabled: applyGst,
                  gst_rate: gstRate
                });
                setShowSettleModal(false);
                if (onBack) onBack();
              }}
              style={{ 
                width: '100%', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: '700', color: 'white',
                background: ((parseFloat(cashReceived) || 0) + (parseFloat(upiReceived) || 0)) >= grandTotal ? '#10b981' : '#cbd5e1',
                cursor: ((parseFloat(cashReceived) || 0) + (parseFloat(upiReceived) || 0)) >= grandTotal ? 'pointer' : 'not-allowed'
              }}>
              COMPLETE SETTLEMENT
            </button>
          </div>
        </div>
      )}
      {isProcessing && <ProcessingOverlay type={processingType} />}
    </div>
  );
};

/* --- ANALYTICS DASHBOARD --- */
const StatCard = ({ label, value, icon: Icon, color, subtext }) => (
  <div style={{ background: 'rgba(255,255,255,0.88)', padding: '22px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', position: 'relative', boxShadow: '0 18px 32px rgba(15, 23, 42, 0.06)' }}>
    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1.2px' }}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: '500', color: '#1e293b', letterSpacing: '-0.8px' }}>{value}</div>
    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', fontWeight: '500', lineHeight: 1.5 }}>{subtext}</div>
    <div style={{ position: 'absolute', top: '22px', right: '22px', width: '42px', height: '42px', borderRadius: '16px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={20} color={color} />
    </div>
  </div>
);

const InsightItem = ({ title, value, sub }) => (
  <div style={{ display: 'flex', gap: '12px' }}>
    <div style={{ width: '4px', background: 'var(--primary)', borderRadius: '2px' }} />
    <div>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>{title}</div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '2px' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>{sub}</div>
    </div>
  </div>
);

function MainApp() {
  // --- STATE INITIALIZATION (OFFLINE FIRST) ---
  // --- VIEW & UI NAVIGATION ---
  const isKdsMode = window.location.pathname.startsWith('/kds') || new URLSearchParams(window.location.search).get('mode') === 'kds';
  const [view, setView] = useState(isKdsMode ? 'kds' : 'tables');
  const [showSidebar, setShowSidebar] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [loading, setLoading] = useState(!IS_LOCAL);
  const [pinInput, setPinInput] = useState('');
  const [unlockedViews, setUnlockedViews] = useState([]);

  // --- SELECTION & TABLE ACTIONS ---
  const [selectedTable, setSelectedTable] = useState(null);
  const [pendingCoversTable, setPendingCoversTable] = useState(null);
  const [coversCount, setCoversCount] = useState(1);
  const selectedTableRef = useRef(null);
  const [quickSettleTable, setQuickSettleTable] = useState(null);
  const [quickPrintTable, setQuickPrintTable] = useState(null);
  const [tableToClear, setTableToClear] = useState(null);

  // --- MASTER DATA ---
  const [tables, setTables] = useState([]);
  const [nonTableOrders, setNonTableOrders] = useState(() => {
    let nontables = loadFromLocal('pos_nontable_orders') || [];
    const active = nontables.filter(o => String(o.status || '').toUpperCase() !== 'CANCELED');
    if (active.length !== nontables.length) saveToLocal('pos_nontable_orders', active);
    return active;
  });
  const [orderHistory, setOrderHistory] = useState(() => {
    let history = loadFromLocal('pos_order_history') || [];
    let nontables = loadFromLocal('pos_nontable_orders') || [];
    const stuckCancelled = nontables.filter(o => String(o.status || '').toUpperCase() === 'CANCELED');
    if (stuckCancelled.length > 0) {
      history = [...stuckCancelled.map(o => ({ ...o, paymentStatus: 'CANCELLED', timestamp: o.timestamp || Date.now() })), ...history];
      saveToLocal('pos_order_history', history.slice(0, 1000));
    }
    return history;
  });
  const [menuItems, setMenuItems] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [customers, setCustomers] = useState(() => loadFromLocal('pos_customers', {}));
  const [devices, setDevices] = useState([]);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [floorPlanSections, setFloorPlanSections] = useState(() => loadFromLocal('pos_floor_sections', ['DINE IN', 'AC', 'TERRACE']));
  const [cart, setCart] = useState([]);

  // --- SYSTEM & DEVICE STATUS ---
  const [socketConnected, setSocketConnected] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [showLanModal, setShowLanModal] = useState(false);
  const [isDbLoaded, setIsDbLoaded] = useState(true); 
  const [deviceStatus, setDeviceStatus] = useState('APPROVED');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGlobalActionPending, setIsGlobalActionPending] = useState(false);
  const [deviceId, setDeviceId] = useState('LOCAL-DEVICE');
  const [lanUrl, setLanUrl] = useState('');

  // Background Auto-Retry Sync Worker for Unsynced Tables
  useEffect(() => {
    const timer = setInterval(async () => {
      const unsynced = tables.filter(t => t.isUnsynced && t.orders && t.orders.length > 0);
      if (unsynced.length === 0) return;

      for (const table of unsynced) {
        try {
          const backendStatus = String(table.status || 'occupied').toUpperCase();
          await apiService.updateOrder(table.id, {
            items: table.orders,
            status: backendStatus,
            customerName: table.customerName || table.customer_name || '',
            phone: table.phone || '',
            gst_enabled: table.gst_enabled,
            gst_rate: table.gst_rate,
            service_charge_enabled: table.service_charge_enabled,
            service_charge_rate: table.service_charge_rate
          });
          logger.success('KOT', `Background auto-retry synced Table ${table.table_number || table.id} to server.`);
          setTables(prev => prev.map(t => t.id === table.id ? { ...t, isUnsynced: false } : t));
        } catch (err) {
          logger.warn('KOT', `Background auto-retry sync for Table ${table.table_number || table.id} pending: ${err.message}`);
        }
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [tables]);
  const [takeawayCounter, setTakeawayCounter] = useState(() => loadFromLocal('pos_ta_counter', 1));
  const [lastCounterDate, setLastCounterDate] = useState(() => loadFromLocal('pos_ta_date', new Date().toDateString()));
  const [appVersion, setAppVersion] = useState({ version: 'v1.0-stable', lastUpdated: '2026-04-19' });
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

  useEffect(() => { selectedTableRef.current = selectedTable; }, [selectedTable]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      // Full system sync
      const data = await apiService.syncLocalData({ tables, menu: menuItems });
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

  console.log('📡 Base URL:', BASE_URL);

  async function fetchCloudData() {
    try {
      const data = await apiService.fetchCloudSync();

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
    finalizeSelectTable(table, table.covers || table.seats || 2);
  };

  const finalizeSelectTable = (table, covers) => {
    setSelectedTable({
      ...table,
      id: table.id !== undefined ? table.id : table.tableId,
      orders: table.orders || table.items || [],
      type: table.type || 'Dine In',
      covers: covers
    });
    setCart([]);
    setView('ordering');
    setPendingCoversTable(null);
  };

  const restoreFromCloud = async () => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Cloud data restoration disabled.");
    try {
      const data = await apiService.fetchCloudSyncHealth(); // wait, fetchCloudSyncHealth is CLOUD_URL + "/sync" with timeout 6000
      // Actually fetchCloudSyncHealth returns data too. Let's just use it, or rename it. I'll use it for now.

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
        await apiService.clearTable(id);
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

  useEffect(() => {
    if (pinInput.length === 4) {
      if (pinInput === settings?.securityPin) {
        setUnlockedViews(prev => [...prev, view]);
        setPinInput('');
      } else {
        setTimeout(() => setPinInput(''), 600);
      }
    }
  }, [pinInput, settings?.securityPin, view]);

  const handleCancelOrder = (id) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Canceling orders disabled.");
    const sid = String(id || '').trim().toUpperCase();
    console.log("[handleCancelOrder] Attempting to cancel ID:", sid);
    setNonTableOrders(prev => {
      if (!Array.isArray(prev)) return [];
      const orderToCancel = prev.find(o => String(o.id || '').trim().toUpperCase() === sid);
      if (orderToCancel) {
        const cancelledOrder = { ...orderToCancel, status: 'CANCELED', paymentStatus: 'CANCELLED', timestamp: Date.now() };
        setOrderHistory(h => [cancelledOrder, ...h]);
      }
      const updated = prev.filter(o => String(o.id || '').trim().toUpperCase() !== sid);
      saveToLocal('pos_nontable_orders', updated);
      return updated;
    });
  };

  const clearTableFast = (id) => {
    deleteAnyOrder(id);
  };

  const handleCompleteAllPickups = () => {
    if (nonTableOrders.length === 0) return;
    if (window.confirm('Mark all ongoing pickup orders as completed and move them to history?')) {
      const completedOrders = nonTableOrders
        .filter(o => (o.orders?.length || o.items?.length || 0) > 0)
        .map(o => {
          const cartItems = o.orders || o.items || [];
          const subtotal = cartItems.reduce((acc, item) => acc + ((item.price || 0) * (item.qty || 0)), 0);
          const id = String(o.id || '');
          const type = o.type || (id.startsWith('DL-') || id.startsWith('DEL-') ? 'Delivery' : 'Takeaway');
          return {
            ...o,
            id: o.id,
            type,
            orderType: type,
            status: 'completed',
            paymentStatus: 'PAID',
            paymentMethod: o.paymentMethod || 'Cash',
            timestamp: new Date().toISOString(),
            grandTotal: o.grandTotal || subtotal,
            subtotal: o.subtotal || subtotal,
            cart: cartItems,
            items: cartItems,
            orders: cartItems,
          };
        });

      // Push to history (single entry per order — no duplicate from settleTable)
      setOrderHistory(prev => {
        const existingIds = new Set(prev.map(o => String(o.id)));
        const newEntries = completedOrders.filter(o => !existingIds.has(String(o.id)));
        const updated = [...newEntries, ...prev];
        saveToLocal('pos_order_history', updated.slice(0, 1000));
        return updated;
      });

      // Sync to backend ONLY (do NOT call settleTable which would add duplicates)
      completedOrders.forEach(o => {
        apiService.settleBill(o.id, o.paymentMethod || 'Cash', {
          ...o,
          cart: o.cart,
          grandTotal: o.grandTotal,
        }).catch(err => {
          console.warn("Failed to auto-settle bulk pickup:", err);
        });
      });

      // Clear non-table orders state
      setNonTableOrders([]);
      saveToLocal('pos_nontable_orders', []);
    }
  };

  const handleCreateNonTableOrder = (type) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Order creation disabled.");
    
    // 🔥 DELAYED CREATION: We don't increment counter or add to state yet.
    // We create a "Virtual" order that only exists in selectedTable state.
    const newOrder = {
      id: 'PENDING_PICKUP',
      name: `${type} (Pending)`,
      type,
      status: 'occupied',
      orders: [],
      items: [],
      createdAt: Date.now(),
      paymentStatus: 'UNPAID',
      paymentMethod: 'Cash',
      isPending: true
    };
    
    setSelectedTable(newOrder);
    setCart([]);
    setView('ordering');
  };

  const manualSyncCaptainOrders = async () => {
    try {
      const data = await apiService.fetchTables();
      if (data) {
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

  const loadHistory = async () => {
    try {
      const data = await apiService.fetchBillingHistory();
      const ordersArray = data && Array.isArray(data) ? data : (data && data.orders ? data.orders : []);
      const backendOrders = ordersArray.map(o => {
        const tableNum = String(o.table_number || '').toUpperCase();
        let orderType = o.type || o.orderType || '';
        if (!orderType || orderType === 'Order') {
          if (tableNum.startsWith('TA-') || tableNum.startsWith('TAK-')) orderType = 'Takeaway';
          else if (tableNum.startsWith('DL-') || tableNum.startsWith('DEL-')) orderType = 'Delivery';
          else orderType = 'Dine In';
        }
        const rawStatus = String(o.status || '').toUpperCase();
        const rawPayStatus = String(o.paymentStatus || o.payment_status || '').toUpperCase();

        const isCancelled = rawStatus === 'CANCELED' || rawStatus === 'CANCELLED' || rawPayStatus === 'CANCELLED' || rawPayStatus === 'CANCELED';
        const isCompleted = rawStatus === 'COMPLETED' || rawStatus === 'PAID' || rawPayStatus === 'PAID';

        return {
          ...o,
          id: String(o.id),
          type: orderType,
          orderType: orderType,
          customerName: o.customer_name || o.customerName || (orderType === 'Dine In' ? `Table ${o.table_number}` : 'Walk-In'),
          phone: o.phone || o.customerPhone || '',
          timestamp: o.created_at || o.timestamp,
          paymentStatus: isCancelled ? 'CANCELLED' : (isCompleted ? 'PAID' : 'UNPAID'),
          status: isCancelled ? 'cancelled' : (isCompleted ? 'completed' : rawStatus.toLowerCase()),
          grandTotal: Number(o.grand_total || o.total || 0),
          tipAmount: Number(o.tip_amount || 0),
          gstAmount: Number(o.gst_amount || 0),
          serviceCharge: Number(o.service_charge || 0),
          paymentMethod: o.payment_method || 'Cash',
          discountAmt: Number(o.discount_amount || 0),
          cart: typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || [])
        };
      });
      const sorted = backendOrders.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      setOrderHistory(sorted);
      saveToLocal('pos_order_history', sorted.slice(0, 1000));
    } catch (err) {
      console.warn("Failed to load order history from backend:", err);
    }
  };

  const loadMenu = async () => {
    localStorage.removeItem('pos_menu'); // purge old state
    try {
      const data = await apiService.fetchMenu();
      if (data) {
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

  const loadInventory = async () => {
    try {
      const data = await apiService.fetchInventoryItems();
      if (data && data.success) {
        setInventoryItems(data.items || []);
      }
    } catch (err) {
      console.warn("Failed to load inventory:", err);
    }
  };

  const loadTables = async () => {
    return apiService.fetchTables()
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
      const data = await apiService.fetchTableById(tableId);
      setCart([]); 
      setSelectedTable(data.table || data);
    } catch (err) {
      console.error("Failed to load table:", err);
    }
  };

  const addItemToTable = async (item) => {
    // Items are only synced to the backend when explicitly punched or saved.
    // This function is now a no-op to prevent auto-KOT on item selection.
  };

  const handleGlobalSearch = (val) => {
    setGlobalSearch(val);
    if (val.length > 0 && view !== 'orderhistory' && view !== 'order') {
      setView('orderhistory');
    }
  };

  const handleUpdateDeviceStatus = async (id, status) => {
    try {
      const res = await apiService.updateDeviceStatus(id, status);
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
      const res = await apiService.deleteDevice(id);
      if (res.success) {
        setDevices(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      alert('Failed to delete device');
    }
  };



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
        setOrderHistory(prev => [...toMove, ...prev]);
      }
      
      setNonTableOrders(toKeep);
      saveToLocal('pos_nontable_orders', toKeep);
      
      // 3. Update lastCounterDate
      setLastCounterDate(today);
      saveToLocal('pos_ta_date', today);
    }
  }, [lastCounterDate, nonTableOrders, orderHistory]);


  useEffect(() => { if (IS_LOCAL) saveToLocal('pos_settings', settings); }, [settings]);

  // --- VERSION & CONFIG FETCH ---

  useEffect(() => {
    apiService.fetchVersion()
      .then(data => setAppVersion(data))
      .catch(err => console.warn('Failed to load version info:', err));
  }, []);

  useEffect(() => {
    if (IS_LOCAL) {
      apiService.fetchLanInfo()
        .then(d => setLanUrl(d.url))
        .catch(() => {});
      loadTables();
      loadMenu();
      loadInventory();
      loadHistory();
      // ✅ CRITICAL FIX: Load active pickup/delivery orders from DB on startup
      // This ensures orders survive app restarts (they are saved to DB when created)
      apiService.fetchOrders()
        .then(dbOrders => {
          if (!Array.isArray(dbOrders)) return;
          // Find active (non-completed, non-cancelled) pickup/delivery orders from DB
          const activePickups = dbOrders.filter(o => {
            const tn = String(o.table_number || '').toUpperCase();
            const st = String(o.status || '').toUpperCase();
            return (tn.startsWith('TA-') || tn.startsWith('DL-') || tn.startsWith('TAK-') || tn.startsWith('DEL-'))
              && st !== 'COMPLETED' && st !== 'CANCELLED' && st !== 'CANCELED';
          });
          if (activePickups.length === 0) return;
          setNonTableOrders(prev => {
            const existingIds = new Set(prev.map(o => String(o.id).toUpperCase()));
            const toRestore = activePickups
              .filter(o => !existingIds.has(String(o.table_number).toUpperCase()))
              .map(o => {
                const items = Array.isArray(o.items) ? o.items : (() => { try { return JSON.parse(o.items || '[]'); } catch(e) { return []; } })();
                return {
                  id: o.table_number,
                  name: o.table_number,
                  type: 'Takeaway',
                  status: 'occupied',
                  orders: items.map(i => ({ ...i, qty: i.quantity || i.qty || 1 })),
                  items: items.map(i => ({ ...i, qty: i.quantity || i.qty || 1 })),
                  createdAt: new Date(o.created_at).getTime() || Date.now(),
                  notes: o.notes || ''
                };
              });
            if (toRestore.length === 0) return prev;
            console.log(`✅ Restored ${toRestore.length} active pickup order(s) from DB`);
            const merged = [...prev, ...toRestore];
            saveToLocal('pos_nontable_orders', merged);
            return merged;
          });
        })
        .catch(err => console.warn('⚠️ Could not restore pickup orders from DB:', err.message));
      
      // Load Global Settings from Backend
      apiService.fetchConfig("pos_settings")
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
        apiService.saveConfig("pos_settings", settings)
          .catch(err => console.warn("Failed to sync settings to backend"));
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
  useEffect(() => { if (IS_LOCAL) saveToLocal('pos_order_history', orderHistory.slice(0, 1000)); }, [orderHistory]);
  useEffect(() => { 
    if (IS_LOCAL) {
      saveToLocal('pos_nontable_orders', nonTableOrders); 
      if (socketRef.current) {
        socketRef.current.emit('sync_pickup_orders', nonTableOrders);
      }
    }
  }, [nonTableOrders]);


  const syncToBackend = async (isSilent = false, overrideHistory = null) => {
    setIsSyncing(true);
    try {
      const historyToSync = overrideHistory || loadFromLocal('pos_order_history') || orderHistory || [];
      const res = await fetch('/api/analytics/cloud-sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderHistory: historyToSync })
      });
      const data = await res.json();
      if (data.success) {
        if (!isSilent) {
          const syncedMsg = data.status?.syncedCount 
            ? `☁️ Synced ${data.status.syncedCount} item(s) live to your Cloud Dashboard!`
            : '☁️ Cloud Dashboard is fully up to date!';
          alert(syncedMsg);
        }
      } else {
        if (!isSilent) {
          alert(data.error || 'Cloud sync error');
        }
      }
    } catch (err) {
      if (!isSilent) {
        alert('Failed to connect to sync service.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!IS_LOCAL) return;
    const timer = setTimeout(() => {
      syncToCloud(); // Fire to new cloud URL after data changes (menu, tables, orders)
    }, 5000);
    return () => clearTimeout(timer);
  }, [menuItems, nonTableOrders, categories]);

  // ─── 30s Periodic Cloud Sync & Online Reconnection Trigger ─────
  useEffect(() => {
    if (!IS_LOCAL) return;
    
    // Initial sync 2 seconds after startup
    const initTimer = setTimeout(() => {
      syncToBackend(true);
    }, 2000);

    // 30-second continuous sync interval
    const cloudInterval = setInterval(() => {
      console.log("☁️ 30s Interval: Syncing POS data to Cloud Dashboard...");
      syncToBackend(true);
    }, 30000);

    // Instant sync when internet connection turns back online
    const handleOnline = () => {
      console.log("📶 Internet reconnected! Triggering instant Cloud Sync...");
      syncToBackend(true);
    };

    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(initTimer);
      clearInterval(cloudInterval);
      window.removeEventListener('online', handleOnline);
    };
  }, [orderHistory]);
  
  const loadCategories = async () => {
    localStorage.removeItem('pos_categories'); // purge old state
    try {
      const data = await apiService.fetchCategories();
      if (data) {
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
    loadInventory();
  }, []);

  useEffect(() => {
    localStorage.removeItem('pos_tables');
    apiService.fetchTables()
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
  const suppressLocalKotPrint = useRef(false); // Prevents this terminal's own KOT sync from triggering auto-print
  const socketRef = useRef(null);
  const notificationSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const settingsRef = useRef(settings);
  const menuRef = useRef([...menuItems, ...products]);
  const recentlySavedRef = useRef(new Map()); // Map<tableId, timestamp>

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
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      socketRef.current.on('connect', () => {
        setSocketConnected(true);
      });
      socketRef.current.on('reconnect_attempt', (attempt) => {
        console.log(`[Socket] Reconnect attempt #${attempt}`);
      });
      socketRef.current.on('reconnect', () => {
        console.log('[Socket] Reconnected successfully');
      });
      socketRef.current.on('shift_history_updated', (history) => {
        setShiftHistory(history || []);
      });

      socketRef.current.on('connect_error', () => {
        // Silently fail — backend is optional
        setSocketConnected(false);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.warn('[Socket] Disconnected from server:', reason);
        setSocketConnected(false);
      });

      socketRef.current.on('table_updated', (allTables) => {
        console.log("LIVE SYNC:", Array.isArray(allTables) ? allTables.length : 'NOT_ARRAY');
        const safeTables = Array.isArray(allTables) ? allTables : [];
        
        setTables(prev => {
          const normalized = safeTables.map(t => ({
            ...t,
            name:   t.name || t.table_number || String(t.id),
            type:   t.type || t.zone || 'Main Floor',
            status: t.status, 
            orders: t.items || t.orders || t.order_items || [],
            total:  t.total || t.orderValue || 0,
            gst_enabled: Boolean(t.gst_enabled),
            gst_rate: t.gst_rate,
            service_charge_enabled: Boolean(t.service_charge_enabled),
            service_charge_rate: t.service_charge_rate,
            customerName: t.customerName || t.customer_name || '',
            customer_name: t.customer_name || t.customerName || '',
            phone: t.phone || ''
          }));

          // 🛡️ PREVENT CLOBBERING: If we are currently editing a table, 
          // or if it was recently saved locally, do NOT let the global sync overwrite it.
          // Filter out captain orders for tables that are now vacant
          const vacantIdentifiers = safeTables
            .filter(t => !t.status || t.status.toLowerCase() === 'vacant' || t.status.toLowerCase() === 'available')
            .flatMap(t => [
              String(t.id).toUpperCase(),
              String(t.name || '').toUpperCase(),
              String(t.table_number || '').toUpperCase(),
              String(t.name || '').toUpperCase().replace(/^TABLE\s+/, '')
            ]);

          if (vacantIdentifiers.length > 0) {
            setNewCaptainOrders(prev => prev.filter(o => {
              const tNum = String(o.table_number || '').toUpperCase();
              const normNum = tNum.replace(/^TABLE\s+/, '');
              return !vacantIdentifiers.includes(tNum) && !vacantIdentifiers.includes(normNum);
            }));
          }

          return normalized.map(newT => {
            const tid = String(newT.id);
            const isVacantFromServer = !newT.status || newT.status.toLowerCase() === 'vacant' || newT.status.toLowerCase() === 'available';
            // If server says table is vacant, always accept server data (clears customer info)
            if (isVacantFromServer) return newT;
            if (selectedTableRef.current && String(selectedTableRef.current.id) === tid) {
              const localT = prev.find(t => String(t.id) === tid);
              if (localT) return { ...localT };
            }
            
            const lastSave = recentlySavedRef.current.get(tid);
            if (lastSave && (Date.now() - lastSave < 1500)) {
               const localT = prev.find(t => String(t.id) === tid);
               if (localT) return { ...localT };
            }
            
            return newT;
          });
        });
      });

        socketRef.current.on('order_updated', (payload) => {
        console.log("📢 Sync: Order Update Received", payload?.table_number || payload?.table_id);
        
        // --- Duplicate Prevention Guard ---
        // Use a timestamp-based UID so that subsequent orders for the same
        // table are NOT blocked. We only deduplicate the same socket event
        // if it fires twice within a very short window (same ms).
        const orderUid = payload.order_id 
          ? `${payload.order_id}-${payload.updated_at || ''}` 
          : null;
        if (orderUid && processedCaptainIds.current.has(orderUid)) {
          console.log("⏭️ Sync: Order already processed, skipping print", orderUid);
          return;
        }

        const matchFn = (t) => String(t.id) === String(payload.id) || String(t.id) === String(payload.table_id) || String(t.table_number) === String(payload.table_number);

        // Use backend status directly
        setTables(prev => prev.map(t => {
          if (matchFn(t)) {
            const items = payload.items || [];
            const isNowVacant = !payload.status || payload.status.toLowerCase() === 'vacant' || payload.status.toLowerCase() === 'available';
            if (isNowVacant) {
              const tVal = String(payload.table_number || payload.table_id || t.name || t.id).toUpperCase();
              const normVal = tVal.replace(/^TABLE\s+/, '');
              setNewCaptainOrders(prev => prev.filter(o => {
                const oVal = String(o.table_number || '').toUpperCase();
                const oNorm = oVal.replace(/^TABLE\s+/, '');
                return oVal !== tVal && oNorm !== normVal;
              }));
            }
            return { 
              ...t, 
              status: payload.status, 
              orders: items, 
              total: payload.total || payload.orderValue || getOrderTotal(items),
              last_updated: payload.startedAt,
              gst_enabled: Boolean(payload.gst_enabled),
              gst_rate: payload.gst_rate,
              service_charge_enabled: Boolean(payload.service_charge_enabled),
              service_charge_rate: payload.service_charge_rate,
              customerName: isNowVacant ? '' : (payload.customerName || payload.customer_name || t.customerName || ''),
              customer_name: isNowVacant ? '' : (payload.customer_name || payload.customerName || t.customer_name || ''),
              phone: isNowVacant ? '' : (payload.phone || t.phone || '')
            };
          }
          return t;
        }));

        // Update local history if this was a settlement event from another device
        if (payload.status === 'vacant' && payload.settled_order) {
          setOrderHistory(prev => {
            const isVirtual = String(payload.table_number || payload.table_id || '').toUpperCase().startsWith('TA-') ||
                              String(payload.table_number || payload.table_id || '').toUpperCase().startsWith('DL-') ||
                              String(payload.table_number || payload.table_id || '').toUpperCase().startsWith('TAK-') ||
                              String(payload.table_number || payload.table_id || '').toUpperCase().startsWith('DEL-');
                              
            const exists = prev.some(o => 
              String(o.id) === String(payload.settled_order.id) ||
              (isVirtual && (
                String(o.id) === String(payload.table_number || payload.table_id) ||
                String(o.table_number || o.tableNumber) === String(payload.table_number || payload.table_id)
              ))
            );
            if (exists) return prev;

            const tableNum = String(payload.table_number || payload.table_id || '').toUpperCase();
            let orderType = payload.settled_order.type || payload.settled_order.orderType || '';
            if (!orderType || orderType === 'Order') {
              if (tableNum.startsWith('TA-') || tableNum.startsWith('TAK-')) orderType = 'Takeaway';
              else if (tableNum.startsWith('DL-') || tableNum.startsWith('DEL-')) orderType = 'Delivery';
              else orderType = 'Dine In';
            }

            const enrichedOrder = {
              ...payload.settled_order,
              id: isVirtual ? (payload.table_number || payload.table_id) : payload.settled_order.id,
              type: orderType,
              orderType: orderType,
              customerName: payload.settled_order.customerName || (orderType === 'Dine In' ? `Table ${payload.table_number}` : 'Walk-In')
            };

            return [enrichedOrder, ...prev];
          });
        }

        setSelectedTable(prev => {
          if (prev && matchFn(prev)) {
            const items = payload.items || [];
            return { 
              ...prev, 
              status: payload.status, 
              orders: items, 
              total: payload.total || payload.orderValue || getOrderTotal(items),
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

          setNewCaptainOrders(prev => [{
            id: payload.order_id || payload.id || Date.now(),
            table_number: payload.table_number,
            items: payload.new_items,
            timestamp: new Date().toISOString(),
            status: 'NEW'
          }, ...prev]);

          // Only auto-print if this event came from a DIFFERENT terminal (e.g. Captain App) and Auto-Print KOT is ON.
          // If suppressLocalKotPrint is set, this POS itself just sent the KOT — skip print.
          const isAutoPrintEnabled = localStorage.getItem('captain_auto_print_kot') !== 'false';
          console.log(`[Socket order_updated] is_new_kot=${payload.is_new_kot}, suppressLocalKotPrint.current=${suppressLocalKotPrint.current}, isAutoPrintEnabled=${isAutoPrintEnabled}`);
          if (!suppressLocalKotPrint.current && isAutoPrintEnabled) {
            console.log("🖨️ Auto-printing incoming KOT from remote device for Table", payload.table_number);
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
                  note: i.note || i.notes || i.special_note || '',
                  category: i.category || info?.category || 'General'
                };
              }),
              orderType: 'Dine In'
            }, 'KOT', settingsRef.current);
          } else {
            console.log("⏭️ Skipping auto-print — KOT was sent from this terminal");
          }
        }

        if (payload.is_bill_print) {
          console.log("🖨️ Auto-printing incoming BILL for Table", payload.table_number);
          
          // Use the bill_number assigned and locked by the backend
          const billNo = payload.bill_number || payload.billNumber || '---';

          printPosToSerial({
            orderId: payload.table_id || payload.id,
            tableName: `Table ${payload.table_number || payload.table_id || payload.id}`,
            items: (payload.items || payload.activeItems || []).map(i => ({
              ...i,
              qty: i.quantity || i.qty || 1,
              price: i.price || 0
            })),
            subtotal: payload.subtotal,
            serviceCharge: payload.scAmount,
            gstAmount: payload.gstAmount,
            grandTotal: payload.total || payload.orderValue,
            billNumber: billNo,
            orderType: payload.type || 'Dine In'
          }, 'BILL', settingsRef.current);
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

      socketRef.current.on('captain_new_pickup_order', (payload) => {
        console.log("📢 Captain Pickup Order Received", payload);
        
        const today = new Date().toDateString();
        const storedDate = loadFromLocal('pos_ta_date');
        let counter = loadFromLocal('pos_ta_counter') || 1;
        if (storedDate !== today) {
          counter = 1;
          saveToLocal('pos_ta_date', today);
        }
        const formattedCounter = String(counter).padStart(3, '0');
        const id = `TA-${formattedCounter}`;
        saveToLocal('pos_ta_counter', counter + 1);

        // Normalize items: ensure each item has both qty and quantity fields
        const normalizedItems = (payload.items || []).map(i => ({
          name: i.name,
          price: Number(i.price || 0),
          qty: Number(i.quantity || i.qty || 1),
          quantity: Number(i.quantity || i.qty || 1),
          category: i.category || 'General',
          isVeg: i.isVeg
        }));

        const orderTotal = normalizedItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
        const isPaymentSelected = payload.paymentMethod && payload.paymentMethod !== '';

        const newOrder = {
          id,
          name: payload.customerName ? `Pickup - ${payload.customerName}` : `Pickup ${formattedCounter}`,
          customerName: payload.customerName || '',
          phone: payload.phone || '',
          type: 'Takeaway',
          status: 'occupied',
          // 'orders' must be flat item array with qty — used by getOrderTotal in NonTableManagement
          orders: normalizedItems,
          items: normalizedItems,
          totalAmount: orderTotal,
          paymentStatus: isPaymentSelected ? 'PAID' : 'UNPAID',
          paymentMethod: payload.paymentMethod || 'Cash',
          notes: payload.notes || '',
          startTime: Date.now(),
          createdAt: Date.now(),
          source: 'CaptainApp'
        };

        setNonTableOrders(prev => {
          if (prev.some(o => o.id === id)) return prev;
          const updated = [...prev, newOrder];
          saveToLocal('pos_nontable_orders', updated);
          setTimeout(() => {
            if (socketRef.current) socketRef.current.emit('sync_pickup_orders', updated);
          }, 100);
          return updated;
        });

        const isAutoPrintEnabled = localStorage.getItem('captain_auto_print_kot') !== 'false';
        if (normalizedItems.length > 0 && isAutoPrintEnabled) {
          console.log("🖨️ Auto-printing incoming Pickup KOT from Captain App");
          printPosToSerial({
            orderId: id,
            tableName: newOrder.name,
            items: normalizedItems,
            orderType: 'Takeaway',
            customerName: payload.customerName || '',
            phone: payload.phone || ''
          }, 'KOT', settingsRef.current);
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
    if (isGlobalActionPending) return;

    setIsGlobalActionPending(true);
    let finalTid = String(tableId).trim().toUpperCase();

    if (finalTid === 'PENDING_PICKUP') {
      const type = orderDetails?.type || selectedTable?.type || 'Takeaway';
      const prefix = type === 'Delivery' ? 'DL' : 'TA';
      const currentCounter = takeawayCounter;
      const formattedCounter = String(currentCounter).padStart(3, '0');
      finalTid = `${prefix}-${formattedCounter}`;
      
      setTakeawayCounter(currentCounter + 1);
      saveToLocal('pos_ta_counter', currentCounter + 1);
    }

    const isFloorTable = !finalTid.startsWith('DEL-') && !finalTid.startsWith('TAK-') && !finalTid.startsWith('TA-') && !finalTid.startsWith('DL-');

    if (!orderDetails.splitPayments && orderDetails.paymentMethod === 'Split') {
      const splits = [];
      if (orderDetails.cashAmount) splits.push({ method: 'Cash', amount: orderDetails.cashAmount });
      if (orderDetails.upiAmount) splits.push({ method: 'UPI', amount: orderDetails.upiAmount });
      orderDetails.splitPayments = splits;
    }

    try {
      const res = await apiService.settleBill(finalTid, orderDetails.paymentMethod || 'Cash', orderDetails);
      
      // Update UI on success
      if (isFloorTable) {
        setTables(prev => prev.map(t => {
          if (String(t.id).toUpperCase() === finalTid || String(t.table_number).toUpperCase() === finalTid) {
            return { ...t, status: 'vacant', orders: [], items: [], total: 0, customerName: '', customer_name: '', phone: '' };
          }
          return t;
        }));
      } else {
        setNonTableOrders(prev => prev.filter(o => String(o.id || '').toUpperCase() !== finalTid));
      }

      // ✅ CRITICAL FIX: Always push completed order into orderHistory immediately after settlement.
      // This ensures the order appears in history and dashboard even after restart,
      // without waiting for the socket event (which may have empty cart for virtual tables).
      const cartItems = orderDetails.cart || orderDetails.orders || orderDetails.items || [];
      const computedRoundOff = (orderDetails.grandTotal || 0) - ((orderDetails.subtotal || 0) - (orderDetails.discountAmt || 0) + (orderDetails.serviceCharge || 0) + (orderDetails.gstAmount || 0));
      const completedEntry = res?.settled_order ? {
        ...res.settled_order,
        id: String(res.settled_order.id || finalTid),
        timestamp: res.settled_order.timestamp || new Date().toISOString(),
        roundOff: res.settled_order.roundOff !== undefined ? res.settled_order.roundOff : computedRoundOff
      } : {
        id: finalTid,
        table_number: finalTid,
        type: orderDetails.type || (isFloorTable ? 'Dine In' : 'Takeaway'),
        customerName: orderDetails.customerName || orderDetails.customer_name || (isFloorTable ? `Table ${finalTid}` : 'Walk-In'),
        paymentMethod: orderDetails.paymentMethod || 'Cash',
        grandTotal: orderDetails.grandTotal || 0,
        subtotal: orderDetails.subtotal || 0,
        serviceCharge: orderDetails.serviceCharge || 0,
        gstAmount: orderDetails.gstAmount || 0,
        tipAmount: orderDetails.tipAmount || 0,
        discountAmt: orderDetails.discountAmt || 0,
        roundOff: computedRoundOff,
        cart: cartItems,
        items: cartItems,
        orders: cartItems,
        timestamp: new Date().toISOString(),
        status: 'completed',
        paymentStatus: 'PAID',
        phone: orderDetails.phone || '',
        note: orderDetails.note || '',
      };

      setOrderHistory(prev => {
        // Avoid exact duplicates (same id + same grandTotal within 5 seconds)
        const isDuplicate = prev.some(o => 
          String(o.id) === String(completedEntry.id) && 
          o.grandTotal === completedEntry.grandTotal &&
          Math.abs(new Date(o.timestamp) - new Date(completedEntry.timestamp)) < 5000
        );
        if (isDuplicate) return prev;
        const updated = [completedEntry, ...prev];
        saveToLocal('pos_order_history', updated.slice(0, 1000));

        // Instant Cloud Sync on Settlement
        setTimeout(() => {
          syncToBackend(true, updated);
        }, 300);

        return updated;
      });

      recentlySavedRef.current.set(finalTid, Date.now());
      setView('tables');
      setSelectedTable(null);
    } catch (err) { 
      console.error("Settlement Failed:", err);
      alert("❌ SETTLEMENT FAILED: Could not settle bill on server. Table status was not changed. " + err.message);
    } finally {
      setIsGlobalActionPending(false);
    }
  };

  const saveOrderToTable = async (tableId, orderItems, newStatus, extraData = {}) => {
    if (!IS_LOCAL) return alert("Read-Only Mode: Saving orders disabled.");
    const tid = String(tableId || '').trim().toUpperCase();
    if (!tid) return;

    if (orderItems.length === 0) {
      if (tid !== 'PENDING_PICKUP') {
        deleteAnyOrder(tid);
      }
      return; // Never save or commit empty orders
    }

    let finalTid = tid;
    let isNewPickup = false;

    if (tid === 'PENDING_PICKUP') {
      const type = selectedTable?.type || 'Takeaway';
      const prefix = type === 'Delivery' ? 'DL' : 'TA';
      const currentCounter = takeawayCounter;
      const formattedCounter = String(currentCounter).padStart(3, '0');
      finalTid = `${prefix}-${formattedCounter}`;
      isNewPickup = true;
      
      // Consume the sequence number only now
      setTakeawayCounter(currentCounter + 1);
      saveToLocal('pos_ta_counter', currentCounter + 1);
    }

    if (finalTid.startsWith('DL-') || finalTid.startsWith('TA-') || finalTid.startsWith('DEL-') || finalTid.startsWith('TAK-')) {
      // Local management for non-table orders (still kept for offline resilience)
      setNonTableOrders(prev => {
        if (isNewPickup) {
          const newOrder = {
            id: finalTid,
            name: `${selectedTable?.type || 'Takeaway'} ${String(takeawayCounter).padStart(3, '0')}`,
            type: selectedTable?.type || 'Takeaway',
            status: newStatus,
            orders: orderItems,
            items: orderItems,
            createdAt: Date.now(),
            customerName: extraData.customerName,
            phone: extraData.customerPhone,
            note: extraData.note,
            paymentStatus: extraData.paymentStatus,
            paymentMethod: extraData.paymentMethod
          };
          const updated = [...prev, newOrder];
          saveToLocal('pos_nontable_orders', updated);
          return updated;
        }

        const updated = prev.map(o => {
             if (String(o.id).trim().toUpperCase() === finalTid) {
               return { ...o, orders: orderItems, items: orderItems, status: newStatus, customerName: extraData.customerName, phone: extraData.customerPhone, note: extraData.note, paymentStatus: extraData.paymentStatus, paymentMethod: extraData.paymentMethod };
             }
             return o;
        });
        saveToLocal('pos_nontable_orders', updated);
        return updated;
      });

      // ✅ CRITICAL FIX: Always persist pickup/delivery orders to SQLite DB so they survive app restarts
      try {
        if (isNewPickup) {
          // New pickup order — create a record in DB immediately
          await apiService.createOrder({
            table_number: finalTid,
            items: orderItems.map(i => ({ name: i.name, quantity: i.qty || i.quantity || 1, price: i.price, notes: i.note || '' })),
            notes: extraData.note || '',
            gst_enabled: extraData.gst_enabled,
            gst_rate: extraData.gst_rate,
            service_charge_enabled: false, // Takeaway orders don't have service charge
            service_charge_rate: 0,
            printKOT: false // Don't re-trigger KOT print from backend
          });
          console.log(`✅ Pickup order ${finalTid} persisted to DB`);
        } else {
          // Updating existing pickup order — update DB record
          const backendStatus = String(newStatus || 'occupied').toUpperCase();
          await apiService.updateOrder(finalTid, {
            items: orderItems,
            status: backendStatus,
            note: extraData.note,
            redeemedPoints: extraData.redeemedPoints || 0,
            cashAmount: extraData.cashAmount || 0,
            upiAmount: extraData.upiAmount || 0,
            splitPayments: extraData.splitPayments || []
          });
          console.log(`✅ Pickup order ${finalTid} updated in DB`);
        }
      } catch (syncErr) {
        console.warn('⚠️ Pickup order DB sync failed (saved locally):', syncErr.message);
      }

      setView('nontables');
    } else {
      // 1. UPDATE LOCALLY FIRST (Optimistic UI)
      setTables(prev => prev.map(t => {
        if (String(t.id).toUpperCase() === tid || String(t.table_number).toUpperCase() === tid) {
          const total = calculateGrandTotal(orderItems, {
            service_charge_enabled: extraData.service_charge_enabled,
            service_charge_rate: extraData.service_charge_rate,
            gst_enabled: extraData.gst_enabled,
            gst_rate: extraData.gst_rate
          });
          const isFreshOrder = !t.createdAt || t.status === 'vacant' || t.status === 'available' || !t.orders?.length;
          const newCreatedAt = isFreshOrder ? Date.now() : t.createdAt;
          return { 
            ...t, 
            status: newStatus || 'occupied', 
            orders: orderItems,
            total: total,
            createdAt: newCreatedAt,
            customerName: extraData.customerName || t.customerName || t.customer_name || '',
            customer_name: extraData.customerName || t.customer_name || t.customerName || '',
            phone: extraData.customerPhone || t.phone || '',
            gst_enabled: extraData.gst_enabled,
            gst_rate: extraData.gst_rate,
            service_charge_enabled: extraData.service_charge_enabled,
            service_charge_rate: extraData.service_charge_rate
          };
        }
        return t;
      }));
      recentlySavedRef.current.set(tid, Date.now());
      setView('tables');
    }

    setSelectedTable(null);

    try {
      if (newStatus === 'kot') {
        await apiService.createOrder({
          table_number: finalTid,
          items: orderItems.map(i => ({ name: i.name, quantity: i.qty, price: i.price, notes: i.note || '' })),
          notes: extraData.note || '',
          customerName: extraData.customerName || '',
          customer_name: extraData.customerName || '',
          phone: extraData.customerPhone || '',
          gst_enabled: extraData.gst_enabled,
          gst_rate: extraData.gst_rate,
          service_charge_enabled: extraData.service_charge_enabled,
          service_charge_rate: extraData.service_charge_rate
        });
      } else {
        const backendStatus = String(newStatus || 'occupied').toUpperCase();
        await apiService.updateOrder(finalTid, { 
          items: orderItems, 
          status: backendStatus,
          customerName: extraData.customerName || '',
          customer_name: extraData.customerName || '',
          phone: extraData.customerPhone || '',
          gst_enabled: extraData.gst_enabled,
          gst_rate: extraData.gst_rate,
          service_charge_enabled: extraData.service_charge_enabled,
          service_charge_rate: extraData.service_charge_rate,
          note: extraData.note,
          redeemedPoints: extraData.redeemedPoints || 0,
          cashAmount: extraData.cashAmount || 0,
          upiAmount: extraData.upiAmount || 0,
          splitPayments: extraData.splitPayments || []
        });
      }
    } catch (syncErr) {
      console.warn("⚠️ saveOrderToTable Backend Sync Failed:", syncErr);
      alert(`❌ SYNC ERROR: Order was saved locally but failed to reach the server. (${syncErr.message || 'Please check connection'})`);
      // Mark table as unsynced
      setTables(prev => prev.map(t => {
        if (String(t.id).toUpperCase() === tid || String(t.table_number).toUpperCase() === tid) {
          return { ...t, isUnsynced: true };
        }
        return t;
      }));
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

  const handleQuickSettleResult = async (tableId, orderDetails) => {
    await settleTable(tableId, orderDetails);
    setQuickSettleTable(null);
  };

  // Stats calculation for badges
  const stats = {
    liveOrders: nonTableOrders.filter(o => (o.orders?.length || o.items?.length || 0) > 0).length,
    activeTables: tables.filter(t => t.orders && t.orders.length > 0).length,
    activeOnline: nonTableOrders.filter(o => (o.orders?.length || o.items?.length || 0) > 0).length,
    pendingKot: tables.filter(t => t.orders && t.orders.length > 0).length + nonTableOrders.filter(o => (o.orders?.length || o.items?.length || 0) > 0).length,
    lowStock: inventoryItems.filter(i => i.current_stock <= i.low_stock_threshold).length
  };

  // ── Approval Wall ──────────────────────────────────────────
  if (deviceStatus === 'PENDING' || deviceStatus === 'BLOCKED') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '40px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: deviceStatus === 'PENDING' ? '#fef3c7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          {deviceStatus === 'PENDING' ? <Clock size={40} color="#d97706" /> : <X size={40} color="#dc2626" />}
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
          {deviceStatus === 'PENDING' ? 'Registration Pending' : 'Access Restricted'}
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '400px', lineHeight: '1.6', marginBottom: '32px' }}>
          {deviceStatus === 'PENDING' 
            ? `Your device (ID: ${deviceId}) is waiting for administrator approval. Please ask the manager to approve this terminal in Settings > Linked Devices.`
            : 'This device has been blocked from accessing the system. Please contact your administrator.'}
        </p>
        {deviceStatus === 'PENDING' && (
          <div style={{ padding: '12px 24px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', color: '#94a3b8', fontStyle: 'italic' }}>
            Device ID: <span style={{ color: '#111827', fontWeight: '500' }}>{deviceId}</span>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <RefreshCw size={48} className="animate-spin" style={{ marginBottom: '20px', color: 'var(--primary)' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '700' }}>Initializing Live Dashboard...</h2>
        <p style={{ color: '#94a3b8', marginTop: '10px' }}>Connecting to cloud backend...</p>
      </div>
    );
  }

  if (isKdsMode) {
    return (
      <div style={{ position: 'relative', display: 'flex', height: '100vh', width: '100vw', background: '#0f172a', overflow: 'hidden' }}>
        <GlobalStyles settings={settings} />
        <KitchenDisplay />
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
          onSettle={(payments, change, grandTotal, service, gst, subtotal, tip, discountAmt) => {
            const cartItems = quickSettleTable.orders || quickSettleTable.items || [];
            const primaryMethod = payments.length === 1 ? payments[0].method : 'Split';
            handleQuickSettleResult(quickSettleTable.id, { 
              id: quickSettleTable.id,
              type: quickSettleTable.type || 'Dine In',
              customerName: quickSettleTable.customerName || (quickSettleTable.table_number ? `Table ${quickSettleTable.table_number}` : 'Walk-In'),
              paymentMethod: primaryMethod, 
              splitPayments: payments,
              amountReceived: payments.reduce((acc, p) => acc + p.amount, 0), 
              changeDue: change,
              grandTotal: grandTotal,
              discountAmt: discountAmt || 0,
              serviceCharge: service,
              gstAmount: gst,
              subtotal: subtotal,
              tipAmount: tip,
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
          onPrint={async (discountAmt, service, gstAmount, grandTotal, discountRate, applyServiceCharge, applyGst) => {
            let billNo = quickPrintTable.bill_number;
            if (!billNo) {
              try {
                const res = await apiService.getBillNumber(quickPrintTable.id);
                billNo = res.bill_number;
              } catch (e) {
                const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
                const seqKey = `bill_seq_${today}`;
                let seq = parseInt(localStorage.getItem(seqKey) || '0', 10);
                seq += 1;
                localStorage.setItem(seqKey, seq.toString());
                billNo = seq.toString().padStart(4, '0');
              }
            }

            printPosToSerial({ 
              ...quickPrintTable, 
              items: quickPrintTable.orders, 
              tableName: quickPrintTable.name,
              subtotal: getOrderTotal(quickPrintTable.orders),
              discountAmt,
              discountRate: Number(discountRate || 0),
              serviceCharge: service,
              gstAmount: gstAmount,
              grandTotal,
              roundOff: (grandTotal - (getOrderTotal(quickPrintTable.orders) - discountAmt + service + gstAmount)).toFixed(2),
              billNumber: billNo,
              cashier: settings.cashierName || 'Biller'
            }, 'BILL', settings);
            
            // Persist status to backend so it doesn't revert on sync
            // Ensure we save the adjusted tax/charge settings to the table state so they persist for settlement
            saveOrderToTable(quickPrintTable.id, quickPrintTable.orders || [], 'printed', {
              service_charge_enabled: applyServiceCharge,
              service_charge_rate: settings?.serviceChargeRate || 5,
              gst_enabled: applyGst,
              gst_rate: settings?.gstRate || 5
            });
            
            setQuickPrintTable(null);
          }} 
        />
      )}

      {/* Confirmation Modal - Correctly Positioned at Root Level for Perfect Centering */}
      {tableToClear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
          <div className="animate-fade-in" style={{ background: 'white', padding: '32px', borderRadius: '20px', width: '380px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
             <div style={{ background: '#fee2e2', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Trash2 size={32} color="#dc2626" />
             </div>
            <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px', color: '#111827', letterSpacing: '-0.5px' }}>Clear Table?</h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px', lineHeight: '1.6', fontWeight: '500' }}>This will immediately remove all items from this table and restore it to vacant status. This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setTableToClear(null)}
                style={{ flex: 1, padding: '14px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '16px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
              >
                Go Back
              </button>
              <button
                onClick={() => { clearTableFast(tableToClear); setTableToClear(null); }}
                style={{ flex: 1, padding: '14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
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
        <header style={{ background: 'white', padding: '0 clamp(10px, 1vw, 16px)', height: 'clamp(50px, 5vw, 64px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', gap: 'clamp(6px, 0.8vw, 12px)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 0.8vw, 12px)', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', flexShrink: 0 }}>
              <Store size={18} />
              <h1 style={{ fontSize: 'clamp(12px, 1.1vw, 16px)', fontWeight: '600', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>{settings.resName}</h1>
            </div>
            <button onClick={() => setShowSidebar(!showSidebar)} style={{ padding: '7px', borderRadius: 'var(--radius-md)', background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
              <Menu size={18} />
            </button>
            <h1 style={{ fontSize: 'clamp(12px, 1.1vw, 16px)', fontWeight: '700', color: '#1e293b', letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 0.6vw, 10px)', flexShrink: 0 }}>
            {/* SYNC BUTTON */}
            {IS_LOCAL && (
              <button 
                onClick={syncToBackend} 
                disabled={isSyncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: 'clamp(6px, 0.7vw, 10px) clamp(10px, 1.2vw, 18px)', borderRadius: '16px', border: 'none',
                  background: isSyncing ? '#f1f5f9' : '#94161c',
                  color: isSyncing ? '#94a3b8' : 'white',
                  fontSize: 'clamp(10px, 0.9vw, 13px)', fontWeight: '600', cursor: isSyncing ? 'not-allowed' : 'pointer',
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
            <div 
              onClick={() => setShowDiagnosticsModal(true)}
              title="Click to view System Diagnostics & Logs"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: socketConnected ? '#ecfdf5' : '#fef2f2', padding: 'clamp(4px, 0.5vw, 8px) clamp(8px, 1vw, 14px)', borderRadius: '12px', border: '1px solid', borderColor: socketConnected ? '#10b981' : '#ef4444', transition: 'all 0.3s', cursor: 'pointer' }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: socketConnected ? '#10b981' : '#ef4444', boxShadow: `0 0 10px ${socketConnected ? '#10b981' : '#ef4444'}` }}></div>
              <span style={{ fontSize: '11px', fontWeight: '600', color: socketConnected ? '#065f46' : '#991b1b', textTransform: 'uppercase' }}>
                {socketConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Mobile QR & LAN Connect Button */}
            <button
              onClick={() => setShowLanModal(true)}
              title="Scan QR Code to connect Captain App / Mobile Phones"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: 'clamp(4px, 0.5vw, 8px) clamp(8px, 1vw, 14px)', borderRadius: '12px', background: '#0f172a', color: '#38bdf8', border: '1px solid #334155', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
            >
              <Smartphone size={14} color="#38bdf8" /> Mobile QR
            </button>

            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '16px', padding: '4px 12px', alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => handleGlobalSearch(e.target.value)}
                placeholder="Search..."
                style={{ background: 'none', border: 'none', padding: 'clamp(4px, 0.5vw, 8px)', outline: 'none', fontSize: 'clamp(11px, 0.9vw, 13px)', fontWeight: '600', width: 'clamp(80px, 10vw, 140px)' }}
              />
            </div>

            {/* GLOBAL NAVIGATION PILLS */}
            <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '5px', borderRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', flexShrink: 0 }}>
              <button onClick={() => setView('tables')} style={{ padding: 'clamp(5px, 0.6vw, 8px) clamp(10px, 1vw, 16px)', borderRadius: '10px', background: view === 'tables' ? 'var(--primary)' : 'transparent', color: view === 'tables' ? 'white' : '#64748b', fontWeight: '600', border: 'none', cursor: 'pointer', fontSize: 'clamp(10px, 0.9vw, 13px)', transition: 'all 0.2s', whiteSpace: 'nowrap', boxShadow: view === 'tables' ? '0 4px 12px rgba(148,22,28,0.2)' : 'none' }}>
                Tables
              </button>
              <button onClick={() => setView('nontables')} style={{ padding: 'clamp(5px, 0.6vw, 8px) clamp(10px, 1vw, 16px)', borderRadius: '10px', background: view === 'nontables' ? 'var(--primary)' : 'transparent', color: view === 'nontables' ? 'white' : '#64748b', fontWeight: '600', border: 'none', cursor: 'pointer', fontSize: 'clamp(10px, 0.9vw, 13px)', transition: 'all 0.2s', whiteSpace: 'nowrap', boxShadow: view === 'nontables' ? '0 4px 12px rgba(148,22,28,0.2)' : 'none' }}>
                Pickup
              </button>
            </div>
          </div>
        </header>
 
        <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          {/* PIN Lock Overlay */}
          {settings?.securityEnabled && ['analytics', 'dayclose', 'orderhistory', 'reports', 'profit-loss'].includes(view) && !unlockedViews.includes(view) && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'rgba(248, 250, 252, 0.95)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '320px', background: 'white', padding: '40px 30px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ width: '60px', height: '60px', background: '#fef2f2', color: '#94161c', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Lock size={28} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>Protected View</h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Please enter your 4-digit security PIN to view sales data.</p>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '30px' }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', background: pinInput.length > i ? '#94161c' : '#e2e8f0', transition: 'all 0.2s' }}></div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                    <button key={num} onClick={() => pinInput.length < 4 && setPinInput(p => p + num)} style={{ height: '50px', borderRadius: '15px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '18px', fontWeight: '700', color: '#1e293b', cursor: 'pointer' }}>{num}</button>
                  ))}
                  <button onClick={() => {
                    if (window.confirm(`Reset PIN? A recovery code will be sent to ${settings.securityPhone || 'your registered number'}. (Simulated)`)) {
                      const newPin = prompt("Enter new 4-digit PIN:");
                      if (newPin && newPin.length === 4) {
                        setSettings(prev => ({ ...prev, securityPin: newPin }));
                        alert("PIN updated successfully.");
                      }
                    }
                  }} style={{ fontSize: '11px', color: '#94161c', fontWeight: '600', border: 'none', background: 'none', cursor: 'pointer' }}>RESET</button>
                  <button onClick={() => pinInput.length < 4 && setPinInput(p => p + '0')} style={{ height: '50px', borderRadius: '15px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '18px', fontWeight: '700', color: '#1e293b', cursor: 'pointer' }}>0</button>
                  <button onClick={() => setPinInput(p => p.slice(0, -1))} style={{ height: '50px', borderRadius: '15px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '18px', fontWeight: '700', color: '#1e293b', cursor: 'pointer' }}>DEL</button>
                </div>
                
                {pinInput.length === 4 && pinInput !== settings.securityPin && (
                  <div style={{ marginTop: '20px', color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>❌ Incorrect PIN. Try again.</div>
                )}
                
                <button onClick={() => setView('tables')} style={{ marginTop: '24px', fontSize: '13px', fontWeight: '600', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

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
              shiftHistory={shiftHistory}
            />
          )}
          {view === 'nontables' && (
            <NonTableManagement orders={nonTableOrders} onSelectOrder={handleSelectTable} onCreateOrder={handleCreateNonTableOrder} onViewChange={setView} onQuickSettle={setQuickSettleTable} onQuickPrint={handleQuickPrint} onClearOrder={clearTableFast} onCancelOrder={handleCancelOrder} globalSearch={globalSearch} onCompleteAllPickups={handleCompleteAllPickups} />
          )}
          {(view === 'analytics' || view === 'reports') && (
            <ReportsHub orderHistory={orderHistory} menuItems={menuItems} tables={tables} nonTableOrders={nonTableOrders} products={products} loadHistory={loadHistory} initialTab="overview" />
          )}
          {view === 'crm' && (
            <ReportsHub orderHistory={orderHistory} menuItems={menuItems} tables={tables} nonTableOrders={nonTableOrders} products={products} loadHistory={loadHistory} initialTab="crm" />
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
            <KitchenDisplay />
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
                      const updatedOrders = [...(t.orders || []), ...mappedItems];
                      return {
                        ...t,
                        orders: updatedOrders,
                        total: getOrderTotal(updatedOrders),
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
            <OrderHistoryView 
              orderHistory={orderHistory} 
              onSelectActive={handleSelectTable} 
              globalSearch={globalSearch} 
              loadHistory={loadHistory} 
              setOrderHistory={setOrderHistory} 
              settings={settings} 
            />
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
              onOpenDiagnostics={() => setShowDiagnosticsModal(true)}
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
          {view === 'inventory' && (
            <InventoryManager
              menuItems={menuItems}
            />
          )}
          {view === 'pro_control' && (
            <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
               <div style={{ background: 'white', padding: '40px', borderRadius: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                     <Zap size={40} color="#821a1d" fill="#821a1d" />
                  </div>
                  <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1e293b' }}>Captain Pro Mode</h2>
                  <p style={{ color: '#64748b', marginTop: '8px', fontSize: '14px' }}>The remote floor controller is currently <b>{settings.captainProEnabled ? 'ACTIVE' : 'DISABLED'}</b>.</p>
                  
                  <div style={{ marginTop: '32px', padding: '20px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#475569' }}>Pro Mode Status</span>
                        <button 
                          onClick={() => {
                            const next = !settings.captainProEnabled;
                            const newSettings = { ...settings, captainProEnabled: next };
                            if (next && !settings.captainProPin) newSettings.captainProPin = '0000';
                            setSettings(newSettings);
                          }}
                          style={{ width: '60px', height: '30px', borderRadius: '15px', background: settings.captainProEnabled ? '#10b981' : '#cbd5e1', border: 'none', position: 'relative', cursor: 'pointer' }}
                        >
                           <div style={{ position: 'absolute', top: '4px', left: settings.captainProEnabled ? '34px' : '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'white', transition: 'all 0.2s' }} />
                        </button>
                     </div>
                  </div>

                  <button 
                    onClick={() => setView('globalsettings')}
                    style={{ marginTop: '24px', width: '100%', padding: '16px', borderRadius: '16px', background: '#1e293b', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                  >
                    Manage Pro PIN in Security Settings
                  </button>
               </div>
            </div>
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
              suppressLocalKotPrint={suppressLocalKotPrint}
              table={selectedTable}
              tables={tables}
              nonTableOrders={nonTableOrders}
              initialOrder={selectedTable?.orders || []}
              MENU_ITEMS={[...menuItems, ...products]}
              CATEGORIES={Array.from(new Set([...categories, ...productCategories]))}
              settings={settings}
              customers={customers}
              onChangeTable={async (oldId, newId, currentCart) => {
                if (isGlobalActionPending) return;
                if (selectedTable && oldId !== newId) {
                  const targetTable = tables.find(t => t.id === newId);
                  if (targetTable) {
                    setIsGlobalActionPending(true);
                    try {
                      await apiService.shiftTable(oldId, newId);
                      
                      // UI update will happen via Socket.IO, but we can reset view locally
                      setView('tables');
                      setSelectedTable(null);
                    } catch (err) {
                      alert("Failed to shift: " + err.message);
                    } finally {
                      setIsGlobalActionPending(false);
                    }
                  }
                }
              }}
              onBack={(currentCart) => {
                const tid = String(selectedTable?.id || '').toUpperCase();
                const isPending = tid === 'PENDING_PICKUP';
                const isNonTable = (selectedTable?.type === 'Takeaway' || selectedTable?.type === 'Delivery') || tid.startsWith('DEL-') || tid.startsWith('TAK-') || tid.startsWith('TA-') || tid.startsWith('DL-');

                if (selectedTable && isNonTable) {
                  const items = currentCart || [];
                  if (items.length === 0 || isPending) {
                    // Silently remove empty pickup orders or just discard pending ones
                    if (!isPending) {
                      const sid = tid.trim().toUpperCase();
                      setNonTableOrders(prev => {
                        const updated = prev.filter(o => String(o.id || '').trim().toUpperCase() !== sid);
                        saveToLocal('pos_nontable_orders', updated);
                        return updated;
                      });
                    }
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
              onCartSync={(updatedCart) => {
                if (!selectedTable) return;
                const tid = String(selectedTable.id);
                // Only update the socket lockout timer — do NOT write cart items
                // into the table's local state. Items only appear on the floor plan
                // after the order is explicitly punched (handleKOT / handleSave).
                recentlySavedRef.current.set(tid, Date.now());
              }}
              onSettleTable={settleTable}
              loadTables={loadTables}
            />
          )}

          {/* SYSTEM DIAGNOSTICS & ERROR LOGS MODAL */}
          <SystemDiagnosticsModal
            isOpen={showDiagnosticsModal}
            onClose={() => setShowDiagnosticsModal(false)}
          />

          {/* MOBILE QR & LAN CONNECT MODAL */}
          <LanConnectModal
            isOpen={showLanModal}
            onClose={() => setShowLanModal(false)}
          />

          {/* COVERS MODAL */}
          {pendingCoversTable && (
            <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
              <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', width: '90%', maxWidth: '360px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ width: '48px', height: '48px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <User size={24} color="#dc2626" />
                  </div>
                  <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>Number of Guests</h3>
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>How many people for {pendingCoversTable.name}?</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '32px' }}>
                  <button onClick={() => setCoversCount(Math.max(1, coversCount - 1))} style={{ width: '48px', height: '48px', borderRadius: '50%', border: 'none', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <Minus size={24} />
                  </button>
                  <div style={{ fontSize: '48px', fontWeight: '600', color: '#0f172a', width: '64px', textAlign: 'center', lineHeight: 1 }}>{coversCount}</div>
                  <button onClick={() => setCoversCount(coversCount + 1)} style={{ width: '48px', height: '48px', borderRadius: '50%', border: 'none', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <Plus size={24} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setPendingCoversTable(null)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'transparent', color: '#64748b', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => finalizeSelectTable(pendingCoversTable, coversCount)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: 'none', background: '#dc2626', color: 'white', fontWeight: '600', fontSize: '14px', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(220,38,38,0.3)' }}>Confirm</button>
                </div>
              </div>
            </div>
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
