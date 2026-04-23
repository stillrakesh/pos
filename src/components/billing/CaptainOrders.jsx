import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, Printer, CheckSquare, Clock, Zap, Volume2, VolumeX, RefreshCw, AlertTriangle, Smartphone, Link } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BASE_URL } from '../../constants';
import { fetchOrders, updateOrderStatus } from '../../utils/apiClient';
import { printPosToSerial } from '../../utils/printerUtils';
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
const CaptainOrders = ({ newOrders = [], setNewOrders, onManualSync, onInjectOrder, settings, isOnline, backendUrl, menuItems = [] }) => {
  const [printedOrders, setPrintedOrders] = useState([]);      // Recently printed (for display)
  const [autoPrint, setAutoPrint] = useState(true);           // Auto-print toggle
  const [soundEnabled, setSoundEnabled] = useState(true);      // Sound notification toggle
  const [isPrinting, setIsPrinting] = useState(null);          // Currently printing order ID
  const [printError, setPrintError] = useState(null);          // Last print error message
  const [printMethod, setPrintMethod] = useState('detecting'); // 'electron' | 'web-serial' | 'none'
  const [captainMode, setCaptainMode] = useState(() => {
    return localStorage.getItem('captain_mode_enabled') === 'true';
  });       // Captain Mode toggle
  const [networkInfo, setNetworkInfo] = useState({ ip: 'localhost', port: 3001 });

  // Duplicate prevention: Set of order IDs that have been processed (printed or queued)
  const processedIdsRef = useRef(new Set());
  const pollTimerRef = useRef(null);
  const audioRef = useRef(null);

  // Create accurate Captain App URL based strictly on Backend's active IP
  const getCaptainUrl = () => {
    try {
      const urlObj = new URL(backendUrl || BASE_URL);
      return `http://${urlObj.hostname}:3001/captain/`;
    } catch {
      return `http://localhost:3001/captain/`;
    }
  };

  // Detect preferred print method on mount
  useEffect(() => {
    if (window.electronAPI) {
      setPrintMethod('electron');
    } else if ('serial' in navigator) {
      setPrintMethod('web-serial');
    } else {
      setPrintMethod('none');
    }
  }, []);

  // Init state from localstorage OR default
  useEffect(() => {
    localStorage.setItem('captain_mode_enabled', captainMode);
    // Push state to backend dynamically
    const url = backendUrl || BASE_URL;
    fetch(`${url}/api/captain-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: captainMode })
    }).catch(err => console.error('Failed to sync captain mode status with backend', err));
  }, [captainMode, backendUrl]);

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
      // Format items for the KOT printer with category enrichment
      const kotData = {
        tableName: `T${order.table_number}`,
        orderType: 'Captain App',
        orderId: `API-${order.id}`,
        items: order.items.map(item => {
          // Lookup category from local menu if missing
          const menuItem = (menuItems || []).find(m => m.name === item.name || m.id === item.id || m.item_id === item.item_id);
          return {
            name: item.name,
            qty: item.quantity,
            price: item.price,
            category: item.category || menuItem?.category || 'General',
            note: ''
          };
        }),
        notes: order.notes || ''
      };

      // Print via unified engine (QZ Tray silent → browser fallback)
      await printPosToSerial(kotData, 'KOT', settings);
      setPrintMethod('electron');

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
              Captain Control Panel
            </h2>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isOnline ? 'Connected to API — polling every 3s' : 'API server offline — retrying...'}
              {isOnline && (
                <span style={{ 
                  fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '6px',
                  background: printMethod === 'electron' ? 'rgba(99, 102, 241, 0.15)' : printMethod === 'web-serial' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: printMethod === 'electron' ? '#818cf8' : printMethod === 'web-serial' ? '#f59e0b' : '#ef4444'
                }}>
                  🖨️ {printMethod === 'electron' ? 'Electron Printer' : printMethod === 'web-serial' ? 'Web Serial' : 'No Printer'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Captain Mode toggle */}
          <button
            onClick={() => setCaptainMode(!captainMode)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '900',
              border: `1px solid ${captainMode ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.1)'}`,
              background: captainMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)',
              color: captainMode ? '#38bdf8' : '#64748b', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.5px'
            }}
          >
            <Smartphone size={14} /> Captain Mode: {captainMode ? 'ON' : 'OFF'}
          </button>
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

      {/* ── CAPTAIN MODE CONTROL PANEL ──────────────────────── */}
      {captainMode && (
        <div style={{ padding: '24px 28px', background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Captain Mode Connection</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#e2e8f0', fontWeight: '700' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isOnline ? '#10b981' : '#ef4444' }}>
                  {isOnline ? <CheckSquare size={16} /> : <AlertTriangle size={16} />} Backend: {isOnline ? 'Running' : 'Offline'}
                </span>
                <span style={{ color: '#64748b' }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: navigator.onLine ? '#10b981' : '#f59e0b' }}>
                  <Wifi size={16} /> Internet: {navigator.onLine ? 'Online' : 'Offline'}
                </span>
                <span style={{ color: '#64748b' }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                  <Link size={16} /> Extracted Origin: {backendUrl || BASE_URL}
                </span>
              </div>
            </div>
            
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '700', marginBottom: '4px' }}>Captain Access URL</div>
                <div style={{ fontSize: '18px', fontWeight: '950', color: 'white' }}>{getCaptainUrl()}</div>
              </div>
            </div>
          </div>
          
          {/* QR Code Container */}
          <div style={{ background: 'white', padding: '12px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <QRCodeSVG value={getCaptainUrl()} size={120} />
            <span style={{ fontSize: '11px', color: '#0f172a', fontWeight: '900', textTransform: 'uppercase' }}>Scan to connect</span>
          </div>
        </div>
      )}

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
              {isOnline ? 'All Caught Up' : 'Offline Mode'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '16px', fontWeight: '700', maxWidth: '400px', lineHeight: 1.6 }}>
              {isOnline 
                ? 'No new orders to print right now. History will appear here as soon as a Captain pushes an order.' 
                : 'Waiting for local API server connection...'}
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
