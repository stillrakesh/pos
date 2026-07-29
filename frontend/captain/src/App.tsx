import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, UtensilsCrossed, Settings, ChevronLeft, LayoutGrid, RefreshCw, ShoppingBag, SendHorizontal, CheckCircle2, Wifi, WifiOff, Move, ArrowRightLeft, Clock, Zap, Lock, Trash2, CreditCard, Banknote, Smartphone, X, Printer, Save, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBackendURL } from './config';
import socket from './services/socket';
import { submitOrder, syncOfflineOrders, type OrderPayload } from './services/api';
import { LockScreen } from './components/LockScreen';
import { PickupModule } from './components/PickupModule';
import './index.css';

// --- TYPES ---
interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isVeg?: boolean;
  short_code?: string;
  modifiers?: { name: string; required: boolean; options: { name: string; price: number; }[] }[];
  add_ons?: { name: string; price: number; }[];
}

interface Table {
  id: string;
  number: string;
  status: 'draft' | 'kot_pending' | 'kot_printed' | 'billing' | 'vacant';
  capacity: number;
  orderCount?: number;
  orderValue?: number;
  subtotal?: number;   // pure item total before SC/GST — from server normalizeTable
  scAmount?: number;  // pre-computed service charge amount from server
  gstAmount?: number; // pre-computed GST amount from server
  activeItems?: { name: string; quantity: number; status?: 'held' | 'fired'; id?: string }[];
  createdAt?: number | null;
}

const TimeElapsed = ({ createdAt }: { createdAt: number | null | undefined }) => {
  const [elapsed, setElapsed] = useState('');
  
  useEffect(() => {
    if (!createdAt) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - createdAt) / 1000);
      const m = Math.floor(diff / 60);
      setElapsed(m === 0 ? '< 1 min' : m + ' min');
    }, 10000);
    
    const diff = Math.floor((Date.now() - createdAt) / 1000);
    const m = Math.floor(diff / 60);
    setElapsed(m === 0 ? '< 1 min' : m + ' min');
    
    return () => clearInterval(interval);
  }, [createdAt]);
  
  if (!elapsed) return null;
  return (
    <div style={{ fontSize: '10px', fontWeight: 900, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
      <Clock size={10} /> {elapsed}
    </div>
  );
};

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  uniqueId?: string;
  modifiers?: Record<string, string>;
  add_ons?: string[];
  course?: 'Starter' | 'Main' | 'Dessert';
  status?: 'held' | 'fired';
}



