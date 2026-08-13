import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Wifi, WifiOff, Printer, CheckSquare, Clock, Zap, Volume2, VolumeX, RefreshCw, AlertTriangle, Smartphone, Link, Copy, Check, Info, Shield, ShieldAlert, Monitor, Globe, ChevronRight, HelpCircle, Activity, QrCode, X, ChefHat, Filter, ChevronDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BASE_URL } from '../../constants';
import apiService from '../../services/apiService';
import { printPosToSerial, filterItemsForAutoPrint } from '../../utils/printerUtils';
import { formatCurrency } from '../../utils/formatters';

/**
 * CaptainOrders — Live feed of orders from the captain app / external API,
 * plus Network & Connectivity Diagnostics for LAN Mobile Captain & Kitchen KDS connections.
 */
const CaptainOrders = ({ newOrders = [], setNewOrders, onManualSync, onInjectOrder, settings, isOnline, backendUrl, menuItems = [], categories = [] }) => {
  const [printedOrders, setPrintedOrders] = useState([]);      // Recently printed (for display)
  const [autoPrint, setAutoPrint] = useState(() => {
    const saved = localStorage.getItem('captain_auto_print_kot');
    return saved !== null ? saved === 'true' : true;
  });           // Auto-print toggle
  const [soundEnabled, setSoundEnabled] = useState(true);      // Sound notification toggle

  const [disabledStations, setDisabledStations] = useState(() => {
    const saved = localStorage.getItem('captain_auto_print_disabled_stations');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [showCategoryFilterDropdown, setShowCategoryFilterDropdown] = useState(false);

  useEffect(() => {
    localStorage.setItem('captain_auto_print_kot', autoPrint ? 'true' : 'false');
  }, [autoPrint]);

  useEffect(() => {
    localStorage.setItem('captain_auto_print_disabled_stations', JSON.stringify(disabledStations));
  }, [disabledStations]);

  const stations = useMemo(() => {
    return settings?.printerStations || [];
  }, [settings]);

  const toggleStation = (stationName) => {
    setDisabledStations(prev => {
      const updated = prev.includes(stationName)
        ? prev.filter(s => s !== stationName)
        : [...prev, stationName];
      return updated;
    });
  };

  const enableAllStations = () => {
    setDisabledStations([]);
  };

  const disableAllStations = () => {
    setDisabledStations(stations.map(s => s.name));
  };
  const [isPrinting, setIsPrinting] = useState(null);          // Currently printing order ID
  const [printError, setPrintError] = useState(null);          // Last print error message
  const [printMethod, setPrintMethod] = useState('detecting'); // 'electron' | 'web-serial' | 'none'
  const [captainMode, setCaptainMode] = useState(() => {
    return localStorage.getItem('captain_mode_enabled') === 'true';
  });       // Captain Mode toggle
  
  // Network Diagnostics & Device Tracking State
  const [diagnostics, setDiagnostics] = useState(null);
  const [connectedDeviceCount, setConnectedDeviceCount] = useState(0);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [selectedIpUrl, setSelectedIpUrl] = useState('');
  const [activeApp, setActiveApp] = useState('captain'); // 'captain' | 'kitchen'

  // Duplicate prevention: Set of order IDs that have been processed
  const processedIdsRef = useRef(new Set());
  const audioRef = useRef(null);

  // Fetch Network Diagnostics from server
  const loadDiagnostics = useCallback(async () => {
    try {
      const res = await apiService.fetchNetworkDiagnostics();
      if (res && res.success) {
        setDiagnostics(res);
        setConnectedDeviceCount(res.connectedDevicesCount || 0);
        if (!selectedIpUrl && res.urls?.primaryIpUrl) {
          setSelectedIpUrl(res.urls.primaryIpUrl);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch network diagnostics:", err?.message || err);
    }
  }, [selectedIpUrl]);

  useEffect(() => {
    loadDiagnostics();
    const timer = setInterval(loadDiagnostics, 5000);
    return () => clearInterval(timer);
  }, [loadDiagnostics]);

  // Create App URL (Captain or Kitchen) based strictly on Backend's active IP
  const [useHttpsKitchen, setUseHttpsKitchen] = useState(false);

  // Create App URL (Captain or Kitchen) based strictly on Backend's active IP
  const getAppUrl = (appType = activeApp, forceHttps = useHttpsKitchen) => {
    let rawUrl = selectedIpUrl;
    if (!rawUrl) {
      if (backendUrl && backendUrl !== 'http://localhost:3100') {
        rawUrl = backendUrl;
      } else {
        try {
          const urlObj = new URL(window.location.href);
          rawUrl = `http://${urlObj.hostname}:3101/captain/`;
        } catch {
          rawUrl = `http://localhost:3101/captain/`;
        }
      }
    }

    if (appType === 'kitchen') {
      let target = rawUrl;
      if (target.includes('/captain')) {
        target = target.replace(/\/captain\/?$/, '/kitchen/');
      } else {
        const cleanBase = target.replace(/\/+$/, '');
        target = cleanBase.endsWith('/kitchen') ? `${cleanBase}/` : `${cleanBase}/kitchen/`;
      }
      if (forceHttps) {
        try {
          const parsed = new URL(target);
          return `https://${parsed.hostname}:3443/kitchen/`;
        } catch {
          return target.replace(/^http:/, 'https:').replace(/:3101\//, ':3443/').replace(/:3100\//, ':3443/');
        }
      }
      return target;
    } else {
      if (rawUrl.includes('/kitchen')) {
        return rawUrl.replace(/\/kitchen\/?$/, '/captain/');
      }
      const cleanBase = rawUrl.replace(/\/+$/, '');
      return cleanBase.endsWith('/captain') ? `${cleanBase}/` : `${cleanBase}/captain/`;
    }
  };

  const activeUrl = getAppUrl(activeApp);
  const captainUrl = getAppUrl('captain');
  const kitchenUrl = getAppUrl('kitchen', false);
  const httpsKitchenUrl = getAppUrl('kitchen', true);

  const handleCopyUrl = (urlToCopy) => {
    navigator.clipboard.writeText(urlToCopy);
    setCopiedUrl(urlToCopy);
    setTimeout(() => setCopiedUrl(null), 2500);
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

  // Sync state to localstorage & backend
  useEffect(() => {
    localStorage.setItem('captain_mode_enabled', captainMode);
    apiService.syncCaptainMode(captainMode)
      .catch(err => console.error('Failed to sync captain mode status with backend', err));
  }, [captainMode, backendUrl]);

  // Initialize notification sound
  useEffect(() => {
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
        } catch (e) {}
      }
    };
  }, [soundEnabled]);

  // ── Auto-Print a single order ────────────────────────────
  const printOrder = useCallback(async (order) => {
    if (processedIdsRef.current.has(order.id)) return;

    processedIdsRef.current.add(order.id);
    setIsPrinting(order.id);
    setPrintError(null);

    try {
      const rawItems = order.items.map(item => {
        const menuItem = (menuItems || []).find(m => m.name === item.name || m.id === item.id || m.item_id === item.item_id);
        return {
          name: item.name,
          qty: item.quantity,
          price: item.price,
          category: item.category || menuItem?.category || 'General',
          note: ''
        };
      });

      const filteredItems = filterItemsForAutoPrint(rawItems, menuItems, settings);
      if (filteredItems.length === 0) {
        console.log(`[CaptainOrders] Skipping auto-print for order #${order.id} — no items match enabled auto-print stations.`);
        setNewOrders(prev => prev.filter(o => o.id !== order.id));
        if (onInjectOrder) onInjectOrder(order);
        return;
      }

      const kotData = {
        tableName: `T${order.table_number}`,
        orderType: 'Captain App',
        orderId: `API-${order.id}`,
        items: filteredItems,
        notes: order.notes || ''
      };

      await printPosToSerial(kotData, 'KOT', settings);
      setPrintMethod('electron');

      await apiService.updateOrderStatus(order.id, 'PRINTED');

      setNewOrders(prev => prev.filter(o => o.id !== order.id));
      setPrintedOrders(prev => [{ ...order, status: 'PRINTED', printedAt: Date.now() }, ...prev].slice(0, 20));

      if (onInjectOrder) onInjectOrder(order);
    } catch (err) {
      console.error(`[CaptainOrders] Print failed for order #${order.id}:`, err);
      setPrintError(`Order #${order.id}: ${err.message || 'Print failed'}`);
      processedIdsRef.current.delete(order.id);
    } finally {
      setIsPrinting(null);
    }
  }, [onInjectOrder, settings]);

  const handleManualPrint = useCallback((order) => {
    processedIdsRef.current.delete(order.id);
    printOrder(order);
  }, [printOrder]);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px', margin: 0 }}>
                Captain Control Panel
              </h2>

              {/* Live Connected Devices Badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '20px',
                background: connectedDeviceCount > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                border: `1px solid ${connectedDeviceCount > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(148, 163, 184, 0.2)'}`,
                color: connectedDeviceCount > 0 ? '#34d399' : '#94a3b8',
                fontSize: '11px', fontWeight: '600'
              }}>
                <Smartphone size={13} />
                <span>{connectedDeviceCount} Connected {connectedDeviceCount === 1 ? 'Device' : 'Devices'}</span>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isOnline ? 'Connected to API — polling & real-time socket ready' : 'API server offline — retrying...'}
              {isOnline && (
                <span style={{ 
                  fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '6px',
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
          {/* Network Diagnostics Button */}
          <button
            onClick={() => setShowDiagnosticsModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.1))',
              color: '#a5b4fc', cursor: 'pointer'
            }}
          >
            <Activity size={14} /> Network Health & Diagnostics
          </button>

          {/* Captain Mode toggle */}
          <button
            onClick={() => setCaptainMode(!captainMode)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
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

          {/* Auto-print toggle & Category Filter button */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <button
              onClick={() => setAutoPrint(!autoPrint)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 16px', borderRadius: autoPrint ? '12px 0 0 12px' : '12px', fontSize: '12px', fontWeight: '600',
                border: `1px solid ${autoPrint ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                background: autoPrint ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                color: autoPrint ? '#34d399' : '#64748b', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}
            >
              <Zap size={14} /> Auto-Print KOT: {autoPrint ? 'ON' : 'OFF'}
            </button>

            {autoPrint && (
              <button
                onClick={() => setShowCategoryFilterDropdown(!showCategoryFilterDropdown)}
                title="Select which stations to auto-print"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 12px', borderRadius: '0 12px 12px 0', fontSize: '12px', fontWeight: '600',
                  border: '1px solid rgba(16, 185, 129, 0.3)', borderLeft: 'none',
                  background: showCategoryFilterDropdown ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
                  color: '#6ee7b7', cursor: 'pointer'
                }}
              >
                <Filter size={13} />
                <span>
                  {disabledStations.length === 0
                    ? 'All Stations'
                    : disabledStations.length === stations.length
                      ? 'None'
                      : `${stations.length - disabledStations.length}/${stations.length} Stns`}
                </span>
                <ChevronDown size={13} style={{ transform: showCategoryFilterDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            )}

            {/* Dropdown Popover */}
            {autoPrint && showCategoryFilterDropdown && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                width: '300px', background: '#0f172a', border: '1px solid #334155',
                borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                zIndex: 9999, padding: '16px', color: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #1e293b' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Filter size={14} color="#34d399" /> Auto-Print Stations
                  </div>
                  <button onClick={() => setShowCategoryFilterDropdown(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}>
                    <X size={16} />
                  </button>
                </div>

                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                  Toggle ON stations to auto-print physical KOT slips. Toggled OFF stations will be skipped.
                </p>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    onClick={enableAllStations}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#38bdf8', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Enable All
                  </button>
                  <button
                    onClick={disableAllStations}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#f43f5e', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Disable All
                  </button>
                </div>

                {/* Checklist */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                  {stations.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                      No printer stations defined.<br />Set up stations in Printer Settings first.
                    </div>
                  ) : (
                    stations.map(stn => {
                      const isEnabled = !disabledStations.includes(stn.name);

                      return (
                        <div
                          key={stn.id || stn.name}
                          onClick={() => toggleStation(stn.name)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', borderRadius: '10px',
                            background: isEnabled ? 'rgba(52, 211, 153, 0.12)' : '#1e293b',
                            border: `1px solid ${isEnabled ? 'rgba(52, 211, 153, 0.35)' : '#334155'}`,
                            cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: isEnabled ? '#34d399' : '#94a3b8' }}>
                              {stn.name}
                            </span>
                            <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '6px' }}>
                              ({(stn.categories || []).length} cats)
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            readOnly
                            style={{ accentColor: '#10b981', cursor: 'pointer', pointerEvents: 'none' }}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Force refresh */}
          <button
            onClick={() => { loadDiagnostics(); if (onManualSync) onManualSync(); }}
            style={{
              padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer'
            }}
            title="Refresh Network & Orders"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* ── CAPTAIN MODE CONTROL & CONNECTION PANEL ──────────────────────── */}
      {captainMode && (
        <div style={{ padding: '24px 28px', background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Captain Connection Links & Network Settings
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#e2e8f0', fontWeight: '700', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isOnline ? '#10b981' : '#ef4444' }}>
                  {isOnline ? <CheckSquare size={16} /> : <AlertTriangle size={16} />} Server: {isOnline ? 'Listening (0.0.0.0:3101)' : 'Offline'}
                </span>
                <span style={{ color: '#64748b' }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                  <Smartphone size={16} /> Active Connections: <strong>{connectedDeviceCount}</strong>
                </span>
                <span style={{ color: '#64748b' }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a5b4fc' }}>
                  <Globe size={16} /> Hostname: <strong>{diagnostics?.localDomain || 'localhost'}</strong>
                </span>
              </div>
            </div>
            
            {/* Target URL Selector Box */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                {/* App Selector Pills: Captain vs Kitchen KDS vs Kitchen HTTPS */}
                <div style={{ display: 'flex', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '10px', border: '1px solid #334155', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setActiveApp('captain'); setUseHttpsKitchen(false); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '7px',
                      border: 'none',
                      background: activeApp === 'captain' ? '#38bdf8' : 'transparent',
                      color: activeApp === 'captain' ? '#0f172a' : '#94a3b8',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Smartphone size={14} /> Captain App
                  </button>
                  <button
                    onClick={() => { setActiveApp('kitchen'); setUseHttpsKitchen(false); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '7px',
                      border: 'none',
                      background: activeApp === 'kitchen' && !useHttpsKitchen ? '#f87171' : 'transparent',
                      color: activeApp === 'kitchen' && !useHttpsKitchen ? '#0f172a' : '#94a3b8',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <ChefHat size={14} /> Kitchen App (HTTP)
                  </button>
                  <button
                    onClick={() => { setActiveApp('kitchen'); setUseHttpsKitchen(true); }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '7px',
                      border: 'none',
                      background: activeApp === 'kitchen' && useHttpsKitchen ? '#10b981' : 'transparent',
                      color: activeApp === 'kitchen' && useHttpsKitchen ? '#0f172a' : '#10b981',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🔒 Kitchen App (HTTPS - Screen Awake)
                  </button>
                </div>

                {diagnostics?.interfaces?.length > 1 && (
                  <select 
                    value={selectedIpUrl} 
                    onChange={e => setSelectedIpUrl(e.target.value)}
                    style={{ background: '#0f172a', color: '#38bdf8', border: '1px solid #334155', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    {diagnostics.interfaces.map(iface => (
                      <option key={iface.address} value={iface.captainUrl}>
                        {iface.name}: {iface.address} {iface.isVirtual ? '(Virtual)' : '(LAN)'}
                      </option>
                    ))}
                    {diagnostics.urls?.hostnameUrl && (
                      <option value={diagnostics.urls.hostnameUrl}>Hostname: {diagnostics.localDomain}</option>
                    )}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0f172a', padding: '10px 14px', borderRadius: '12px', border: `1px solid ${activeApp === 'kitchen' ? (useHttpsKitchen ? 'rgba(16, 185, 129, 0.4)' : 'rgba(248, 113, 113, 0.4)') : 'rgba(56, 189, 248, 0.3)'}` }}>
                <div style={{ flex: 1, fontSize: '15px', fontWeight: '600', color: activeApp === 'kitchen' ? (useHttpsKitchen ? '#10b981' : '#f87171') : '#38bdf8', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {activeUrl}
                </div>
                <button
                  onClick={() => handleCopyUrl(activeUrl)}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', border: 'none',
                    background: copiedUrl === activeUrl ? '#10b981' : (activeApp === 'kitchen' ? (useHttpsKitchen ? '#10b981' : '#f87171') : '#38bdf8'),
                    color: copiedUrl === activeUrl ? 'white' : '#0f172a',
                    fontWeight: '700', fontSize: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                  }}
                >
                  {copiedUrl === activeUrl ? <Check size={14} /> : <Copy size={14} />}
                  {copiedUrl === activeUrl ? 'Copied!' : 'Copy URL'}
                </button>
              </div>

              {/* Link shortcuts */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                {diagnostics?.urls?.primaryIpUrl && (
                  <button onClick={() => setSelectedIpUrl(diagnostics.urls.primaryIpUrl)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155', background: selectedIpUrl === diagnostics.urls.primaryIpUrl ? 'rgba(56, 189, 248, 0.2)' : 'transparent', color: '#94a3b8', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>
                    📡 Primary Wi-Fi IP
                  </button>
                )}
                {diagnostics?.urls?.hostnameUrl && (
                  <button onClick={() => setSelectedIpUrl(diagnostics.urls.hostnameUrl)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155', background: selectedIpUrl === diagnostics.urls.hostnameUrl ? 'rgba(56, 189, 248, 0.2)' : 'transparent', color: '#94a3b8', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>
                    💻 Local Domain ({diagnostics.localDomain})
                  </button>
                )}

                {/* Direct quick-copy shortcuts for both */}
                <button 
                  onClick={() => { setActiveApp('captain'); setUseHttpsKitchen(false); handleCopyUrl(captainUrl); }} 
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)', background: activeApp === 'captain' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.05)', color: '#38bdf8', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Smartphone size={12} /> Copy Captain Link
                </button>
                <button 
                  onClick={() => { setActiveApp('kitchen'); setUseHttpsKitchen(false); handleCopyUrl(kitchenUrl); }} 
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(248, 113, 113, 0.3)', background: activeApp === 'kitchen' && !useHttpsKitchen ? 'rgba(248, 113, 113, 0.2)' : 'rgba(248, 113, 113, 0.05)', color: '#f87171', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ChefHat size={12} /> Copy Kitchen (HTTP)
                </button>
                <button 
                  onClick={() => { setActiveApp('kitchen'); setUseHttpsKitchen(true); handleCopyUrl(httpsKitchenUrl); }} 
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.4)', background: activeApp === 'kitchen' && useHttpsKitchen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.05)', color: '#10b981', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  🔒 Copy Kitchen (HTTPS - Screen Awake)
                </button>

                <button onClick={() => setShowDiagnosticsModal(true)} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#a5b4fc', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <HelpCircle size={12} /> Troubleshoot Mobile Connectivity →
                </button>
              </div>
            </div>
          </div>
          
          {/* QR Code Container */}
          <div style={{ background: 'white', padding: '14px', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', minWidth: '158px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: activeApp === 'kitchen' ? '#dc2626' : '#0284c7', background: activeApp === 'kitchen' ? '#fef2f2' : '#f0f9ff', padding: '3px 8px', borderRadius: '10px' }}>
              {activeApp === 'kitchen' ? <ChefHat size={12} /> : <Smartphone size={12} />}
              {activeApp === 'kitchen' ? 'KITCHEN APP' : 'CAPTAIN APP'}
            </div>
            <QRCodeSVG value={activeUrl} size={125} />
            <span style={{ fontSize: '10px', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>
              Scan Mobile Camera
            </span>
          </div>
        </div>
      )}

      {/* ── PRINT ERROR BANNER ──────────────────────────── */}
      {printError && (
        <div style={{ 
          padding: '12px 28px', background: 'rgba(239, 68, 68, 0.08)', borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: '500', color: '#fca5a5' }}>
            <AlertTriangle size={16} /> {printError}
          </div>
          <button onClick={() => setPrintError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>✕</button>
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="no-scrollbar">
        
        {/* 1. NEW ORDERS SECTION */}
        {newOrders.filter(o => o.status === 'NEW').length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      <div style={{ fontSize: '20px', fontWeight: '500', color: 'white' }}>Table {order.table_number}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>ORDER #{order.id} • {timeAgo(order.timestamp)}</div>
                    </div>
                  </div>
                  <div style={{ padding: '16px 24px' }}>
                    {order.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < order.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px' }}>
                          <span style={{ color: '#fca5a5', fontWeight: '600', marginRight: '8px' }}>{item.quantity}×</span>
                          {item.name}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px 24px 24px' }}>
                    <button onClick={() => handleManualPrint(order)} style={{ 
                      width: '100%', padding: '16px', borderRadius: '18px', border: 'none', 
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', 
                      fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' 
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
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#10b981', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      <div style={{ fontWeight: '600', fontSize: '16px', color: '#10b981' }}>Table {order.table_number}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>#{order.id} • {order.items.length} items</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right', fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>
                      {timeAgo(order.timestamp)}
                    </div>
                    <button onClick={() => handleManualPrint(order)} style={{ 
                      padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)',
                      background: 'transparent', color: '#10b981', fontSize: '12px', fontWeight: '600', cursor: 'pointer' 
                    }}>RE-PRINT</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {newOrders.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ 
              width: '120px', height: '120px', borderRadius: '40px', 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px',
              border: '1px solid rgba(99, 102, 241, 0.15)'
            }}>
              <Wifi size={48} color={isOnline ? '#818cf8' : '#64748b'} className={isOnline ? 'animate-pulse' : ''} />
            </div>
            <h3 style={{ fontSize: '28px', fontWeight: '700', color: '#e2e8f0', marginBottom: '12px' }}>
              {isOnline ? 'All Caught Up' : 'Offline Mode'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '16px', fontWeight: '700', maxWidth: '440px', lineHeight: 1.6 }}>
              {isOnline 
                ? 'No new orders to print right now. Scan the QR code above on your mobile phone to connect Captain App.' 
                : 'Waiting for local API server connection...'}
            </p>

            <button 
              onClick={() => setShowDiagnosticsModal(true)}
              style={{
                marginTop: '20px', padding: '12px 24px', borderRadius: '14px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <Activity size={16} /> Open Network & Firewall Diagnostics
            </button>
          </div>
        )}
      </div>

      {/* ── NETWORK DIAGNOSTICS & FIREWALL ASSISTANT MODAL ──────────────── */}
      {showDiagnosticsModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '24px',
            width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
          }} className="no-scrollbar">
            
            {/* Modal Header */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#1e293b', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', background: 'rgba(56, 189, 248, 0.15)', borderRadius: '12px' }}>
                  <Activity size={22} color="#38bdf8" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'white', margin: 0 }}>
                    Captain App Network & Connection Diagnostics
                  </h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>
                    Troubleshoot "Site can't be reached" errors for mobile devices
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDiagnosticsModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* System Checks Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '16px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Server Listening</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#10b981', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckSquare size={16} /> 0.0.0.0:3101
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>All Network Interfaces</div>
                </div>

                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '16px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Connected Devices</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#38bdf8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Smartphone size={16} /> {connectedDeviceCount} Active
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Socket.IO Real-time</div>
                </div>

                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '16px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Local Domain</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#a5b4fc', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={16} /> {diagnostics?.localDomain || 'localhost'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>mDNS Network Name</div>
                </div>

                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '16px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Detected Adapters</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#f59e0b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Monitor size={16} /> {diagnostics?.interfaces?.length || 1} Interfaces
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>IPv4 Addresses</div>
                </div>

              </div>

              {/* Detected Network Adapters List */}
              <div style={{ background: '#0f172a', borderRadius: '16px', border: '1px solid #334155', padding: '20px' }}>
                <div style={{ fontWeight: '600', fontSize: '14px', color: 'white', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Monitor size={16} color="#38bdf8" /> Detected Network IP Addresses on this PC:
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {diagnostics?.interfaces?.map((iface, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{iface.name}</span>
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: iface.isVirtual ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: iface.isVirtual ? '#f59e0b' : '#34d399', fontWeight: '600' }}>
                            {iface.isVirtual ? 'VIRTUAL (Hyper-V/WSL)' : 'PHYSICAL LAN'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#38bdf8', marginTop: '2px' }}>
                          {iface.captainUrl}
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyUrl(iface.captainUrl)}
                        style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #334155', background: copiedUrl === iface.captainUrl ? '#10b981' : '#334155', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        {copiedUrl === iface.captainUrl ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* STEP-BY-STEP TROUBLESHOOTING GUIDE FOR "SITE CAN'T BE REACHED" */}
              <div>
                <div style={{ fontWeight: '700', fontSize: '16px', color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={20} color="#ef4444" /> Fix "This site can't be reached" on Mobile Devices:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {/* CHECK 1 */}
                  <div style={{ padding: '16px 20px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#fca5a5', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      1. Change Windows Network Profile to "PRIVATE" (MOST COMMON FIX)
                    </div>
                    <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6 }}>
                      When Windows sets Wi-Fi to <strong>"Public Network"</strong>, Windows Firewall blocks incoming connections from mobile phones automatically!<br />
                      <strong>How to fix:</strong>
                      <ol style={{ margin: '8px 0 0 20px', padding: 0 }}>
                        <li>Open Windows Settings (Press <strong>Win + I</strong>)</li>
                        <li>Go to <strong>Network & Internet → Wi-Fi</strong></li>
                        <li>Click your connected Wi-Fi network name</li>
                        <li>Change Network profile type from <strong>Public network</strong> to <strong>Private network</strong></li>
                      </ol>
                    </div>
                  </div>

                  {/* CHECK 2 */}
                  <div style={{ padding: '16px 20px', borderRadius: '16px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      2. Add Windows Firewall Inbound Rule for Port 3101
                    </div>
                    <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6 }}>
                      If Windows Defender Firewall is blocking port 3101, run PowerShell as Administrator and paste:
                      <div style={{ margin: '10px 0', padding: '12px', background: '#0f172a', borderRadius: '10px', fontFamily: 'monospace', fontSize: '12px', color: '#38bdf8', border: '1px solid #334155', wordBreak: 'break-all' }}>
                        netsh advfirewall firewall add rule name="TYDE POS Captain (3101)" dir=in action=allow protocol=TCP localport=3101
                      </div>
                      <button 
                        onClick={() => handleCopyUrl('netsh advfirewall firewall add rule name="TYDE POS Captain (3101)" dir=in action=allow protocol=TCP localport=3101')}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {copiedUrl?.startsWith('netsh') ? '✓ Command Copied!' : 'Copy PowerShell Command'}
                      </button>
                    </div>
                  </div>

                  {/* CHECK 3 */}
                  <div style={{ padding: '16px 20px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      3. Verify Same Wi-Fi Network & Router "AP Isolation"
                    </div>
                    <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6 }}>
                      - Ensure both your Desktop PC and Mobile Phone are connected to the exact same Wi-Fi SSID (e.g. both on "Tyde_WiFi_5G").<br />
                      - Some Wi-Fi routers have <strong>"AP Isolation"</strong> or <strong>"Guest Mode"</strong> enabled, which prevents Wi-Fi devices from talking to each other. Turn off AP Isolation in your router settings if enabled.
                    </div>
                  </div>

                  {/* CHECK 4 */}
                  <div style={{ padding: '16px 20px', borderRadius: '16px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#c084fc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      4. Try Hostname Link instead of IP Address
                    </div>
                    <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6 }}>
                      On iPhone (Safari) and Android (Chrome), you can type the local hostname directly:
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#c084fc', margin: '6px 0', fontFamily: 'monospace' }}>
                        http://{diagnostics?.localDomain || 'rakesh-pc.local'}:3101/captain/
                      </div>
                      mDNS allows your phone to discover the PC even if the IP address changes!
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end', background: '#1e293b', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
              <button onClick={() => setShowDiagnosticsModal(false)} style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                Done / Close Diagnostics
              </button>
            </div>

          </div>
        </div>
      )}

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

