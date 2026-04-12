import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, Printer, CheckSquare, Clock, Zap, Volume2, VolumeX, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchOrders, updateOrderStatus } from '../../utils/apiClient';
import { printPosToSerial } from '../../utils/printerUtils';
import { isQzConnected } from '../../utils/qzTrayPrinter';
import { formatCurrency } from '../../utils/formatters';

/**
 * CaptainOrders — Live feed of orders from the captain app / external API.
 * 
 * Features:
 * - Polls GET /api/orders?status=NEW every 3 seconds
 * - Maintains a Set of printed order IDs to prevent duplicate prints
 * - Auto-prints KOT via thermal printer
 * - Updates order status to PRINTED after successful print
 * - Audio notification on new orders
 * - Shows connection status indicator
 */
const CaptainOrders = ({ newOrders = [], setNewOrders, onManualSync, onInjectOrder, settings }) => {
  const [printedOrders, setPrintedOrders] = useState([]);      // Recently printed (for display)
  const [isOnline, setIsOnline] = useState(false);             // API connection status
  const [autoPrint, setAutoPrint] = useState(true);           // Auto-print toggle
  const [soundEnabled, setSoundEnabled] = useState(true);      // Sound notification toggle
  const [isPrinting, setIsPrinting] = useState(null);          // Currently printing order ID
  const [printError, setPrintError] = useState(null);          // Last print error message
  const [printMethod, setPrintMethod] = useState('detecting'); // 'qz-tray' | 'web-serial' | 'none'

  // Duplicate prevention: Set of order IDs that have been processed (printed or queued)
  const processedIdsRef = useRef(new Set());
  const pollTimerRef = useRef(null);
  const audioRef = useRef(null);

  // Detect preferred print method on mount
  useEffect(() => {
    if (isQzConnected()) {
      setPrintMethod('qz-tray');
    } else if ('serial' in navigator) {
      setPrintMethod('web-serial');
    } else {
      setPrintMethod('none');
    }
  }, []);

  // Initialize notification sound
  useEffect(() => {
    // Create a simple beep using Web Audio API
    audioRef.current = {
      play: () => {
        if (!soundEnabled) return;
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          osc.type = 'sine';
          gain.gain.value = 0.3;
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.stop(ctx.currentTime + 0.5);
          // Second beep
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1100;
            osc2.type = 'sine';
            gain2.gain.value = 0.3;
            osc2.start();
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            osc2.stop(ctx.currentTime + 0.8);
          }, 200);
        } catch (e) {
          // Silently fail — audio isn't critical
        }
      }
    };
  }, [soundEnabled]);

  // ── Auto-Print a single order ────────────────────────────
  const printOrder = useCallback(async (order) => {
    if (processedIdsRef.current.has(order.id)) return; // DUPLICATE GUARD

    // Mark as processing immediately
    processedIdsRef.current.add(order.id);
    setIsPrinting(order.id);
    setPrintError(null);

    try {
      // Format items for the KOT printer
      const kotData = {
        tableName: `T${order.table_number}`,
        orderType: 'Captain App',
        orderId: `API-${order.id}`,
        items: order.items.map(item => ({
          name: item.name,
          qty: item.quantity,
          price: item.price,
          note: ''
        })),
        notes: order.notes || ''
      };

      // Print via unified engine (QZ Tray silent → browser fallback)
      await printPosToSerial(kotData, 'KOT');
      setPrintMethod('qz-tray');

      // Update status on server
      await updateOrderStatus(order.id, 'PRINTED');

      // Move from new → printed in UI
      setNewOrders(prev => prev.filter(o => o.id !== order.id));
      setPrintedOrders(prev => [{ ...order, status: 'PRINTED', printedAt: Date.now() }, ...prev].slice(0, 20));

      // Inject into POS table system if callback provided
      if (onInjectOrder) {
        onInjectOrder(order);
      }
    } catch (err) {
      console.error(`[CaptainOrders] Print failed for order #${order.id}:`, err);
      setPrintError(`Order #${order.id}: ${err.message || 'Print failed'}`);
      // Remove from processed so it can be retried
      processedIdsRef.current.delete(order.id);
    } finally {
      setIsPrinting(null);
    }
  }, [onInjectOrder, settings]);

  // ── Manual print trigger (for orders that weren't auto-printed) ──
  const handleManualPrint = useCallback((order) => {
    // Remove from processed set to allow manual retry
    processedIdsRef.current.delete(order.id);
    printOrder(order);
  }, [printOrder]);

  // ── Mark order as printed WITHOUT physical printing ──
  const handleMarkPrinted = useCallback(async (order) => {
    try {
      processedIdsRef.current.add(order.id);
      await updateOrderStatus(order.id, 'PRINTED');
      setNewOrders(prev => prev.filter(o => o.id !== order.id));
      setPrintedOrders(prev => [{ ...order, status: 'PRINTED', printedAt: Date.now() }, ...prev].slice(0, 20));

      if (onInjectOrder) onInjectOrder(order);
    } catch (err) {
      console.error(`[CaptainOrders] Status update failed for #${order.id}:`, err);
      processedIdsRef.current.delete(order.id);
    }
  }, [onInjectOrder]);

  // ── Polling & Interval removed (now handled globally in App.jsx) ───────

  // ── Helpers ─────────────────────────────────────────────
  const getOrderTotal = (items) => items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const timeAgo = (ts) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f172a', color: 'white', overflow: 'hidden' }} className="animate-fade-in">
      {/* ── HEADER BAR ──────────────────────────────── */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            padding: '12px', borderRadius: '16px', 
            background: isOnline 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(52, 211, 153, 0.1))' 
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))',
            border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}>
            {isOnline ? <Wifi size={22} color="#10b981" /> : <WifiOff size={22} color="#ef4444" />}
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '950', letterSpacing: '-0.5px', margin: 0 }}>
              Captain Orders
              {newOrders.length > 0 && (
                <span style={{ 
                  marginLeft: '12px', fontSize: '13px', fontWeight: '900', padding: '4px 12px', 
                  borderRadius: '999px', background: '#ef4444', color: 'white',
                  animation: 'pulse 2s infinite'
                }}>
                  {newOrders.length} NEW
                </span>
              )}
            </h2>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isOnline ? 'Connected to API — polling every 3s' : 'API server offline — retrying...'}
              {isOnline && (
                <span style={{ 
                  fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '6px',
                  background: printMethod === 'qz-tray' ? 'rgba(99, 102, 241, 0.15)' : printMethod === 'web-serial' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: printMethod === 'qz-tray' ? '#818cf8' : printMethod === 'web-serial' ? '#f59e0b' : '#ef4444'
                }}>
                  🖨️ {printMethod === 'qz-tray' ? 'QZ Tray' : printMethod === 'web-serial' ? 'Web Serial' : 'No Printer'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
            style={{
              padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
              background: soundEnabled ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.05)',
              color: soundEnabled ? '#818cf8' : '#64748b', cursor: 'pointer'
            }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Auto-print toggle */}
          <button
            onClick={() => setAutoPrint(!autoPrint)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '900',
              border: `1px solid ${autoPrint ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)'}`,
              background: autoPrint ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
              color: autoPrint ? '#34d399' : '#64748b', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.5px'
            }}
          >
            <Zap size={14} /> Auto-Print KOT: {autoPrint ? 'ON' : 'OFF'}
          </button>

          {/* Force refresh */}
          <button
            onClick={onManualSync}
            style={{
              padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer'
            }}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* ── PRINT ERROR BANNER ──────────────────────────── */}
      {printError && (
        <div style={{ 
          padding: '12px 28px', background: 'rgba(239, 68, 68, 0.08)', borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: '700', color: '#fca5a5' }}>
            <AlertTriangle size={16} /> {printError}
          </div>
          <button onClick={() => setPrintError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '16px', fontWeight: '900' }}>✕</button>
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="no-scrollbar">
        
        {/* 1. NEW ORDERS SECTION */}
        {newOrders.filter(o => o.status === 'NEW').length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
              URGENT — AWAITING PRINT
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {newOrders.filter(o => o.status === 'NEW').map(order => (
                <div key={order.id} style={{ 
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05))',
                  border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '24px', overflow: 'hidden',
                  boxShadow: '0 15px 35px rgba(239, 68, 68, 0.15)', animation: 'fadeIn 0.3s ease-out'
                }}>
                  <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: '950', color: 'white' }}>Table {order.table_number}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '800' }}>ORDER #{order.id} • {timeAgo(order.timestamp)}</div>
                    </div>
                  </div>
                  <div style={{ padding: '16px 24px' }}>
                    {order.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < order.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ fontWeight: '700', fontSize: '15px' }}>
                          <span style={{ color: '#fca5a5', fontWeight: '900', marginRight: '8px' }}>{item.quantity}×</span>
                          {item.name}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px 24px 24px' }}>
                    <button onClick={() => handleManualPrint(order)} style={{ 
                      width: '100%', padding: '16px', borderRadius: '18px', border: 'none', 
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', 
                      fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
                    }}>
                      <Printer size={18} /> PRINT KOT NOW
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. PRINTED HISTORY SECTION */}
        {newOrders.filter(o => o.status === 'PRINTED').length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: '900', color: '#10b981', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckSquare size={14} /> LIVE HISTORY — RECENTLY PUSHED
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {newOrders.filter(o => o.status === 'PRINTED').sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30).map(order => (
                <div key={order.id} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px', borderRadius: '18px',
                  background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                    <div>
                      <div style={{ fontWeight: '900', fontSize: '16px', color: '#10b981' }}>Table {order.table_number}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>#{order.id} • {order.items.length} items</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right', fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>
                      {timeAgo(order.timestamp)}
                    </div>
                    <button onClick={() => handleManualPrint(order)} style={{ 
                      padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)',
                      background: 'transparent', color: '#10b981', fontSize: '12px', fontWeight: '800', cursor: 'pointer' 
                    }}>RE-PRINT</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {newOrders.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', textAlign: 'center' }}>
            <div style={{ 
              width: '120px', height: '120px', borderRadius: '40px', 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px',
              border: '1px solid rgba(99, 102, 241, 0.15)'
            }}>
              <Wifi size={48} color={isOnline ? '#818cf8' : '#64748b'} className={isOnline ? 'animate-pulse' : ''} />
            </div>
            <h3 style={{ fontSize: '28px', fontWeight: '950', color: '#e2e8f0', marginBottom: '12px' }}>
              {isOnline ? 'All Caught Up' : 'Searching for API...'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '16px', fontWeight: '700', maxWidth: '400px', lineHeight: 1.6 }}>
              {isOnline 
                ? 'No new orders to print right now. History will appear here as soon as a Captain pushes an order.' 
                : 'Connecting to Vercel...'}
            </p>
          </div>
        )}
      </div>

      {/* Inline styles for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default CaptainOrders;