const App = () => {
  // Data State
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // UI State
  const [tableId, setTableId] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [proOriginalItems, setProOriginalItems] = useState<{name: string, quantity: number}[]>([]);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [settlingTable, setSettlingTable] = useState<Table | null>(null);
  const [clearingTable, setClearingTable] = useState<Table | null>(null);
  const [showQuickPrint, setShowQuickPrint] = useState(false);
  const [quickPrintTable, setQuickPrintTable] = useState<Table | null>(null);

  // Customization State
  const [customizingItem, setCustomizingItem] = useState<{
    item: MenuItem;
    selectedMods: Record<string, string>;
    selectedAddOns: string[];
    course: 'Starter' | 'Main' | 'Dessert' | undefined;
    isEdit: boolean;
    editIndex: number;
  } | null>(null);

  const [showSettings, setShowSettings] = useState(() => {
    let saved = localStorage.getItem('backend_url');

    if (saved) {
      // ── One-time migration ──────────────────────────────────────────────
      // Strip any path component (e.g. /captain/ or /captain//captain) that
      // may have been saved by an older version of the app.
      try {
        const clean = new URL(saved).origin;
        if (clean !== saved) {
          localStorage.setItem('backend_url', clean);
          saved = clean;
          console.log(`[Captain] Sanitized backend_url → ${clean}`);
        }
      } catch { /* leave as-is if unparseable */ }
      return false;
    }

    // Auto-Connect: if served over network (not localhost/dev server), use origin
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isDevServer = ['3000', '3001', '3101', '5173', '5174'].includes(window.location.port);

    if (window.location.protocol.startsWith('http') && !isLocalhost && !isDevServer) {
      localStorage.setItem('backend_url', window.location.origin);
      return false; // Skip settings
    }

    return true; // Show settings for manual entry
  });
  const [isLocked, setIsLocked] = useState(false);
  const [securityChecked, setSecurityChecked] = useState(false);
  const [pinLength, setPinLength] = useState(4);

  const [proPinLength] = useState(4);
  const [isProLocked, setIsProLocked] = useState(false);

  const [appMode, setAppMode] = useState<'home' | 'table' | 'pickup' | 'pro'>(() => {
    const saved = sessionStorage.getItem('captain_mode') as any;
    return saved || 'home';
  });
  const switchMode = (mode: 'home' | 'table' | 'pickup' | 'pro') => {
    if (mode === 'pro' && !sessionStorage.getItem('pro_unlocked')) {
      setIsProLocked(true);
      return;
    }
    sessionStorage.setItem('captain_mode', mode);
    setAppMode(mode);
  };
  const [pickupOrders, setPickupOrders] = useState<any[]>([]);
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'offline'>('offline');
  const [tempUrl, setTempUrl] = useState(() => {
    const raw = localStorage.getItem('backend_url') || window.location.origin;
    try { return new URL(raw).origin; } catch { return raw.replace(/\/+$/, ''); }
  });
  const [myTables, setMyTables] = useState<string[]>(() => {
    const saved = localStorage.getItem('my_tables');
    return saved ? JSON.parse(saved) : [];
  });
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [viewShiftHistory, setViewShiftHistory] = useState(false);
  const [offlineQueueLength, setOfflineQueueLength] = useState<number>(() => {
    try {
      return JSON.parse(localStorage.getItem('offline_orders') || '[]').length;
    } catch {
      return 0;
    }
  });

  const orderQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    order.forEach(i => {
      map.set(i.name, i.quantity);
    });
    return map;
  }, [order]);

  const origQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    proOriginalItems.forEach(i => {
      map.set(i.name, i.quantity || 0);
    });
    return map;
  }, [proOriginalItems]);

  // --- TABLE NORMALIZER (must be defined before fetchData) ---
  const mapTable = (t: any): Table => ({
    id: String(t.id),
    number: String(t.table_number || t.name || '').replace('Table ', ''),
    status: t.status || 'vacant',
    capacity: t.seats || 4,
    orderCount: (t.items || t.orders || []).length,
    orderValue: t.total || 0,
    subtotal: t.subtotal || 0,   // pure item total before SC/GST — from server normalizeTable
    scAmount: t.scAmount || 0,  // pre-computed service charge
    gstAmount: t.gstAmount || 0, // pre-computed GST
    activeItems: (t.items || t.orders || []).map((i: any) => ({ id: i.id, name: i.name, quantity: i.qty || i.quantity || 1, status: i.status })),
    createdAt: t.createdAt
  });

  // --- API FETCHERS ---
  const fetchData = useCallback(async (silent = false) => {
    const baseUrl = getBackendURL();
    if (!baseUrl) {
      if (!silent) setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setFetchError(null);

    try {
      const [tRes, mRes, sRes] = await Promise.all([
        fetch(`${baseUrl}/tables`),
        fetch(`${baseUrl}/menu`),
        fetch(`${baseUrl}/api/config/pos_settings`)
      ]);

      if (!tRes.ok || !mRes.ok || !sRes.ok) throw new Error('Backend failed to respond');

      const tData = await tRes.json();
      const rawTables = Array.isArray(tData) ? tData : (tData.tables || []);
      const rawMenuData = await mRes.json();
      let safeMenu: any[] = [];
      if (Array.isArray(rawMenuData)) safeMenu = rawMenuData;
      else if (rawMenuData?.items && Array.isArray(rawMenuData.items)) safeMenu = rawMenuData.items;
      else if (rawMenuData?.menu) safeMenu = Array.isArray(rawMenuData.menu) ? rawMenuData.menu : Object.values(rawMenuData.menu as Record<string, any[]>).flat();
      
      const fetchedTables: Table[] = rawTables.map(mapTable);

      const fetchedMenu: MenuItem[] = safeMenu.map((i: any) => ({
        id: String(i.id),
        name: i.name,
        price: Number(i.price),
        category: i.category || 'General',
        isVeg: (i.type || '').toLowerCase() === 'veg',
        short_code: i.short_code
      }));

      const sData = await sRes.json();

      setTables(fetchedTables);
      setMenu(fetchedMenu);
      setSettings(sData);
    } catch (err: any) {
      console.error('[CaptainApp] Fetch Error:', err);
      let errorMsg = 'Failed to load data from backend. Check settings.';
      if (err.message?.includes('Failed to fetch')) {
        errorMsg = 'NETWORK ERROR: Could not reach server. Ensure you are on the SAME Wi-Fi and using http:// (not https://).';
      } else if (err.message) {
        errorMsg = `ERROR: ${err.message}`;
      }
      setFetchError(errorMsg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);


  useEffect(() => {
    const baseUrl = getBackendURL();
    if (!baseUrl) { setLoading(false); return; }

    fetchData();
    syncOfflineOrders();

    // 12-second auto-sync interval for offline orders
    const syncInterval = setInterval(() => {
      syncOfflineOrders();
    }, 12000);

    // Listener to update UI when offline sync queue changes
    const handleSyncUpdate = () => {
      try {
        const len = JSON.parse(localStorage.getItem('offline_orders') || '[]').length;
        setOfflineQueueLength(len);
      } catch (e) {
        setOfflineQueueLength(0);
      }
    };
    window.addEventListener('offline-sync-updated', handleSyncUpdate);

    const onConnect = () => {
      setConnectionState('connected');
      fetchData(true); // silent refresh on reconnect
      syncOfflineOrders(); // attempt sync on reconnect
    };
    const onDisconnect = () => setConnectionState('reconnecting');
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', () => setConnectionState('reconnecting'));
    socket.io.on('reconnect_failed', () => setConnectionState('offline'));
    socket.on('shift_history_updated', (history: any[]) => {
      setShiftHistory(history || []);
    });

    socket.on('table_updated', (rawTables: any) => {
      const safeTables = Array.isArray(rawTables) ? rawTables : [];
      setTables(safeTables.map(mapTable));
    });

    socket.on('pickup_orders_updated', (orders: any[]) => {
      setPickupOrders(orders || []);
    });

    socket.on('order_updated', (payload: any) => {
      if (!payload) return;
      setTables(prev => prev.map(t => {
        const match = String(t.id) === String(payload.id) || String(t.id) === String(payload.table_id);
        if (!match) return t;
        return {
          ...t,
          status: payload.status || 'vacant',
          orderCount: (payload.items || []).length,
          orderValue: payload.total || 0,
          subtotal: payload.subtotal || 0,
          scAmount: payload.scAmount || 0,
          gstAmount: payload.gstAmount || 0,
          activeItems: (payload.items || []).map((i: any) => ({ id: i.id, name: i.name, quantity: i.quantity || i.qty || 1, status: i.status })),
          createdAt: payload.createdAt
        };
      }));
    });

    socket.on('menu_updated', (payload: any) => {
      const rawItems: any[] = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : payload?.menu ? (Array.isArray(payload.menu) ? payload.menu : Object.values(payload.menu as Record<string, any[]>).flat()) : [];
      setMenu(rawItems.map((i: any) => ({
        id: String(i.id),
        name: i.name,
        price: Number(i.price),
        category: i.category || 'General',
        isVeg: (i.type || '').toLowerCase() === 'veg',
        short_code: i.short_code
      })));
    });

    if (socket.connected) setConnectionState('connected');

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('offline-sync-updated', handleSyncUpdate);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('table_updated');
      socket.off('order_updated');
      socket.off('menu_updated');
    };
  }, [fetchData]);

  // --- SECURITY CHECK ---
  useEffect(() => {
    const checkSecurity = async () => {
      const baseUrl = getBackendURL();
      if (!baseUrl) {
        setSecurityChecked(true);
        return;
      }
      try {
        const [authRes, proRes] = await Promise.all([
          fetch(`${baseUrl}/api/auth/status`),
          fetch(`${baseUrl}/api/auth/pro-status`)
        ]);
        const data = await authRes.json();
        await proRes.json();

        if (data.success && data.enabled) {
          setPinLength(data.pinLength || 4);
          const unlocked = sessionStorage.getItem('captain_unlocked') === 'true';
          setIsLocked(!unlocked);
        } else {
          setIsLocked(false);
        }
      } catch (err) {
        console.error('Failed to check security:', err);
      } finally {
        setSecurityChecked(true);
      }
    };

    checkSecurity();
    const interval = setInterval(checkSecurity, 10000); // Check every 10s for config changes
    return () => clearInterval(interval);
  }, []);

  const handleUnlock = () => {
    sessionStorage.setItem('captain_unlocked', 'true');
    setIsLocked(false);
  };

  const toggleMyTable = (id: string) => {
    setMyTables(prev => {
      const next = prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id];
      localStorage.setItem('my_tables', JSON.stringify(next));
      return next;
    });
  };

  const table = useMemo(() => tables.find(t => t.id === tableId), [tables, tableId]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menu.map(i => i.category))).filter(Boolean);
    return ['All', ...cats.sort()];
  }, [menu]);

  const items = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return menu.filter(i => category === 'All' || i.category === category).sort((a,b) => a.name.localeCompare(b.name));
    }

    return menu.filter(i => {
      const matchesName = i.name.toLowerCase().includes(query);
      const matchesShortCode = i.short_code && String(i.short_code).toLowerCase().includes(query);
      // If searching, ignore category filter to allow global short code access
      return matchesName || matchesShortCode;
    }).sort((a, b) => {
      // Prioritize Exact Short Code
      const aExact = a.short_code?.toLowerCase() === query;
      const bExact = b.short_code?.toLowerCase() === query;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Prioritize Starts With Short Code
      const aStartsSC = a.short_code?.toLowerCase().startsWith(query);
      const bStartsSC = b.short_code?.toLowerCase().startsWith(query);
      if (aStartsSC && !bStartsSC) return -1;
      if (!aStartsSC && bStartsSC) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [category, search, menu]);

  const add = (m: MenuItem) => {
    // If it has required modifiers, open modal instead
    if (m.modifiers?.some(mod => mod.required) || m.add_ons?.length) {
      setCustomizingItem({
        item: m,
        selectedMods: {},
        selectedAddOns: [],
        course: undefined,
        isEdit: false,
        editIndex: -1
      });
      return;
    }
    
    // Quick Add for simple items
    setOrder(p => {
      const ex = p.find(i => i.id === m.id && !i.modifiers && !i.add_ons?.length);
      if (ex) return p.map(i => i === ex ? { ...i, quantity: i.quantity + 1 } : i);
      return [...p, { id: m.id, uniqueId: Math.random().toString(36).substring(7), name: m.name, price: m.price, quantity: 1, course: 'Main', status: 'fired' }];
    });
  };

  const dec = (uniqueId: string) => {
    setOrder(p => {
      const ex = p.find(i => (i.uniqueId || i.id) === uniqueId);
      if (ex && ex.quantity > 1) return p.map(i => (i.uniqueId || i.id) === uniqueId ? { ...i, quantity: i.quantity - 1 } : i);
      return p.filter(i => (i.uniqueId || i.id) !== uniqueId);
    });
  };

  const total = order.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalQty = order.reduce((s, i) => s + i.quantity, 0);

  const submit = async () => {
    if (!order.length || !table) return;
    setSending(true);

    const payload: OrderPayload = {
      tableId: table.id,
      tableNumber: table.number,
      items: order.map(i => ({ 
        name: i.name, 
        qty: i.quantity, 
        price: i.price,
        modifiers: i.modifiers,
        add_ons: i.add_ons,
        course: i.course,
        status: i.status || 'fired'
      })),
      notes,
      status: 'NEW'
    };

    // ── Optimistic Update ────────────────────────────────────────────────────
    // Immediately merge the new items into the local table state so the floor
    // view is already correct the moment the user lands back on it — no waiting
    // for a socket broadcast from the server.
    const newOrderTotal = order.reduce((s, i) => s + i.price * i.quantity, 0);
    setTables(prev => prev.map(t => {
      if (t.id !== table.id) return t;
      // Merge new items with existing items (same logic as the server)
      const merged = [...(t.activeItems || [])];
      order.forEach(newItem => {
        const ex = merged.find(i => i.name.toLowerCase() === newItem.name.toLowerCase());
        if (ex) {
          ex.quantity += newItem.quantity;
        } else {
          merged.push({ name: newItem.name, quantity: newItem.quantity });
        }
      });
      return {
        ...t,
        status: 'kot_pending' as const,
        orderCount: merged.length,
        orderValue: (t.orderValue || 0) + newOrderTotal,
        activeItems: merged,
        createdAt: t.createdAt || Date.now(),
      };
    }));
    // ────────────────────────────────────────────────────────────────────────

    try {
      await submitOrder(payload);
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setOrder([]);
        setNotes('');
        setTableId(null);
        setShowCart(false);
        // Silent background refresh to reconcile with real server state
        fetchData(true);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      // Rollback optimistic update — re-fetch real data from server
      fetchData(true);
      alert(err.message || 'Network error - floor might be disconnected.');
    } finally {
      setSending(false);
    }
  };

  const selectTable = (id: string) => {
    const t = tables.find(x => x.id === id);
    setTableId(id);
    if (appMode === 'pro' && t) {
      setProOriginalItems(t.activeItems || []);
      setOrder((t.activeItems || []).map(i => {
        const m = menu.find(mi => mi.name === i.name);
        return { id: m?.id || i.name, name: i.name, price: m?.price || 0, quantity: i.quantity };
      }));
    } else {
      setOrder([]);
      setProOriginalItems([]);
    }
  };

  const reset = () => {
    setTableId(null);
    setOrder([]);
    setProOriginalItems([]);
    setNotes('');
    setShowCart(false);
    setShowShift(false);
    setCategory('All');
    setSearch('');
  };

  const handleShift = async (targetId: string) => {
    if (!tableId) return;
    try {
      const baseUrl = getBackendURL();
      await fetch(`${baseUrl}/table/shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId: tableId, toId: targetId })
      });
      setTableId(targetId);
      setShowShift(false);
      fetchData(true);
    } catch (err: any) {
      alert("Failed to shift table: " + err.message);
    }
  };

  const handleMerge = async (targetId: string) => {
    if (!tableId) return;
    try {
      const baseUrl = getBackendURL();
      await fetch(`${baseUrl}/table/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId: tableId, secondaryId: targetId })
      });
      setShowMerge(false);
      fetchData(true);
    } catch (err: any) {
      alert("Failed to merge tables: " + err.message);
    }
  };

  const handleSplit = async (targetId: string) => {
    if (!tableId) return;
    // Mobile split moves HALF the items for simplicity or prompts in a more complex view.
    // For now, we'll just split half the items as a basic implementation on mobile, 
    // or ideally open a split cart. Let's just pass an empty items array and let the server handle error or 
    // wait, we need to pass items. Since mobile split might be complex, let's pass a prompt for now.
    
    // Quick split: moves the first active item to the new table.
    const t = tables.find(x => x.id === tableId);
    if (!t || !t.activeItems || t.activeItems.length === 0) return alert('No items to split');
    
    try {
      const baseUrl = getBackendURL();
      await fetch(`${baseUrl}/table/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: tableId, targetId: targetId, itemsToMove: [t.activeItems[0]] })
      });
      setShowSplit(false);
      fetchData(true);
    } catch (err: any) {
      alert("Failed to split table: " + err.message);
    }
  };

  const closeSettings = () => {
    // Always save ONLY the origin (strip any /captain/ or other path)
    // This is the single point where backend_url is persisted — keep it clean.
    let urlToSave = tempUrl.trim();
    try {
      urlToSave = new URL(urlToSave).origin; // "http://192.168.1.35:3101"
    } catch {
      urlToSave = urlToSave.replace(/\/+$/, '').split('/').slice(0, 3).join('/');
    }
    localStorage.setItem('backend_url', urlToSave);
    setShowSettings(false);
    // Reconnect socket and refetch data with updated URL
    import('./services/socket').then(m => m.reconnectSocket());
    fetchData();
  };

  if (showSettings) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Settings size={22} />
          <span style={{ fontWeight: 800, fontSize: '18px' }}>CONNECTION SETTINGS</span>
        </header>


        <div style={{ padding: '30px 20px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>Server Connection</h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>Enter the POS Server URL (e.g. http://192.168.1.50:3101)</p>
            <input 
              type="text" 
              value={tempUrl} 
              onChange={e => setTempUrl(e.target.value)}
              placeholder="http://192.168.1.35:3101"
              style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '15px', fontWeight: 700, outline: 'none', background: '#f8fafc' }}
            />
          </div>
          <div style={{ marginTop: '20px', background: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>Table Assignment</h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Select the tables you are currently serving. (Optional)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {tables.map(t => (
                <button key={t.id} onClick={() => toggleMyTable(t.id)}
                  style={{ padding: '12px 6px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, border: '1px solid', borderColor: myTables.includes(t.id) ? '#821a1d' : '#e2e8f0', background: myTables.includes(t.id) ? '#fef2f2' : 'transparent', color: myTables.includes(t.id) ? '#821a1d' : '#64748b' }}>
                  T{t.number}
                </button>
              ))}
            </div>
            <button onClick={closeSettings} style={{ width: '100%', marginTop: '30px', background: '#821a1d', color: '#fff', padding: '18px', borderRadius: '16px', fontSize: '16px', fontWeight: 900, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <CheckCircle2 size={20} /> SAVE & RETURN
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !tables.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column' }}>
        <RefreshCw className="animate-spin" size={32} color="#821a1d" />
        <p style={{ marginTop: '16px', fontWeight: 600, color: '#64748b' }}>Establishing Connection...</p>
      </div>
    );
  }

  if (fetchError && !tables.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column', padding: '20px', textAlign: 'center' }}>
        <WifiOff size={48} color="#ef4444" />
        <h2 style={{ marginTop: '20px', fontWeight: 900, fontSize: '20px' }}>CONNECTION FAILED</h2>
        <p style={{ marginTop: '10px', color: '#64748b', fontSize: '14px' }}>{fetchError}</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
          <button onClick={() => fetchData()} style={{ background: '#821a1d', color: '#fff', padding: '12px 24px', borderRadius: '12px', fontWeight: 900 }}>RETRY</button>
          <button onClick={() => setShowSettings(true)} style={{ background: '#f1f5f9', color: '#64748b', padding: '12px 24px', borderRadius: '12px', fontWeight: 900 }}>SETTINGS</button>
        </div>
      </div>
    );
  }

  if (!securityChecked) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold text-sm">Verifying Access...</p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return <LockScreen onUnlock={handleUnlock} requiredLength={pinLength} />;
  }

  if (isProLocked) {
    return (
      <LockScreen 
        title="Captain Pro Access"
        description="Enter Pro PIN to access remote billing and floor control."
        verifyEndpoint="/api/auth/verify-pro"
        requiredLength={proPinLength}
        onUnlock={() => {
          sessionStorage.setItem('pro_unlocked', 'true');
          setIsProLocked(false);
          switchMode('pro');
        }}
        onCancel={() => setIsProLocked(false)}
      />
    );
  }

  // --- MODE SELECTION SCREEN ---
  if (!table && appMode === 'home') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    const occupiedCount = tables.filter(t => t.status !== 'vacant').length;
    const totalTables = tables.length;
    const activePickupCount = pickupOrders.filter(o => o.status !== 'completed' && o.status !== 'canceled').length;

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f1f5f9', display: 'flex', flexDirection: 'column', zIndex: 30, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>

        {/* Header — matches POS red header bar */}
        <header style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 16px rgba(130,26,29,0.3)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
              <LayoutGrid size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '16px', color: '#fff', letterSpacing: '0.5px' }}>CAPTAIN</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connectionState === 'connected' ? '#4ade80' : connectionState === 'reconnecting' ? '#facc15' : '#f87171' }} />
                <span style={{ fontSize: '10px', color: connectionState === 'connected' ? '#86efac' : connectionState === 'reconnecting' ? '#fef08a' : '#fca5a5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {connectionState === 'connected' ? 'Live' : connectionState === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => fetchData()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '9px', borderRadius: '10px', cursor: 'pointer', display: 'flex' }}><RefreshCw size={18} /></button>
            <button onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '9px', borderRadius: '10px', cursor: 'pointer', display: 'flex' }}><Settings size={18} /></button>
          </div>
        </header>

        {/* Date / time banner */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>{dateStr}</div>
            <div style={{ fontSize: '26px', fontWeight: 950, color: '#0f172a', letterSpacing: '-1px', lineHeight: 1.1 }}>{timeStr}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shift Status</div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: connectionState === 'connected' ? '#16a34a' : connectionState === 'reconnecting' ? '#ca8a04' : '#dc2626', marginTop: '2px' }}>
              {connectionState === 'connected' ? '● Online' : connectionState === 'reconnecting' ? '● Reconnecting' : '● Offline'}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px', flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 18px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Tables</div>
            <div style={{ fontSize: '32px', fontWeight: 950, color: '#0f172a', marginTop: '4px', lineHeight: 1 }}>
              {occupiedCount}<span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 700 }}>/{totalTables}</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#821a1d', marginTop: '4px' }}>Occupied Now</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 18px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Pickups</div>
            <div style={{ fontSize: '32px', fontWeight: 950, color: '#0f172a', marginTop: '4px', lineHeight: 1 }}>{activePickupCount}</div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>Active Orders</div>
          </div>
        </div>

        {/* Mode Cards */}
        <div style={{ flex: 1, padding: '4px 16px 32px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', paddingLeft: '4px', marginBottom: '4px' }}>Select Mode</div>

          <motion.button
            whileHover={{ y: -2, boxShadow: '0 12px 28px rgba(130,26,29,0.15)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => switchMode('table')}
            style={{ width: '100%', background: '#fff', border: '2px solid #e2e8f0', borderRadius: '24px', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: '18px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UtensilsCrossed size={26} color="#821a1d" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 950, color: '#0f172a', letterSpacing: '-0.3px' }}>Dine-in Tables</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', marginTop: '2px' }}>{occupiedCount} of {totalTables} tables occupied</div>
            </div>
            <ChevronLeft size={20} color="#cbd5e1" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
          </motion.button>

          <motion.button
            whileHover={{ y: -2, boxShadow: '0 12px 28px rgba(130,26,29,0.15)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => switchMode('pickup')}
            style={{ width: '100%', background: '#821a1d', border: '2px solid #821a1d', borderRadius: '24px', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: '18px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 8px 20px rgba(130,26,29,0.3)' }}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShoppingBag size={26} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 950, color: '#fff', letterSpacing: '-0.3px' }}>Pickup Orders</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>{activePickupCount} active takeaway {activePickupCount === 1 ? 'order' : 'orders'}</div>
            </div>
            <ChevronLeft size={20} color="rgba(255,255,255,0.5)" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
          </motion.button>

          {settings?.captainProEnabled !== false && (
            <motion.button
              whileHover={{ y: -2, boxShadow: '0 12px 28px rgba(130,26,29,0.15)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => switchMode('pro')}
              style={{ width: '100%', background: '#1e293b', border: '2px solid #334155', borderRadius: '24px', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: '18px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.2)', marginTop: '4px' }}
            >
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap size={26} color="#fbbf24" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: 950, color: '#fff', letterSpacing: '-0.3px' }}>Captain Pro</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>Service floor control & remote billing</div>
              </div>
              <Lock size={18} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
            </motion.button>
          )}
        </div>
      </div>
    );
  }

  if (appMode === 'pickup') {
    return (
      <PickupModule 
        pickupOrders={pickupOrders} 
        menuItems={menu} 
        categories={categories} 
        onBack={() => switchMode('home')} 
        onPlaceOrder={(payload) => {
          if (connectionState === 'connected') {
            socket.emit('captain_new_pickup_order', payload);
          } else {
            alert('Cannot place pickup order: Socket disconnected.');
          }
        }} 
      />
    );
  }


  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col font-sans select-none overflow-hidden relative">
      {!table ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f1f5f9', overflowY: 'auto' }}>
          <header style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => switchMode('home')} style={{ padding: '8px', marginLeft: '-8px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', border: 'none', color: 'white' }}>
                <ChevronLeft size={20} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LayoutGrid size={20} />
                <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.5px' }}>{appMode === 'pro' ? 'CAPTAIN PRO' : 'TABLES'}</span>
              </div>
              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: connectionState === 'connected' ? 'rgba(34,197,94,0.2)' : connectionState === 'reconnecting' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)', padding: '4px 8px', borderRadius: '20px' }}>
                {connectionState === 'connected' ? <Wifi size={12} color="#4ade80" /> : connectionState === 'reconnecting' ? <RefreshCw size={12} color="#facc15" className="animate-spin" /> : <WifiOff size={12} color="#f87171" />}
                <span style={{ fontSize: '10px', fontWeight: 900, color: connectionState === 'connected' ? '#4ade80' : connectionState === 'reconnecting' ? '#facc15' : '#f87171' }}>
                  {connectionState === 'connected' ? 'LIVE' : connectionState === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
                </span>
              </div>
              {offlineQueueLength > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(249,115,22,0.2)', padding: '4px 8px', borderRadius: '20px', border: '1px solid rgba(249,115,22,0.3)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316' }} />
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#f97316', letterSpacing: '0.5px' }}>
                    {offlineQueueLength} PENDING SYNC
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setViewShiftHistory(true)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px' }}><ArrowRightLeft size={20} /></button>
              <button onClick={() => fetchData()} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px' }}><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
              <button onClick={() => setShowSettings(true)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px' }}><Settings size={20} /></button>
            </div>
          </header>

          <div style={{ padding: '24px 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{myTables.length > 0 ? 'My Tables' : 'Real-time Floor'}</h1>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{myTables.length > 0 ? `Showing ${myTables.length} assigned tables` : 'Live table status from POS'}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', padding: '0 16px 40px' }}>
            {tables.filter(t => myTables.length === 0 || myTables.includes(t.id)).map(t => {
              const isOcc = t.status !== 'vacant';
              return (
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} key={t.id} onClick={() => selectTable(t.id)} className={`table-card status-${t.status || 'vacant'}`}
                  style={{ background: '#fff', border: isOcc ? '2px solid transparent' : '1px solid #e2e8f0', borderRadius: '24px', padding: '24px 20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                  {isOcc && (
                    <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <div style={{ padding: '4px 12px', background: t.status === 'draft' ? '#2563eb' : (t.status === 'kot_pending' || t.status === 'kot_printed') ? '#ca8a04' : t.status === 'billing' ? '#16a34a' : '#64748b', color: '#fff', fontSize: '9px', fontWeight: 900, borderBottomLeftRadius: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {(t.status === 'kot_pending' || t.status === 'kot_printed') ? 'RUNNING' : t.status.toUpperCase()}
                      </div>
                      <div style={{ paddingRight: '8px' }}>
                        <TimeElapsed createdAt={t.createdAt} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '28px', fontWeight: 950, color: isOcc ? '#0f172a' : '#1e293b' }}>{t.number}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                      <LayoutGrid size={14} />
                      <span style={{ fontSize: '11px', fontWeight: 800 }}>{t.capacity} Seats</span>
                    </div>
                  </div>
                  <div>{isOcc ? (<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><UtensilsCrossed size={14} color="#64748b" /><span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>{t.orderCount} Items</span></div><span style={{ fontSize: '16px', fontWeight: 950, color: '#0f172a' }}>₹{t.orderValue}</span></div>) : (<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }} /><span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>AVAILABLE</span></div>)}</div>
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <header style={{ background: '#821a1d', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '6px', borderRadius: '10px' }}><ChevronLeft size={24} /></button>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 900, fontSize: '16px' }}>Table {table.number}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {appMode === 'pro' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(table.status === 'kot_pending' || table.status === 'kot_printed') && (
                    <>
                      <button 
                        onClick={() => setClearingTable(table)} 
                        style={{ color: '#fff', background: 'rgba(239, 68, 68, 0.25)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '14px', padding: '10px 16px', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(10px)', transition: 'all 0.2s' }}
                      >
                        <Trash2 size={15} color="#fecaca" /> CLEAR
                      </button>
                      <button 
                        onClick={() => setShowShift(true)} 
                        style={{ color: '#fff', background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '12px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Move size={22} />
                      </button>
                    </>
                  )}
                  {table.status === 'billing' && (
                    <>
                      <button 
                        onClick={() => setClearingTable(table)} 
                        style={{ color: '#fff', background: 'rgba(239, 68, 68, 0.25)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '14px', padding: '10px 16px', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(10px)' }}
                      >
                        <Trash2 size={15} color="#fecaca" /> CLEAR
                      </button>
                      <button 
                        onClick={() => setSettlingTable(table)} 
                        style={{ color: '#047857', background: '#ecfdf5', border: '1.5px solid #d1fae5', borderRadius: '20px', padding: '10px 18px', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(4,120,87,0.15)' }}
                      >
                        <Banknote size={16} color="#047857" /> SETTLE BILL
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <button onClick={() => setShowShift(true)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '10px' }}><Move size={20} /></button>
                  <button onClick={() => setShowMerge(true)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '10px' }}><ArrowRightLeft size={20} /></button>
                  <button onClick={() => setShowSplit(true)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '10px' }}><LayoutGrid size={20} /></button>
                  <button onClick={() => setShowSettings(true)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '10px' }}><Settings size={20} /></button>
                  <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 800 }}>CLOSE</button>
                </>
              )}
            </div>
          </header>

          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px', flexShrink: 0 }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes..."
                style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', outline: 'none', background: '#f1f5f9' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="hide-scrollbar">
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{ padding: '8px 18px', borderRadius: '25px', fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap', background: category === c ? '#fbbf24' : '#f1f5f9', color: category === c ? '#000' : '#64748b', border: category === c ? '2px solid #b45309' : 'none' }}>{c}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }} className="hide-scrollbar">
            {table?.activeItems && table.activeItems.length > 0 && category === 'All' && search === '' && (
              <div style={{ marginBottom: '20px', padding: '16px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Already Ordered</span>
                  {table.activeItems.some(i => i.status === 'held') && (
                    <button 
                      onClick={async () => {
                        const baseUrl = getBackendURL();
                        try {
                          await fetch(`${baseUrl}/api/orders/fire`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tableId: table.id })
                          });
                          fetchData(true);
                        } catch (e) { console.error(e); }
                      }}
                      style={{ background: '#b45309', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}
                    >
                      FIRE HELD
                    </button>
                  )}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {table.activeItems.map((ai, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{ai.name}</span>
                        {ai.status === 'held' && <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>HELD</span>}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#821a1d', background: '#fef2f2', padding: '2px 8px', borderRadius: '8px' }}>x{ai.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {items.map(item => {
                const cartQty = orderQtyMap.get(item.name) || 0;
                const origQty = appMode === 'pro' ? (origQtyMap.get(item.name) || 0) : 0;
                const diffQty = cartQty - origQty;

                // Highlighting rules:
                // - In normal mode, highlight if quantity > 0
                // - In pro mode, only highlight if quantity has changed (diffQty !== 0)
                const isHighlighted = appMode === 'pro' ? diffQty !== 0 : cartQty > 0;
                const borderColor = isHighlighted ? '#821a1d' : '#eef2f6';
                const borderWidth = isHighlighted ? '2px' : '1px';

                return (
                  <div key={item.id} onClick={() => add(item)}
                    style={{ 
                      background: '#fff', 
                      borderRadius: '16px', 
                      padding: '16px 20px', 
                      border: `${borderWidth} solid ${borderColor}`, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px', 
                      position: 'relative', 
                      height: '80px', 
                      justifyContent: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                      touchAction: 'manipulation' // Removes 300ms click delay in mobile browsers
                    }}>
                    <div style={{ position: 'absolute', left: 0, top: '16px', bottom: '16px', width: '4px', background: item.isVeg ? '#22c55e' : '#ef4444', borderRadius: '0 4px 4px 0' }} />
                    
                    {/* Badge rendering */}
                    {appMode === 'pro' ? (
                      <>
                        {diffQty > 0 && (
                          <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#821a1d', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 950 }}>
                            +{diffQty}
                          </div>
                        )}
                        {diffQty < 0 && (
                          <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#dc2626', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 950 }}>
                            {diffQty}
                          </div>
                        )}
                      </>
                    ) : (
                      cartQty > 0 && (
                        <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#821a1d', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 950 }}>
                          {cartQty}
                        </div>
                      )
                    )}

                    <div style={{ paddingLeft: '8px' }}>
                      <p style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2, color: '#1e293b' }}>{item.name}</p>
                      <p style={{ fontSize: '16px', fontWeight: 950, color: '#821a1d' }}>₹{item.price}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {totalQty > 0 && !showCart && (
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} style={{ position: 'fixed', bottom: '20px', left: '16px', right: '16px', zIndex: 30 }}>
              <button onClick={() => setShowCart(true)} style={{ width: '100%', background: '#821a1d', color: '#fff', borderRadius: '18px', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 10px 25px rgba(130,26,29,0.4)', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 900 }}>{totalQty} ITEMS</div><span style={{ fontSize: '15px', fontWeight: 800 }}>VIEW CART</span></div>
                <span style={{ fontSize: '20px', fontWeight: 900 }}>₹{total}</span>
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCart(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(6px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '90vh', zIndex: 50, background: '#fff', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h2 style={{ fontSize: '20px', fontWeight: 900 }}>{appMode === 'pro' ? 'Modify Table' : 'Confirm KOT'}</h2><p style={{ fontSize: '13px', color: '#64748b' }}>Table {table?.number}</p></div>
                <button onClick={() => setShowCart(false)} style={{ fontSize: '24px', fontWeight: 900, background: 'none', border: 'none' }}>×</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                {order.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                    <ShoppingBag size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                    <p style={{ fontWeight: 600 }}>Your cart is empty</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {order.map(i => (
                      <div key={i.uniqueId || i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc', padding: '16px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '15px' }}>{i.name}</div>
                            {i.course && <span style={{ fontSize: '10px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>{i.course}</span>}
                            <button 
                              onClick={() => setOrder(p => p.map(item => (item.uniqueId || item.id) === (i.uniqueId || i.id) ? { ...item, status: item.status === 'held' ? 'fired' : 'held' } : item))}
                              style={{ fontSize: '10px', background: i.status === 'held' ? '#fef3c7' : '#f1f5f9', color: i.status === 'held' ? '#b45309' : '#64748b', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                            >
                              {i.status === 'held' ? 'HELD' : 'FIRE NOW'}
                            </button>
                          </div>
                          
                          {/* Modifiers & Add-ons */}
                          {(i.modifiers || i.add_ons) && (
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {i.modifiers && Object.entries(i.modifiers).map(([k,v]) => <span key={k}>• {k}: {v}</span>)}
                              {i.add_ons?.map(a => <span key={a}>+ {a}</span>)}
                            </div>
                          )}
                          
                          <div style={{ color: '#821a1d', fontWeight: 900, fontSize: '13px', marginTop: '4px' }}>₹{i.price * i.quantity}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                          <button onClick={() => dec(i.uniqueId || i.id)} style={{ border: 'none', background: 'none', color: '#821a1d', padding: '4px' }}>
                            {i.quantity > 1 ? <Minus size={18} /> : <Trash2 size={18} />}
                          </button>
                          <span style={{ fontWeight: 900, color: '#1e293b', minWidth: '20px', textAlign: 'center' }}>{i.quantity}</span>
                          <button onClick={() => setOrder(p => p.map(item => (item.uniqueId || item.id) === (i.uniqueId || i.id) ? { ...item, quantity: item.quantity + 1 } : item))} style={{ border: 'none', background: 'none', color: '#16a34a', padding: '4px' }}><Plus size={18} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ padding: '24px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                {appMode === 'pro' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button 
                      onClick={async () => {
                        if (!table) return;
                        setSending(true);
                        try {
                          const baseUrl = getBackendURL();
                          await fetch(`${baseUrl}/api/orders/${table.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              items: order.map(i => ({ name: i.name, qty: i.quantity, price: i.price })), 
                              status: 'occupied' // Explicitly set to occupied to avoid triggering KOT prints
                            })
                          });
                          reset();
                          fetchData(true);
                        } catch (err: any) { console.error(err); } finally { setSending(false); }
                      }}
                      style={{ background: '#475569', color: '#fff', borderRadius: '16px', padding: '14px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none' }}
                    >
                      <Save size={18} /> SAVE
                    </button>
                    <button 
                      disabled={sending}
                      onClick={() => {
                        if (!table) return;
                        setQuickPrintTable(table);
                        setShowQuickPrint(true);
                      }}
                      style={{ background: '#1e293b', color: '#fff', borderRadius: '16px', padding: '14px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', opacity: sending ? 0.7 : 1 }}
                    >
                      {sending ? <div className="animate-spin" style={{ width: '18px', height: '18px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} /> : <Printer size={18} />}
                      {sending ? 'SYNCING...' : 'BILL'}
                    </button>
                    <button 
                      onClick={() => {
                        const newItems = order.filter(i => {
                          const original = proOriginalItems.find(oi => oi.name === i.name);
                          return i.quantity > (original?.quantity || 0);
                        }).map(i => {
                          const original = proOriginalItems.find(oi => oi.name === i.name);
                          return { ...i, qty: i.quantity - (original?.quantity || 0) };
                        });
                        if (newItems.length === 0) return;
                        
                        const payload: OrderPayload = {
                          tableId: table!.id,
                          tableNumber: table!.number,
                          items: newItems.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
                          notes,
                          status: 'KOT_PENDING',
                          printKOT: false
                        };
                        submitOrder(payload).catch(console.error);
                        reset();
                        fetchData(true);
                      }}
                      style={{ background: '#d97706', color: '#fff', borderRadius: '16px', padding: '14px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none' }}
                    >
                      <SendHorizontal size={18} /> KOT
                    </button>
                    <button 
                      onClick={() => {
                        const newItems = order.filter(i => {
                          const original = proOriginalItems.find(oi => oi.name === i.name);
                          return i.quantity > (original?.quantity || 0);
                        }).map(i => {
                          const original = proOriginalItems.find(oi => oi.name === i.name);
                          return { ...i, qty: i.quantity - (original?.quantity || 0) };
                        });
                        if (newItems.length === 0) return;
                        
                        const payload: OrderPayload = {
                          tableId: table!.id,
                          tableNumber: table!.number,
                          items: newItems.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
                          notes,
                          status: 'KOT_PENDING',
                          printKOT: true
                        };
                        submitOrder(payload).catch(console.error);
                        reset();
                        fetchData(true);
                      }}
                      style={{ background: '#821a1d', color: '#fff', borderRadius: '16px', padding: '14px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none' }}
                    >
                      <Printer size={18} /> KOT+PRNT
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                      <span style={{ color: '#64748b', fontWeight: 700 }}>Total Payable</span>
                      <span style={{ fontSize: '24px', fontWeight: 950, color: '#821a1d' }}>₹{total}</span>
                    </div>
                    <button 
                      disabled={sending}
                      onClick={submit}
                      style={{ width: '100%', padding: '20px', background: '#821a1d', color: '#fff', borderRadius: '24px', border: 'none', fontWeight: 950, fontSize: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 12px 24px rgba(130,26,29,0.2)' }}
                    >
                      {sending ? <RefreshCw className="animate-spin" /> : <><SendHorizontal size={20} /> SEND TO KITCHEN</>}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShift && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShift(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(6px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '90vh', zIndex: 50, background: '#fff', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h2 style={{ fontSize: '20px', fontWeight: 900 }}>Shift Table</h2><p style={{ fontSize: '13px', color: '#64748b' }}>Select target table</p></div>
                <button onClick={() => setShowShift(false)} style={{ fontSize: '24px', fontWeight: 900, background: 'none', border: 'none' }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                   {tables.filter(t => t.status === 'vacant').map(t => (
                     <button key={t.id} onClick={() => handleShift(t.id)} style={{ padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 800 }}>T{t.number}</button>
                   ))}
                   {tables.filter(t => t.status === 'vacant').length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b', padding: '20px' }}>No vacant tables available</p>}
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMerge && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMerge(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(6px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '90vh', zIndex: 50, background: '#fff', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h2 style={{ fontSize: '20px', fontWeight: 900 }}>Merge Table</h2><p style={{ fontSize: '13px', color: '#64748b' }}>Select secondary table to merge into this one</p></div>
                <button onClick={() => setShowMerge(false)} style={{ fontSize: '24px', fontWeight: 900, background: 'none', border: 'none' }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                   {tables.filter(t => t.id !== tableId && t.status !== 'vacant').map(t => (
                     <button key={t.id} onClick={() => handleMerge(t.id)} style={{ padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 800 }}>T{t.number}</button>
                   ))}
                   {tables.filter(t => t.id !== tableId && t.status !== 'vacant').length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b', padding: '20px' }}>No active tables available to merge</p>}
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSplit && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSplit(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(6px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '90vh', zIndex: 50, background: '#fff', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h2 style={{ fontSize: '20px', fontWeight: 900 }}>Split Table</h2><p style={{ fontSize: '13px', color: '#64748b' }}>Select target table for quick split (moves 1st item)</p></div>
                <button onClick={() => setShowSplit(false)} style={{ fontSize: '24px', fontWeight: 900, background: 'none', border: 'none' }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                   {tables.filter(t => t.status === 'vacant').map(t => (
                     <button key={t.id} onClick={() => handleSplit(t.id)} style={{ padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 800 }}>T{t.number}</button>
                   ))}
                   {tables.filter(t => t.status === 'vacant').length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b', padding: '20px' }}>No vacant tables available for split</p>}
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ background: '#fff', borderRadius: '32px', padding: '40px 24px', textAlign: 'center', width: '85%', maxWidth: '360px' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><CheckCircle2 size={40} color="#22c55e" /></div>
              <h3 style={{ fontSize: '22px', fontWeight: 900 }}>KOT SENT!</h3>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOMIZATION MODAL */}
      <AnimatePresence>
        {customizingItem && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCustomizingItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, backdropFilter: 'blur(6px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '90vh', zIndex: 70, background: '#fff', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Customize {customizingItem.item.name}</h2>
                </div>
                <button onClick={() => setCustomizingItem(null)} style={{ fontSize: '24px', fontWeight: 900, background: 'none', border: 'none' }}>×</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Course Selection */}
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', marginBottom: '12px' }}>COURSE TAGGING</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    {['Starter', 'Main', 'Dessert'].map(c => (
                      <button 
                        key={c}
                        onClick={() => setCustomizingItem({ ...customizingItem, course: c as any })}
                        style={{ padding: '12px', borderRadius: '12px', border: `2px solid ${customizingItem.course === c ? '#821a1d' : '#e2e8f0'}`, background: customizingItem.course === c ? '#fff1f2' : '#fff', fontWeight: 800, color: customizingItem.course === c ? '#821a1d' : '#64748b' }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modifiers */}
                {customizingItem.item.modifiers?.map(mg => (
                  <div key={mg.name}>
                    <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                      {mg.name} {mg.required && <span style={{ color: '#ef4444' }}>*Required</span>}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {mg.options.map(opt => (
                        <button 
                          key={opt.name}
                          onClick={() => setCustomizingItem({ ...customizingItem, selectedMods: { ...customizingItem.selectedMods, [mg.name]: opt.name }})}
                          style={{ padding: '12px', borderRadius: '12px', border: `2px solid ${customizingItem.selectedMods[mg.name] === opt.name ? '#821a1d' : '#e2e8f0'}`, background: customizingItem.selectedMods[mg.name] === opt.name ? '#fff1f2' : '#fff', fontWeight: 800, color: customizingItem.selectedMods[mg.name] === opt.name ? '#821a1d' : '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                        >
                          <span>{opt.name}</span>
                          {opt.price > 0 && <span style={{ fontSize: '11px', marginTop: '4px' }}>+₹{opt.price}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Add-ons */}
                {customizingItem.item.add_ons && customizingItem.item.add_ons.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', marginBottom: '12px' }}>ADD-ONS</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {customizingItem.item.add_ons.map(addon => {
                        const isSelected = customizingItem.selectedAddOns.includes(addon.name);
                        return (
                          <button 
                            key={addon.name}
                            onClick={() => {
                              const newAddons = isSelected 
                                ? customizingItem.selectedAddOns.filter(a => a !== addon.name)
                                : [...customizingItem.selectedAddOns, addon.name];
                              setCustomizingItem({ ...customizingItem, selectedAddOns: newAddons });
                            }}
                            style={{ padding: '16px', borderRadius: '12px', border: `2px solid ${isSelected ? '#821a1d' : '#e2e8f0'}`, background: isSelected ? '#fff1f2' : '#fff', fontWeight: 800, color: isSelected ? '#821a1d' : '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <span>{addon.name}</span>
                            <span>+₹{addon.price}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '24px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                <button 
                  onClick={() => {
                    // Validate required modifiers
                    for (const mg of customizingItem.item.modifiers || []) {
                      if (mg.required && !customizingItem.selectedMods[mg.name]) {
                        alert(`Please select an option for ${mg.name}`);
                        return;
                      }
                    }

                    // Calculate total base price including modifier and addon prices
                    let finalPrice = customizingItem.item.price;
                    Object.entries(customizingItem.selectedMods).forEach(([groupName, optName]) => {
                      const group = customizingItem.item.modifiers?.find(g => g.name === groupName);
                      const opt = group?.options.find(o => o.name === optName);
                      if (opt) finalPrice += opt.price;
                    });
                    customizingItem.selectedAddOns.forEach(addonName => {
                      const addon = customizingItem.item.add_ons?.find(a => a.name === addonName);
                      if (addon) finalPrice += addon.price;
                    });

                    const uniqueId = Math.random().toString(36).substring(7);

                    setOrder(p => {
                      if (customizingItem.isEdit) {
                        const newOrder = [...p];
                        newOrder[customizingItem.editIndex] = {
                          ...newOrder[customizingItem.editIndex],
                          price: finalPrice,
                          course: customizingItem.course,
                          modifiers: customizingItem.selectedMods,
                          add_ons: customizingItem.selectedAddOns
                        };
                        return newOrder;
                      } else {
                        // Check if exact same configuration exists to stack quantity
                        const existingIdx = p.findIndex(i => 
                          i.id === customizingItem.item.id && 
                          JSON.stringify(i.modifiers) === JSON.stringify(customizingItem.selectedMods) && 
                          JSON.stringify(i.add_ons) === JSON.stringify(customizingItem.selectedAddOns) &&
                          i.course === customizingItem.course
                        );
                        
                        if (existingIdx >= 0) {
                          const newOrder = [...p];
                          newOrder[existingIdx].quantity += 1;
                          return newOrder;
                        }

                        return [...p, { 
                          id: customizingItem.item.id, 
                          uniqueId, 
                          name: customizingItem.item.name, 
                          price: finalPrice, 
                          quantity: 1, 
                          course: customizingItem.course,
                          status: 'fired',
                          modifiers: customizingItem.selectedMods,
                          add_ons: customizingItem.selectedAddOns
                        }];
                      }
                    });
                    setCustomizingItem(null);
                  }}
                  style={{ width: '100%', background: '#821a1d', color: '#fff', borderRadius: '16px', padding: '16px', fontWeight: 900, border: 'none', fontSize: '16px', cursor: 'pointer' }}
                >
                  Confirm Item
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewShiftHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewShiftHistory(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, backdropFilter: 'blur(6px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '90vh', zIndex: 70, background: '#fff', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><h2 style={{ fontSize: '20px', fontWeight: 900 }}>Table Shift History</h2><p style={{ fontSize: '13px', color: '#64748b' }}>Active shifts for running orders</p></div>
                <button onClick={() => setViewShiftHistory(false)} style={{ fontSize: '24px', fontWeight: 900, background: 'none', border: 'none' }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                {shiftHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>No active shifts for running tables.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {shiftHistory.map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <span style={{ fontWeight: 800, color: '#1e293b' }}>T{s.from}</span>
                          <span style={{ margin: '0 10px', color: '#94a3b8' }}>➔</span>
                          <span style={{ fontWeight: 900, color: '#16a34a' }}>T{s.to}</span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>{new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {settlingTable && (
          <ProSettlementModal
            table={settlingTable}
            settings={settings}
            onClose={() => setSettlingTable(null)}
            onComplete={async (payload) => {
              try {
                const baseUrl = getBackendURL();
                const res = await fetch(`${baseUrl}/api/billing/settle`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Settlement failed');
                setSettlingTable(null);
                reset();
                fetchData(true);
              } catch (err: any) { alert(err.message); }
            }}
          />
        )}
        {clearingTable && (
          <ClearTableModal
            onClose={() => setClearingTable(null)}
            onConfirm={async () => {
              try {
                const baseUrl = getBackendURL();
                const res = await fetch(`${baseUrl}/api/billing/clear/${clearingTable.id}`, { method: 'POST' });
                if (!res.ok) throw new Error('Clear failed');
                setClearingTable(null);
                reset();
                fetchData(true);
              } catch (err) { alert("Failed to clear table"); }
            }}
            table={clearingTable}
          />
        )}
        {showQuickPrint && quickPrintTable && (
          <QuickPrintModal 
            order={order}
            settings={settings}
            onClose={() => setShowQuickPrint(false)}
            onPrint={async (scEnabled, gstEnabled, discAmt, discType, discVal) => {
              setSending(true);
              try {
                const baseUrl = getBackendURL();
                // 1. Sync items and settings
                await fetch(`${baseUrl}/api/orders/${quickPrintTable.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    items: order.map(i => ({ name: i.name, qty: i.quantity, price: i.price })), 
                    status: 'BILLING',
                    service_charge_enabled: scEnabled,
                    service_charge_rate: settings?.serviceChargeRate || 5,
                    gst_enabled: gstEnabled,
                    gst_rate: settings?.gstRate || 5,
                    discount_amount: discType === 'amount' ? discAmt : 0,
                    discount_rate: discType === 'percent' ? Number(discVal) : 0
                  })
                });

                // 2. Trigger print
                await fetch(`${baseUrl}/api/billing/print-bill/${quickPrintTable.id}`, { method: 'POST' });
                
                setShowQuickPrint(false);
                reset();
                fetchData(true);
              } catch (err) {
                console.error("Print failed:", err);
                alert("Failed to print bill");
              } finally {
                setSending(false);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ClearTableModal = ({ onClose, onConfirm }: { table: Table, onClose: () => void, onConfirm: () => void }) => {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }} 
        style={{ 
          width: '100%', 
          maxWidth: '360px', 
          background: '#fff', 
          borderRadius: '32px', 
          padding: '32px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          textAlign: 'center', 
          gap: '16px', 
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 1001
        }}
      >
        <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '50%', marginBottom: '4px' }}>
          <Trash2 size={32} color="#ef4444" />
        </div>
        <h3 style={{ fontSize: '22px', fontWeight: 950, color: '#1e293b', margin: 0 }}>Clear Table?</h3>
        <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 700, lineHeight: 1.5, margin: 0, padding: '0 10px' }}>
          This will immediately remove all items from this table and restore it to vacant status. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '16px', borderRadius: '18px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 900, fontSize: '15px' }}>Go Back</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '16px', borderRadius: '18px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 950, fontSize: '15px', boxShadow: '0 8px 16px rgba(239,68,68,0.2)' }}>Yes, Discard</button>
        </div>
      </motion.div>
    </div>
  );
};

const ProSettlementModal = ({ table, settings, onClose, onComplete }: { table: Table, settings: any, onClose: () => void, onComplete: (payload: any) => void }) => {
  const [method, setMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [payments, setPayments] = useState<{ method: string, amount: number }[]>([]);
  const [amountPaidStr, setAmountPaidStr] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [showTipEntry, setShowTipEntry] = useState(false);
  const [processing, setProcessing] = useState(false);

  const scRate = settings?.serviceChargeRate || 5;
  const gstRate = settings?.gstRate || 5;

  // ─── Charge calculation (NO DOUBLE-CHARGING) ──────────────────
  // The server's normalizeTable always provides:
  //   table.subtotal  = pure item total (before SC/GST)
  //   table.scAmount  = pre-computed service charge (may be 0 if bill not yet printed)
  //   table.gstAmount = pre-computed GST
  //
  // Rule: SC is NEVER recalculated at settlement. We only include/exclude
  // the amount that was already computed when the bill was printed.
  // If the bill was NOT yet printed (scAmount=0), we compute SC from settings once.
  const itemSubtotal = (table.orderValue || 0) - (table.scAmount || 0) - (table.gstAmount || 0);

  // Determine the "locked" SC and GST from the print step, or compute if not yet set
  const lockedSC  = table.scAmount  || 0;
  const lockedGST = table.gstAmount || 0;

  // Toggles: default ON if server already applied the charge, else defer to settings
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(
    lockedSC > 0 ? true : (settings?.autoServiceCharge ?? false)
  );
  const [gstEnabled, setGstEnabled] = useState(
    lockedGST > 0 ? true : (settings?.gstEnabled ?? false)
  );

  // SC to apply: use pre-computed amount (from server) if available, else compute once
  const service = serviceChargeEnabled
    ? (lockedSC > 0 ? lockedSC : Math.floor(itemSubtotal * scRate / 100))
    : 0;

  // GST to apply: use pre-computed amount (from server) if available, else compute once
  const gst = gstEnabled
    ? (lockedGST > 0 ? lockedGST : Math.floor((itemSubtotal + service) * gstRate / 100))
    : 0;

  const grandTotal = Math.round(itemSubtotal + service + gst);
  // ──────────────────────────────────────────────────────────────

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + (parseFloat(amountPaidStr) || 0);
  const changeDue = totalPaid > grandTotal ? totalPaid - grandTotal : 0;
  const isExactPaid = totalPaid >= grandTotal;

  const handleAddPayment = () => {
    const amt = parseFloat(amountPaidStr);
    if (amt > 0) {
      setPayments([...payments, { method, amount: amt }]);
      setAmountPaidStr('');
    }
  };

  const handleSettle = async (finalPayments: { method: string, amount: number }[]) => {
    setProcessing(true);
    const paymentMode = finalPayments.length > 1 ? 'Split' : (finalPayments[0]?.method || 'Cash');
    
    onComplete({
      table_id: table.id,
      payment_mode: paymentMode,
      // Include at root for POS socket listener
      grandTotal: grandTotal,
      serviceCharge: service,
      gstAmount: gst,
      tipAmount: parseFloat(tipAmount) || 0,
      order_details: {
        grandTotal: grandTotal,
        paymentMethod: paymentMode,
        payments: finalPayments,
        tipAmount: parseFloat(tipAmount) || 0,
        serviceCharge: service,
        gstAmount: gst
      }
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 110, backdropFilter: 'blur(10px)' }} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '95vh', zIndex: 120, background: '#fff', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 -10px 25px rgba(0,0,0,0.1)' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
               <h3 style={{ fontSize: '20px', fontWeight: 950, color: '#1e293b' }}>Settle Bill: {table.number}</h3>
               <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>Quick settlement for {table.orderCount} items</p>
            </div>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '12px' }}><X size={24} color="#64748b" /></button>
         </div>

         <div style={{ background: '#fff1f2', borderRadius: '24px', padding: '16px', textAlign: 'center', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '10px', fontWeight: 900, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Total Payable</div>
            <div style={{ fontSize: '38px', fontWeight: 950, color: '#821a1d', letterSpacing: '-1px' }}>₹{grandTotal}</div>
         </div>

         {/* Breakdown & Toggles */}
         <div style={{ background: '#f8fafc', borderRadius: '20px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #e2e8f0' }}>
            {/* Item subtotal row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: '#64748b' }}>
               <span>Item Total</span>
               <span>₹{itemSubtotal}</span>
            </div>

            {/* Service Charge row — matches QuickPrintModal toggle exactly */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: serviceChargeEnabled ? '#fef2f2' : '#f8fafc', borderRadius: '14px', border: `1px solid ${serviceChargeEnabled ? '#fee2e2' : '#e2e8f0'}` }}>
               <div style={{ fontSize: '14px', fontWeight: 900, color: serviceChargeEnabled ? '#991b1b' : '#64748b' }}>Service Charge ({scRate}%)</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: serviceChargeEnabled ? '#991b1b' : '#94a3b8' }}>₹{service}</span>
                  <button
                    onClick={() => setServiceChargeEnabled(!serviceChargeEnabled)}
                    style={{ width: '44px', height: '24px', borderRadius: '12px', background: serviceChargeEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                  >
                    <div style={{ position: 'absolute', top: '3px', left: serviceChargeEnabled ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)' }}></div>
                  </button>
               </div>
            </div>

            {/* GST row — matches QuickPrintModal toggle exactly */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: gstEnabled ? '#f0fdf4' : '#f8fafc', borderRadius: '14px', border: `1px solid ${gstEnabled ? '#dcfce7' : '#e2e8f0'}` }}>
               <div style={{ fontSize: '14px', fontWeight: 900, color: gstEnabled ? '#166534' : '#64748b' }}>GST ({gstRate}%)</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: gstEnabled ? '#166534' : '#94a3b8' }}>₹{gst}</span>
                  <button
                    onClick={() => setGstEnabled(!gstEnabled)}
                    style={{ width: '44px', height: '24px', borderRadius: '12px', background: gstEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                  >
                    <div style={{ position: 'absolute', top: '3px', left: gstEnabled ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)' }}></div>
                  </button>
               </div>
            </div>
         </div>

         {/* FAST SETTLE BUTTONS */}
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              disabled={processing}
              onClick={() => handleSettle([{ method: 'Cash', amount: grandTotal }])}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', borderRadius: '16px', border: '1.5px solid #d1fae5', background: '#ecfdf5', color: '#047857', fontWeight: 950, fontSize: '14px' }}
            >
              <Banknote size={18} /> Cash Exact
            </button>
            <button
              disabled={processing}
              onClick={() => handleSettle([{ method: 'UPI', amount: grandTotal }])}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', borderRadius: '16px', border: '1.5px solid #ebf5ff', background: '#eff6ff', color: '#2563eb', fontWeight: 950, fontSize: '14px' }}
            >
              <Smartphone size={18} /> UPI Exact
            </button>
         </div>

         <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Detailed Payment</label>
            
            {payments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {payments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {p.method === 'Cash' && <Banknote size={14} />}
                      {p.method === 'UPI' && <Smartphone size={14} />}
                      {p.method === 'Card' && <CreditCard size={14} />}
                      <span>{p.method}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span>₹{p.amount}</span>
                      <button onClick={() => setPayments(payments.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ef4444' }}><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              {(['Cash', 'Card', 'UPI'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: '900', fontSize: '13px', border: '2px solid', borderColor: method === m ? '#821a1d' : '#f1f5f9', background: method === m ? '#fef2f2' : 'white', color: method === m ? '#821a1d' : '#64748b' }}
                >
                  {m}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                value={amountPaidStr}
                onChange={(e) => setAmountPaidStr(e.target.value)}
                placeholder="Amount Received..."
                style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '16px', fontWeight: '900', outline: 'none' }}
              />
              <button 
                onClick={handleAddPayment}
                disabled={!amountPaidStr || processing}
                style={{ padding: '0 20px', borderRadius: '16px', background: amountPaidStr ? '#10b981' : '#cbd5e1', color: 'white', border: 'none', fontWeight: '900' }}
              >
                Add
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '900' }}>
              <span style={{ color: isExactPaid ? '#10b981' : '#f59e0b' }}>
                {isExactPaid ? 'Payment Received' : `Pending ₹${grandTotal - totalPaid}`}
              </span>
              {isExactPaid && changeDue > 0 && <span style={{ color: '#1e293b' }}>Return ₹{changeDue}</span>}
            </div>

            {/* TIP SECTION */}
            <div style={{ marginTop: '4px' }}>
              {!showTipEntry ? (
                <button 
                  onClick={() => setShowTipEntry(true)}
                  style={{ background: 'none', border: 'none', color: tipAmount ? '#16a34a' : '#f59e0b', fontSize: '12px', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> {tipAmount ? `STAFF TIP: ₹${tipAmount} (Edit)` : 'ADD STAFF TIP'}
                </button>
              ) : (
                <div style={{ padding: '12px', background: '#fff7ed', borderRadius: '16px', border: '1px solid #ffedd5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={14} color="#f59e0b"/>
                      <span style={{ fontSize: '12px', fontWeight: '950', color: '#9a3412' }}>STAFF TIP</span>
                    </div>
                    <button onClick={() => { setShowTipEntry(false); setTipAmount(''); }} style={{ background: 'none', border: 'none', color: '#ef4444' }}><X size={14} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      autoFocus
                      type="number"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      placeholder="Enter Tip..."
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #fed7aa', background: 'white', fontSize: '14px', fontWeight: '900', outline: 'none' }}
                    />
                    <button onClick={() => setShowTipEntry(false)} style={{ padding: '0 16px', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', fontWeight: '900' }}>
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>
         </div>

         <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '18px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '16px', fontWeight: '900' }}>Cancel</button>
            <button 
              disabled={!isExactPaid || processing} 
              onClick={() => {
                const finalPayments = [...payments];
                const amt = parseFloat(amountPaidStr);
                if (amt > 0) finalPayments.push({ method, amount: amt });
                handleSettle(finalPayments.length > 0 ? finalPayments : [{ method: 'Cash', amount: grandTotal }]);
              }} 
              style={{ flex: 1.5, padding: '18px', background: isExactPaid ? '#821a1d' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '950', boxShadow: isExactPaid ? '0 10px 20px rgba(130,26,29,0.2)' : 'none' }}
            >
              {processing ? 'Processing...' : 'Settle Bill'}
            </button>
         </div>
      </motion.div>
    </>
  );
};



// --- COMPONENTS ---

const QuickPrintModal = ({ order, settings, onClose, onPrint }: { 
  order: OrderItem[], 
  settings: any, 
  onClose: () => void,
  onPrint: (sc: boolean, gst: boolean, discAmt: number, discType: 'amount'|'percent', discVal: string) => void 
}) => {
  const [discountVal, setDiscountVal] = useState('0');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(settings?.autoServiceCharge ?? true);
  const [gstEnabled, setGstEnabled] = useState(settings?.gstEnabled ?? true);

  const subtotal = order.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  
  let discountAmt = 0;
  if (discountType === 'percent') {
    discountAmt = Math.floor(subtotal * (parseFloat(discountVal) || 0) / 100);
  } else {
    discountAmt = parseFloat(discountVal) || 0;
  }

  const scRate = settings?.serviceChargeRate || 5;
  const gstRate = settings?.gstRate || 5;

  const service = serviceChargeEnabled ? Math.floor((subtotal - discountAmt) * scRate / 100) : 0;
  const taxableAmount = subtotal - discountAmt + service;
  const gstAmount = gstEnabled ? Math.floor(taxableAmount * (gstRate / 100)) : 0;
  const grandTotal = Math.round(taxableAmount + gstAmount);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(8px)', padding: '20px' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '32px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '950', color: '#1e293b' }}>Print & Adjust Bill</h2>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
          <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 800, marginBottom: '4px' }}>Subtotal</div>
            <div style={{ fontSize: '28px', fontWeight: '950', color: '#1e293b' }}>₹{subtotal}</div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: '900', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discount</div>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '16px', padding: '6px' }}>
              <input 
                type="number" 
                inputMode="decimal"
                value={discountVal} 
                onChange={e => setDiscountVal(e.target.value)}
                style={{ background: 'white', border: 'none', flex: 1, padding: '12px 16px', fontSize: '16px', borderRadius: '12px', outline: 'none', fontWeight: '700', color: '#1e293b' }}
              />
              <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
                <button 
                  onClick={() => setDiscountType('amount')}
                  style={{ width: '44px', height: '44px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '900', background: discountType === 'amount' ? 'white' : 'transparent', color: discountType === 'amount' ? '#821a1d' : '#64748b', boxShadow: discountType === 'amount' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none' }}
                >₹</button>
                <button 
                  onClick={() => setDiscountType('percent')}
                  style={{ width: '44px', height: '44px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '900', background: discountType === 'percent' ? 'white' : 'transparent', color: discountType === 'percent' ? '#821a1d' : '#64748b', boxShadow: discountType === 'percent' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none' }}
                >%</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fef2f2', borderRadius: '20px', border: '1px solid #fee2e2' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#991b1b' }}>Service Charge ({scRate}%)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '16px', fontWeight: '900', color: '#991b1b' }}>₹{service}</span>
              <button 
                onClick={() => setServiceChargeEnabled(!serviceChargeEnabled)}
                style={{ width: '44px', height: '24px', borderRadius: '12px', background: serviceChargeEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
              >
                <div style={{ position: 'absolute', top: '3px', left: serviceChargeEnabled ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f0fdf4', borderRadius: '20px', border: '1px solid #dcfce7' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#166534' }}>GST ({gstRate}%)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '16px', fontWeight: '900', color: '#166534' }}>₹{gstAmount}</span>
              <button 
                onClick={() => setGstEnabled(!gstEnabled)}
                style={{ width: '44px', height: '24px', borderRadius: '12px', background: gstEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
              >
                <div style={{ position: 'absolute', top: '3px', left: gstEnabled ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
              </button>
            </div>
          </div>

          <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '15px', color: '#64748b', fontWeight: '900' }}>PAYABLE AMOUNT</div>
            <div style={{ fontSize: '28px', fontWeight: '950', color: '#821a1d' }}>₹{grandTotal}</div>
          </div>
        </div>

        <button 
          onClick={() => onPrint(serviceChargeEnabled, gstEnabled, discountAmt, discountType, discountVal)}
          style={{ width: '100%', padding: '20px', background: '#821a1d', color: 'white', border: 'none', borderRadius: '20px', fontSize: '18px', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 10px 15px -3px rgba(130, 26, 29, 0.3)' }}
        >
          <Printer size={22} /> PRINT BILL
        </button>
      </motion.div>
    </div>
  );
};

export default App;
