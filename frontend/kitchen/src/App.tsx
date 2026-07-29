import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChefHat, Clock, ArrowLeft, RefreshCw, ChevronLeft, Flame, History, UtensilsCrossed, ConciergeBell, AlertCircle, Plus, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from './services/socket';
import { SwipeCard } from './components/SwipeCard';
import { SwipeItem } from './components/SwipeItem';
import { playNewOrderSound, playModifiedSound, vibrateDevice } from './utils/sounds';

// ── Types ──────────────────────────────────────────────────────
interface KdsItem {
  name: string;
  quantity: number;
  qty?: number;
  price: number;
  category: string;
  itemStatus?: 'NEW' | 'PREPARING' | 'READY' | 'SERVED';
  originalIndex?: number;
}

interface KdsTicket {
  id: number;
  table_number: string;
  items: KdsItem[];
  status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED';
  created_at: string;
}

interface KdsStation {
  id: number | string;
  name: string;
  label: string;
  categories: string[];
  color: string;
}

interface GroupedKdsItem {
  name: string;
  quantity: number;
  category: string;
  sources: { ticketId: number; originalIndex: number }[];
  isNew?: boolean;
}

interface TableGroup {
  table_number: string;
  created_at: string;
  kotIds: number[];
  items: GroupedKdsItem[];
  notification?: 'qty_updated' | 'new_item' | null;
}

type TableSnapshot = Record<string, Record<string, number>>;

// ── Live Timer ─────────────────────────────────────────────────
const LiveTimer = ({ createdAt }: { createdAt: string }) => {
  const [elapsed, setElapsed] = useState({ mins: 0, secs: 0 });

  useEffect(() => {
    if (!createdAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
      setElapsed({ mins: Math.floor(diff / 60), secs: diff % 60 });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [createdAt]);

  const urgent = elapsed.mins >= 10;
  const warning = elapsed.mins >= 5 && !urgent;
  const bg = urgent ? '#fef2f2' : warning ? '#fffbeb' : '#eff6ff';
  const border = urgent ? '#fca5a5' : warning ? '#fcd34d' : '#93c5fd';
  const color = urgent ? '#dc2626' : warning ? '#d97706' : '#2563eb';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      background: bg, border: `2px solid ${border}`,
      padding: '6px 12px', borderRadius: '12px',
      minWidth: '82px', justifyContent: 'center'
    }}>
      <Clock size={14} color={color} />
      <span style={{
        fontFamily: "'Outfit', monospace",
        fontSize: '18px', fontWeight: 950, color,
        letterSpacing: '-0.5px', lineHeight: 1
      }}>
        {String(elapsed.mins).padStart(2, '0')}:{String(elapsed.secs).padStart(2, '0')}
      </span>
    </div>
  );
};

// ── Server URL ─────────────────────────────────────────────────
const getServerUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.port === '5175' || window.location.port === '5173') {
      return `${window.location.protocol}//${window.location.hostname}:3101`;
    }
    return window.location.origin;
  }
  return 'http://localhost:3101';
};

// ── Normalize category ─────────────────────────────────────────
const getCategoryName = (cat: any): string => {
  if (typeof cat === 'object' && cat !== null) return cat.name || 'General';
  return typeof cat === 'string' ? cat : 'General';
};

// ════════════════════════════════════════════════════════════════
//  APP
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState<'stations' | 'queue' | 'server' | 'history'>('stations');
  const [selectedStationId, setSelectedStationId] = useState<string | number | null>(null);

  const [stations, setStations] = useState<KdsStation[]>([]);
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [allTickets, setAllTickets] = useState<KdsTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(socket.connected);

  // ── Change Detection State ───────────────────────────────────
  const [notifications, setNotifications] = useState<Record<string, 'qty_updated' | 'new_item'>>({});
  const [newItemKeys, setNewItemKeys] = useState<Set<string>>(new Set());
  const prevSnapshot = useRef<TableSnapshot>({});
  const isFirstLoad = useRef(true);

  // ── Debounce ref for rapid socket events ─────────────────────
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedStation = useMemo(() => {
    return stations.find(s => String(s.id) === String(selectedStationId)) || null;
  }, [stations, selectedStationId]);

  // ── Build snapshot: table → { itemName → totalQty } (filtered by station) ──
  const buildSnapshot = useCallback((tix: KdsTicket[], station: KdsStation | null): TableSnapshot => {
    const snap: TableSnapshot = {};
    const stCats = (station?.categories || []).map((c: string) => String(c).trim().toLowerCase());

    tix.forEach(t => {
      const table = t.table_number || 'Takeaway';
      (t.items || []).forEach(i => {
        const cat = getCategoryName(i.category).trim().toLowerCase();
        const matchCat = stCats.length === 0 || stCats.includes(cat);
        const isActive = i.itemStatus !== 'READY' && i.itemStatus !== 'SERVED';

        if (matchCat && isActive) {
          if (!snap[table]) snap[table] = {};
          snap[table][i.name] = (snap[table][i.name] || 0) + (i.qty || i.quantity || 1);
        }
      });
    });
    return snap;
  }, []);

  // ── Fetch data from server ───────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    const base = getServerUrl();
    try {
      if (!silent) setLoading(true);
      const [settings, tRes] = await Promise.all([
        fetch(`${base}/api/config/pos_settings`).then(r => r.json()).catch(() => null),
        fetch(`${base}/api/kds`).then(r => r.json()).catch(() => []),
      ]);

      const colors = ['#821a1d', '#0284c7', '#0ea5e9', '#059669', '#d97706', '#7c3aed', '#db2777'];
      let loadedStations: KdsStation[] = [];

      if (settings && Array.isArray(settings.printerStations) && settings.printerStations.length > 0) {
        loadedStations = settings.printerStations.map((s: any, idx: number) => ({
          id: s.id || s.name || idx,
          name: s.name,
          label: s.name,
          categories: Array.isArray(s.categories) ? s.categories : [],
          color: colors[idx % colors.length],
        }));
      } else {
        loadedStations = [
          { id: 'DRINKS', name: 'DRINKS', label: 'Drinks & Bar', categories: ['Drinks', 'Beverages', 'Bar'], color: '#0284c7' },
          { id: 'KITCHEN', name: 'MAIN KITCHEN', label: 'Main Kitchen', categories: ['Food', 'Main Course', 'Appetizers', 'Starters', 'General'], color: '#059669' },
        ];
      }

      if (!loadedStations.some(s => String(s.id).toUpperCase() === 'ALL' || String(s.name).toUpperCase() === 'ALL STATIONS')) {
        loadedStations.unshift({
          id: 'ALL',
          name: 'ALL STATIONS',
          label: 'All Stations',
          categories: [],
          color: '#821a1d'
        });
      }

      setStations(loadedStations);

      if (Array.isArray(tRes)) {
        const newSnap = buildSnapshot(tRes, selectedStation);
        const prev = prevSnapshot.current;

        if (!isFirstLoad.current && Object.keys(prev).length > 0) {
          const changedNotifs: Record<string, 'qty_updated' | 'new_item'> = {};
          const freshItems = new Set<string>();

          for (const [table, newItemMap] of Object.entries(newSnap)) {
            const oldItemMap = prev[table];
            const hadActiveItemsOnStation = oldItemMap && Object.keys(oldItemMap).length > 0;

            if (hadActiveItemsOnStation) {
              const allItemNames = new Set([...Object.keys(oldItemMap), ...Object.keys(newItemMap)]);

              for (const itemName of allItemNames) {
                const oldQty = oldItemMap[itemName] || 0;
                const newQty = newItemMap[itemName] || 0;

                if (oldQty === 0 && newQty > 0) {
                  changedNotifs[table] = 'new_item';
                  freshItems.add(`${table}::${itemName}`);
                } else if (newQty !== oldQty && newQty > 0) {
                  if (!changedNotifs[table]) changedNotifs[table] = 'qty_updated';
                }
              }
            }
          }

          if (Object.keys(changedNotifs).length > 0) {
            const hasNewItem = Object.values(changedNotifs).includes('new_item');
            if (hasNewItem) {
              playNewOrderSound();
              vibrateDevice([50, 80, 50]);
            } else {
              playModifiedSound();
              vibrateDevice(40);
            }

            setNotifications(p => ({ ...p, ...changedNotifs }));
            if (freshItems.size > 0) {
              setNewItemKeys(p => {
                const next = new Set(p);
                freshItems.forEach(k => next.add(k));
                return next;
              });
            }

            const toClear = { ...changedNotifs };
            const itemsToClear = new Set(freshItems);
            setTimeout(() => {
              setNotifications(p => {
                const next = { ...p };
                Object.keys(toClear).forEach(t => delete next[t]);
                return next;
              });
              setNewItemKeys(p => {
                const next = new Set(p);
                itemsToClear.forEach(k => next.delete(k));
                return next;
              });
            }, 10000);
          }
        }

        if (!isFirstLoad.current) {
          const newSnap2 = buildSnapshot(tRes, selectedStation);
          for (const table of Object.keys(newSnap2)) {
            if (!prev[table] && Object.keys(newSnap2[table]).length > 0) {
              playNewOrderSound();
              vibrateDevice([50, 80, 50]);
              break;
            }
          }
        }

        prevSnapshot.current = newSnap;
        isFirstLoad.current = false;
        setTickets(tRes);
      }
    } catch (err) {
      console.error('[Kitchen] Fetch error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [buildSnapshot]);

  const debouncedFetch = useCallback(() => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => fetchData(true), 100);
  }, [fetchData]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${getServerUrl()}/api/kds/all`);
      const data = await res.json();
      if (Array.isArray(data)) setAllTickets(data.filter((t: KdsTicket) => t.status === 'SERVED'));
    } catch (err) {
      console.error('[Kitchen] History error:', err);
    }
  }, []);

  // ── Socket + Initial Load ────────────────────────────────────
  useEffect(() => {
    fetchData();

    const onConnect = () => { setConnected(true); fetchData(true); };
    const onDisconnect = () => setConnected(false);
    const onKds = () => { debouncedFetch(); if (view === 'history') fetchHistory(); };
    const onOrderUpdate = () => debouncedFetch();
    const onTableUpdate = () => debouncedFetch();
    const onConfigUpdate = () => fetchData(true);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('kds_updated', onKds);
    socket.on('order_updated', onOrderUpdate);
    socket.on('table_updated', onTableUpdate);
    socket.on('config_updated', onConfigUpdate);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('kds_updated', onKds);
      socket.off('order_updated', onOrderUpdate);
      socket.off('table_updated', onTableUpdate);
      socket.off('config_updated', onConfigUpdate);
    };
  }, [view, debouncedFetch, fetchData, fetchHistory]);

  useEffect(() => { if (view === 'history') fetchHistory(); }, [view, fetchHistory]);

  // ── Item Status Update ───────────────────────────────────────
  const updateItemStatus = useCallback(async (ticketId: number, itemIndex: number, status: string) => {
    try {
      await fetch(`${getServerUrl()}/api/kds/${ticketId}/item`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIndex, status })
      });
    } catch (err) {
      console.error('[Kitchen] Update error:', err);
    }
  }, []);

  const completeGroupedCard = useCallback(async (items: GroupedKdsItem[]) => {
    const promises: Promise<any>[] = [];
    items.forEach(item => {
      item.sources.forEach(src => {
        promises.push(updateItemStatus(src.ticketId, src.originalIndex, 'READY'));
      });
    });
    await Promise.all(promises);
  }, [updateItemStatus]);

  const completeGroupedItem = useCallback(async (item: GroupedKdsItem) => {
    await Promise.all(item.sources.map(src =>
      updateItemStatus(src.ticketId, src.originalIndex, 'READY')
    ));
  }, [updateItemStatus]);

  // ── Station queue: group tickets by table, merge items ───────
  const stationQueue = useMemo((): TableGroup[] => {
    if (!selectedStation) return [];
    const cats = (selectedStation.categories || []).map((c: string) => String(c).trim().toLowerCase());
    const groups: Record<string, {
      table_number: string;
      created_at: string;
      kotIds: number[];
      itemMap: Record<string, GroupedKdsItem>;
    }> = {};

    tickets.forEach(t => {
      const filtered = (t.items || [])
        .map((item, index) => ({ ...item, ticketId: t.id, originalIndex: index }))
        .filter(item => {
          const cat = getCategoryName(item.category).trim().toLowerCase();
          const matchCat = cats.length === 0 || cats.includes(cat);
          return matchCat && item.itemStatus !== 'READY' && item.itemStatus !== 'SERVED';
        });
      if (filtered.length === 0) return;

      const table = t.table_number || 'Takeaway';
      if (!groups[table]) {
        groups[table] = { table_number: table, created_at: t.created_at, kotIds: [], itemMap: {} };
      }
      if (!groups[table].kotIds.includes(t.id)) groups[table].kotIds.push(t.id);

      filtered.forEach(item => {
        const cat = getCategoryName(item.category);
        const qty = item.qty || item.quantity || 1;
        if (!groups[table].itemMap[item.name]) {
          groups[table].itemMap[item.name] = {
            name: item.name,
            quantity: 0,
            category: cat,
            sources: [],
            isNew: newItemKeys.has(`${table}::${item.name}`),
          };
        }
        groups[table].itemMap[item.name].quantity += qty;
        groups[table].itemMap[item.name].sources.push({
          ticketId: item.ticketId,
          originalIndex: item.originalIndex,
        });
      });

      if (new Date(t.created_at).getTime() < new Date(groups[table].created_at).getTime()) {
        groups[table].created_at = t.created_at;
      }
    });

    return Object.values(groups)
      .map(g => ({
        table_number: g.table_number,
        created_at: g.created_at,
        kotIds: g.kotIds,
        items: Object.values(g.itemMap),
        notification: notifications[g.table_number] || null,
      }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [tickets, selectedStation, notifications, newItemKeys]);

  // ── Bulk quantity summary (for the pills bar) ────────────────
  const bulkQtySummary = useMemo(() => {
    const map: Record<string, number> = {};
    stationQueue.forEach(g => {
      g.items.forEach(item => {
        map[item.name] = (map[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(map)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [stationQueue]);

  // ── Server: items ready grouped by table ─────────────────────
  const serverGroups = useMemo(() => {
    const groups: Record<string, {
      items: (KdsItem & { ticketId: number; originalIndex: number })[];
      created_at: string;
    }> = {};
    tickets.forEach(t => {
      (t.items || []).forEach((item, idx) => {
        if (item.itemStatus === 'READY') {
          const table = t.table_number || 'Takeaway';
          if (!groups[table]) groups[table] = { items: [], created_at: t.created_at };
          groups[table].items.push({ ...item, ticketId: t.id, originalIndex: idx });
        }
      });
    });
    return Object.entries(groups)
      .map(([table, val]) => ({ table_number: table, ...val }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [tickets]);

  // ── Loading Screen ───────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#821a1d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChefHat size={28} color="#fff" />
        </div>
        <RefreshCw size={24} color="#821a1d" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b', letterSpacing: '0.5px' }}>Loading Kitchen...</span>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  HEADER (shared across all views)
  // ════════════════════════════════════════════════════════════
  const header = (
    <header style={{
      background: 'linear-gradient(135deg, #821a1d, #6b1518)',
      color: '#fff',
      padding: '14px 18px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 4px 20px rgba(130,26,29,0.35)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {view !== 'stations' && (
          <button
            onClick={() => { setView('stations'); setSelectedStationId(null); }}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', padding: '9px', borderRadius: '12px', display: 'flex', backdropFilter: 'blur(8px)' }}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div style={{ background: 'rgba(255,255,255,0.12)', padding: '8px', borderRadius: '12px', display: 'flex', backdropFilter: 'blur(8px)' }}>
          <ChefHat size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 950, fontSize: '15px', color: '#fff', letterSpacing: '0.5px' }}>
            {view === 'stations' && 'KITCHEN'}
            {view === 'queue' && (selectedStation?.label || 'STATION')}
            {view === 'server' && 'SERVER'}
            {view === 'history' && 'HISTORY'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: connected ? '#4ade80' : '#f87171',
              boxShadow: connected ? '0 0 6px #4ade80' : '0 0 6px #f87171',
            }} />
            <span style={{ fontSize: '10px', color: connected ? '#86efac' : '#fca5a5', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
      <button onClick={() => fetchData()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', padding: '9px', borderRadius: '12px', display: 'flex', backdropFilter: 'blur(8px)' }}>
        <RefreshCw size={18} />
      </button>
    </header>
  );

  // ════════════════════════════════════════════════════════════
  //  1. STATION SELECTION VIEW
  // ════════════════════════════════════════════════════════════
  if (view === 'stations') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

    const totalActive = tickets.filter(t => t.status !== 'SERVED').length;
    const readyCount = tickets.reduce((a, t) => a + (t.items || []).filter(i => i.itemStatus === 'READY').length, 0);

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {header}

        {/* Date & time banner */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>{dateStr}</div>
            <div style={{ fontSize: '24px', fontWeight: 950, color: '#0f172a', letterSpacing: '-1px', lineHeight: 1.1 }}>{timeStr}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kitchen Status</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: connected ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
              {connected ? '● Online' : '● Offline'}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '14px 16px', flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Orders</div>
            <div style={{ fontSize: '28px', fontWeight: 950, color: '#0f172a', marginTop: '4px', lineHeight: 1 }}>{totalActive}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#821a1d', marginTop: '4px' }}>In Queue</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Ready</div>
            <div style={{ fontSize: '28px', fontWeight: 950, color: '#0f172a', marginTop: '4px', lineHeight: 1 }}>{readyCount}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#16a34a', marginTop: '4px' }}>For Serving</div>
          </div>
        </div>

        {/* Station Cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2px 16px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }} className="hide-scrollbar">
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', paddingLeft: '4px', marginBottom: '2px' }}>Select Station</div>

          {stations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <Flame size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>No stations configured</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Add printer stations in POS settings</div>
            </div>
          )}

          {stations.map(station => {
            const stCats = (station.categories || []).map((c: string) => String(c).trim().toLowerCase());
            const count = tickets.filter(t =>
              (t.items || []).some(item => {
                const cat = getCategoryName(item.category).trim().toLowerCase();
                const matchCat = stCats.length === 0 || stCats.includes(cat);
                return matchCat && item.itemStatus !== 'READY' && item.itemStatus !== 'SERVED';
              })
            ).length;

            return (
              <motion.button
                key={station.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setSelectedStationId(station.id); setView('queue'); }}
                style={{
                  width: '100%', background: '#fff',
                  border: '2px solid #e2e8f0', borderRadius: '20px',
                  padding: '18px 20px', display: 'flex', alignItems: 'center',
                  gap: '16px', cursor: 'pointer', textAlign: 'left',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{
                  width: '50px', height: '50px', borderRadius: '14px',
                  background: `${station.color}12`, border: `1.5px solid ${station.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Flame size={24} color={station.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 950, color: '#0f172a', letterSpacing: '-0.3px' }}>{station.label || station.name}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '2px' }}>
                    {count} active {count === 1 ? 'order' : 'orders'}
                  </div>
                </div>
                {count > 0 && (
                  <div style={{
                    background: station.color, color: '#fff',
                    fontSize: '13px', fontWeight: '600',
                    padding: '5px 12px', borderRadius: '10px', flexShrink: 0,
                  }}>{count}</div>
                )}
                <ChevronLeft size={18} color="#cbd5e1" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
              </motion.button>
            );
          })}

          {/* Server Station */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setView('server')}
            style={{
              width: '100%', background: 'linear-gradient(135deg, #821a1d, #6b1518)',
              border: 'none', borderRadius: '20px',
              padding: '18px 20px', display: 'flex', alignItems: 'center',
              gap: '16px', cursor: 'pointer', textAlign: 'left',
              boxShadow: '0 6px 20px rgba(130,26,29,0.25)',
            }}
          >
            <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ConciergeBell size={24} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 950, color: '#fff' }}>Server Station</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>{readyCount} items ready</div>
            </div>
            <ChevronLeft size={18} color="rgba(255,255,255,0.4)" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
          </motion.button>

          {/* History */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setView('history')}
            style={{
              width: '100%', background: '#1e293b',
              border: '2px solid #334155', borderRadius: '20px',
              padding: '18px 20px', display: 'flex', alignItems: 'center',
              gap: '16px', cursor: 'pointer', textAlign: 'left',
              boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
            }}
          >
            <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <History size={24} color="#94a3b8" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 950, color: '#fff' }}>History</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginTop: '2px' }}>Today's served orders</div>
            </div>
            <ChevronLeft size={18} color="#475569" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
          </motion.button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  2. STATION QUEUE VIEW
  // ════════════════════════════════════════════════════════════
  if (view === 'queue' && selectedStation) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {header}

        {/* ── Bulk Quantity Summary Bar ─────────────────────── */}
        {bulkQtySummary.length > 0 && (
          <div style={{
            background: '#fff',
            borderBottom: '1px solid #e2e8f0',
            padding: '10px 16px',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            flexShrink: 0,
          }} className="hide-scrollbar">
            {bulkQtySummary.map(item => (
              <div key={item.name} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '10px',
                padding: '6px 12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>{item.name}</span>
                <span style={{
                  background: selectedStation.color || '#821a1d',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  lineHeight: 1.2,
                }}>×{item.qty}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Queue Cards ──────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 32px' }} className="hide-scrollbar">
          <AnimatePresence>
            {stationQueue.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', color: '#94a3b8' }}
              >
                <UtensilsCrossed size={44} style={{ marginBottom: '14px', opacity: 0.2 }} />
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#64748b' }}>No active orders</div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>All caught up! 🎉</div>
              </motion.div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '600px', margin: '0 auto' }}>
                {stationQueue.map(group => {
                  const notif = group.notification;
                  const isModified = !!notif;

                  return (
                    <motion.div
                      key={group.table_number}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{
                        opacity: 1, y: 0,
                        ...(isModified ? { boxShadow: ['0 0 0px #f97316', '0 0 18px #f97316', '0 0 0px #f97316'] } : {}),
                      }}
                      exit={{ opacity: 0, x: 200 }}
                      transition={isModified ? { boxShadow: { repeat: 3, duration: 0.5 } } : undefined}
                      layout
                    >
                      <SwipeCard
                        onSwipeRight={() => completeGroupedCard(group.items)}
                        swipeColor={selectedStation.color || '#16a34a'}
                        swipeText="MARK ALL READY"
                      >
                        {/* Notification Banner */}
                        {isModified && (
                          <div style={{
                            background: notif === 'new_item' ? '#2563eb' : '#f97316',
                            color: '#fff',
                            padding: '7px 18px',
                            fontSize: '11px',
                            fontWeight: '600',
                            letterSpacing: '1.5px',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            borderRadius: '20px 20px 0 0',
                          }}>
                            {notif === 'new_item' ? (
                              <><Plus size={14} /> NEW ITEM ADDED</>
                            ) : (
                              <><AlertCircle size={14} /> QTY UPDATED</>
                            )}
                          </div>
                        )}

                        {/* Card Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '14px 18px',
                          borderBottom: '1px solid #f1f5f9',
                          background: isModified ? '#fffbeb' : '#fafbfc',
                          borderRadius: isModified ? '0' : '20px 20px 0 0',
                        }}>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              TABLE {group.table_number}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                              KOTs: {group.kotIds.map(id => `#${String(id).padStart(4, '0')}`).join(', ')}
                            </div>
                          </div>
                          <LiveTimer createdAt={group.created_at} />
                        </div>

                        {/* Items List */}
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {group.items.map((item, idx) => {
                            const isNew = item.isNew || newItemKeys.has(`${group.table_number}::${item.name}`);

                            return (
                              <SwipeItem
                                key={`${item.name}-${idx}`}
                                onSwipeRight={() => completeGroupedItem(item)}
                              >
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 16px',
                                  background: isNew ? '#eff6ff' : '#ffffff',
                                  border: isNew ? '2px solid #3b82f6' : isModified ? '1.5px solid #fed7aa' : '1.5px solid #e2e8f0',
                                  borderRadius: '14px',
                                  boxShadow: isNew ? '0 2px 8px rgba(59,130,246,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                                  transition: 'all 0.2s ease',
                                }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                      {isNew && (
                                        <span style={{
                                          background: '#2563eb',
                                          color: '#fff',
                                          fontSize: '9px',
                                          fontWeight: '600',
                                          padding: '2px 6px',
                                          borderRadius: '6px',
                                          letterSpacing: '0.5px',
                                          flexShrink: 0,
                                        }}>NEW ITEM</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginTop: '2px' }}>{item.category}</div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                    <div style={{
                                      background: isNew ? '#2563eb' : isModified ? '#ffedd5' : '#fef3c7',
                                      border: isNew ? '2px solid #1d4ed8' : isModified ? '2px solid #f97316' : '1.5px solid #fcd34d',
                                      color: isNew ? '#fff' : isModified ? '#c2410c' : '#92400e',
                                      fontWeight: 950,
                                      fontSize: '15px',
                                      padding: '4px 12px',
                                      borderRadius: '10px',
                                      minWidth: '36px',
                                      textAlign: 'center' as const,
                                      transition: 'all 0.2s ease',
                                    }}>
                                      ×{item.quantity}
                                    </div>
                                  </div>
                                </div>
                              </SwipeItem>
                            );
                          })}
                        </div>
                      </SwipeCard>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  3. SERVER STATION VIEW
  // ════════════════════════════════════════════════════════════
  if (view === 'server') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {header}

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 32px' }} className="hide-scrollbar">
          <AnimatePresence>
            {serverGroups.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', color: '#94a3b8' }}
              >
                <ConciergeBell size={44} style={{ marginBottom: '14px', opacity: 0.2 }} />
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#64748b' }}>No items ready</div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Ready orders will appear here</div>
              </motion.div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '600px', margin: '0 auto' }}>
                {serverGroups.map(group => (
                  <motion.div
                    key={group.table_number}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 200 }}
                    layout
                  >
                    <SwipeCard
                      onSwipeRight={() => {
                        Promise.all(group.items.map(i => updateItemStatus(i.ticketId, i.originalIndex, 'SERVED')));
                      }}
                      swipeText="SERVE TABLE"
                      swipeColor="#16a34a"
                    >
                      {/* Card Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 18px',
                        borderBottom: '1px solid #f0fdf4',
                        background: '#f0fdf4',
                        borderRadius: '20px 20px 0 0',
                      }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '600', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            DELIVER TO
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 950, color: '#0f172a', marginTop: '2px' }}>
                            Table {group.table_number}
                          </div>
                        </div>
                        <LiveTimer createdAt={group.created_at} />
                      </div>

                      {/* Items */}
                      <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {group.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>{item.name}</div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginTop: '1px' }}>{getCategoryName(item.category)}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                background: '#f0fdf4', border: '1px solid #86efac',
                                color: '#166534', fontWeight: '600', fontSize: '13px',
                                padding: '3px 10px', borderRadius: '8px',
                                minWidth: '32px', textAlign: 'center',
                              }}>
                                ×{item.qty || item.quantity || 1}
                              </div>
                              <button
                                onClick={() => updateItemStatus(item.ticketId, item.originalIndex, 'SERVED')}
                                style={{
                                  background: '#f0fdf4', border: '1.5px solid #86efac',
                                  color: '#16a34a', width: '34px', height: '34px',
                                  borderRadius: '10px', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SwipeCard>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  4. HISTORY VIEW
  // ════════════════════════════════════════════════════════════
  if (view === 'history') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {header}

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 32px' }} className="hide-scrollbar">
          {allTickets.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', color: '#94a3b8' }}>
              <History size={44} style={{ marginBottom: '14px', opacity: 0.2 }} />
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#64748b' }}>No served orders today</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Completed orders will appear here</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px', margin: '0 auto' }}>
              {allTickets.map(ticket => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '14px 18px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Table {ticket.table_number}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>KOT #{String(ticket.id).padStart(4, '0')}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>
                      {new Date(ticket.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {(ticket.items || []).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '2px 0' }}>
                      <span style={{ color: '#334155', fontWeight: 600 }}>{item.name}</span>
                      <span style={{ color: '#94a3b8', fontWeight: 700 }}>×{item.qty || item.quantity || 1}</span>
                    </div>
                  ))}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
