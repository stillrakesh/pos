import React, { useState, useEffect } from 'react';
import { Printer, Wifi, WifiOff, RefreshCw, Check, AlertTriangle, Zap, TestTube, LayoutGrid, Save, Trash2, Plus, Network } from 'lucide-react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { 
  findPrinters, 
  selectPrinter, 
  getSelectedPrinter, 
  printPosToSerial
} from '../../utils/printerUtils';
import { BASE_URL } from '../../constants';

/**
 * PrinterSetup — Overhauled Settings panel for configuring printing.
 * Now features improved UI, Station management, and persistence.
 */
const PrinterSetup = ({ settings, categories, setSettings, onSave }) => {
  const [connected, setConnected] = useState(false);
  const [qzPrinters, setQzPrinters] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');
  const [printerIp, setPrinterIp] = useState('');
  const [printerPort, setPrinterPort] = useState('9100');
  const [ipSaved, setIpSaved] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSaveConfig = () => {
    if (onSave) onSave();
    setIsSaved(true);
    setShowToast(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 2500);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  useEffect(() => {
    // Check if running inside Electron
    const check = () => {
      const isElectron = !!window.electronAPI;
      setConnected(isElectron);
    };

    const detectPrinters = async () => {
      if (!window.electronAPI) return alert("Cannot detect: Browser Mode is active. Please use the Desktop App.");
      try {
        const list = await window.electronAPI.getPrinters();
        alert(`Found ${list.length} printers: \n${list.map(p => p.name).join('\n')}`);
      } catch (err) {
        alert("Detection failed: " + err.message);
      }
    };
    check();
    // Retry once after a short delay just in case of race condition
    setTimeout(check, 1000);
    
    // Load selected printer and IP
    getSelectedPrinter().then(saved => {
      if (saved) setSelectedName(saved);
    });
    idbGet('pos_printer_settings').then(prefs => {
      if (prefs?.printerIp)   setPrinterIp(prefs.printerIp);
      if (prefs?.printerPort) setPrinterPort(String(prefs.printerPort));
    });

    if (window.electronAPI) {
      handleDetect();
    }
  }, []);

  const handleDetect = async () => {
    setDetecting(true);
    setError('');
    try {
      const found = await findPrinters();
      setQzPrinters(found);
      if (found.length === 0) setError('No printers found.');
    } catch (err) {
      setError(err.message);
    } finally {
      setDetecting(false);
    }
  };

  const handleSelect = async (name) => {
    setSelectedName(name);
    setTestResult(null);
    await selectPrinter(name);
  };

  const handleSaveIp = async () => {
    const current = await idbGet('pos_printer_settings') || {};
    await idbSet('pos_printer_settings', {
      ...current,
      printerIp: printerIp.trim(),
      printerPort: parseInt(printerPort, 10) || 9100
    });
    setIpSaved(true);
    setTimeout(() => setIpSaved(false), 2000);
    console.log('[PrinterSetup] Saved printer IP:', printerIp.trim(), 'Port:', printerPort);
  };

  const handleTestPrint = async () => {
    setTestResult(null);
    setError('');
    try {
      const dummyOrder = {
        tableName: 'Test Table',
        orderType: 'Dine In',
        items: [
          { name: 'Paper Test Item', qty: 1, price: 0 },
          { name: 'Connection Active', qty: 2, price: 0 }
        ],
        grandTotal: 0
      };
      await printPosToSerial(dummyOrder, 'KOT', settings);
      setTestResult({ success: true, message: 'Test print sent successfully.' });
    } catch (e) {
      setTestResult({ success: false, message: e.message });
      setError(e.message);
    }
  };

  const toggleSetting = (key) => {
    if (setSettings) {
      setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  // Styles
  const cardStyle = { 
    background: 'rgba(255, 255, 255, 0.8)', 
    backdropFilter: 'blur(10px)',
    padding: '24px', 
    borderRadius: '24px', 
    border: '1px solid rgba(226, 232, 240, 0.5)',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
  };

  const sectionHeaderStyle = {
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    marginBottom: '20px'
  };

  const titleStyle = { 
    fontSize: '18px', 
    fontWeight: '900', 
    color: '#0f172a',
    letterSpacing: '-0.02em'
  };

  return (
    <div style={{ maxWidth: '850px', margin: '20px auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '30px', position: 'relative' }}>
      
      {/* ── Save Bar (sticky) with Toast Notification ── */}
      <div style={{ 
        position: 'sticky', top: 0, zIndex: 50,
        background: isSaved ? 'linear-gradient(135deg, rgba(236, 253, 245, 0.98), rgba(209, 250, 229, 0.98))' : 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px', padding: '12px 20px',
        border: isSaved ? '1.5px solid #10b981' : '1px solid #e2e8f0',
        boxShadow: isSaved ? '0 6px 24px rgba(16, 185, 129, 0.2)' : '0 4px 20px rgba(0,0,0,0.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: '800', fontSize: '14px', color: isSaved ? '#065f46' : '#0f172a', transition: 'color 0.3s' }}>
              Printer Configuration
            </div>
            <div style={{ fontSize: '12px', color: isSaved ? '#047857' : '#64748b', fontWeight: '500', transition: 'color 0.3s' }}>
              {isSaved ? '✓ Configuration saved and applied successfully!' : 'Changes will apply on next print'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {showToast && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#10b981', color: 'white',
              padding: '6px 14px', borderRadius: '20px',
              fontSize: '12px', fontWeight: '800',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              animation: 'pulse 1.5s infinite'
            }}>
              <Check size={14} style={{ strokeWidth: 3 }} /> Saved!
            </div>
          )}

          <button 
            onClick={handleSaveConfig}
            style={{ 
              padding: '12px 28px', borderRadius: '12px', border: 'none',
              background: isSaved 
                ? 'linear-gradient(135deg, #10b981, #059669)' 
                : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: 'white', fontWeight: '800', fontSize: '14px', cursor: 'pointer',
              boxShadow: isSaved 
                ? '0 8px 20px rgba(16, 185, 129, 0.4)' 
                : '0 8px 16px rgba(79, 70, 229, 0.3)',
              display: 'flex', alignItems: 'center', gap: '8px',
              transform: isSaved ? 'scale(1.03)' : 'scale(1)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.transform = isSaved ? 'scale(1.05)' : 'translateY(-2px)'; 
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.transform = isSaved ? 'scale(1.03)' : 'translateY(0)'; 
            }}
          >
            {isSaved ? (
              <>
                <Check size={18} style={{ strokeWidth: 3 }} /> Config Saved!
              </>
            ) : (
              <>
                <Save size={16} /> Save Config
              </>
            )}
          </button>
        </div>
      </div>


      {/* ── KOT Printing Configuration ── */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ padding: '8px', background: '#fffbeb', borderRadius: '12px' }}>
            <Zap size={20} color="#f59e0b" />
          </div>
          <span style={titleStyle}>KOT Routing Logic</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            padding: '20px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #f1f5f9', cursor: 'pointer',
            transition: 'all 0.2s'
          }} onClick={() => toggleSetting('separateKotStations')}>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: '#1e293b' }}>Station-Wise KOT Printing</div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>Enable this to print separate KOT slips per Station (Bar, Kitchen, etc.)</div>
            </div>
            <div style={{
              width: '50px', height: '28px', borderRadius: '15px', padding: '4px', position: 'relative',
              background: settings.separateKotStations ? '#10b981' : '#cbd5e1',
              transition: 'background 0.3s'
            }}>
              <div style={{
                width: '20px', height: '20px', position: 'absolute', top: '4px',
                left: settings.separateKotStations ? '26px' : '4px',
                borderRadius: '50%', background: 'white',
                transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }} />
            </div>
          </label>

          <div style={{ 
            padding: '16px 20px', borderRadius: '16px', 
            background: 'linear-gradient(to right, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))', 
            border: '1px solid rgba(99, 102, 241, 0.1)', 
            fontSize: '13px', color: '#4f46e5', fontWeight: '600', lineHeight: 1.6,
            display: 'flex', gap: '12px'
          }}>
            <span style={{ fontSize: '18px' }}>💡</span>
            <span><strong>Worklow Tip:</strong> Map your Mocktails and Shakes to a "BAR" station to have them print separately from Food items. Don't forget to click <strong>Save</strong> at the bottom.</span>
          </div>
        </div>
      </div>
      
      {/* ── Network Printer IP (ESC/POS Direct TCP) ── */}
      {connected && (
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div style={{ padding: '8px', background: '#f0fdf4', borderRadius: '12px' }}>
              <Network size={20} color="#16a34a" />
            </div>
            <div>
              <span style={titleStyle}>Network Printer (Direct ESC/POS)</span>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>Bypasses macOS CUPS — required for silent KOT printing on thermal printers</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>PRINTER IP ADDRESS</label>
              <input
                id="printer-ip-input"
                type="text"
                placeholder="e.g. 192.168.1.100"
                value={printerIp}
                onChange={e => { setPrinterIp(e.target.value); setIpSaved(false); }}
                style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontSize: '15px', fontWeight: '700', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#16a34a'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            <div style={{ width: '100px' }}>
              <label style={{ fontSize: '12px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>PORT</label>
              <input
                id="printer-port-input"
                type="number"
                value={printerPort}
                onChange={e => { setPrinterPort(e.target.value); setIpSaved(false); }}
                style={{ width: '100%', padding: '14px 16px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontSize: '15px', fontWeight: '700', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#16a34a'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            <button
              id="save-printer-ip-btn"
              onClick={handleSaveIp}
              style={{ padding: '14px 24px', borderRadius: '14px', border: 'none', background: ipSaved ? '#16a34a' : '#0f172a', color: 'white', fontWeight: '900', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.3s', whiteSpace: 'nowrap' }}
            >
              {ipSaved ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save IP</>}
            </button>
          </div>

          {printerIp && (
            <div style={{ marginTop: '12px', padding: '10px 16px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '12px', fontWeight: '700', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wifi size={14} /> Silent print will send ESC/POS bytes directly to <strong>{printerIp}:{printerPort}</strong> — no driver needed.
            </div>
          )}
        </div>
      )}

      {/* ── Connection Status ── */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ padding: '8px', background: '#eef2ff', borderRadius: '12px' }}>
            <Printer size={20} color="#6366f1" />
          </div>
          <span style={titleStyle}>Direct Hardware Link</span>
        </div>
        
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', borderRadius: '24px',
          background: connected 
            ? 'rgba(16, 185, 129, 0.03)' 
            : 'rgba(239, 68, 68, 0.03)',
          border: `1px solid ${connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`
        }}>
          <div style={{ 
            padding: '14px', borderRadius: '16px',
            background: connected ? '#dcfce7' : '#fee2e2'
          }}>
            {connected ? <Wifi size={24} color="#10b981" /> : <WifiOff size={24} color="#ef4444" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '900', fontSize: '16px', color: connected ? '#065f46' : '#991b1b' }}>
              {connected ? 'Electron Print API Active' : 'Browser Mode Active'}
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>
              {connected 
                ? 'Ready to dispatch silent print jobs to local hardware' 
                : 'Install the Desktop App to enable silent background printing'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Printer Detection ── */}
      {connected && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detected Printers</span>
              <div style={{ fontSize: '13px', color: '#475569', fontWeight: '700', marginTop: '4px' }}>
                {qzPrinters.length > 0 ? `${qzPrinters.length} Printers Found` : 'Scan for local USB/Network printers'}
              </div>
            </div>
            <button onClick={handleDetect} disabled={detecting} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', background: detecting ? '#f8fafc' : 'white', color: '#334155', cursor: detecting ? 'wait' : 'pointer', fontWeight: '800', fontSize: '13px' }}>
              <RefreshCw size={16} className={detecting ? 'animate-spin' : ''} />
              {detecting ? 'Scanning...' : 'Detect'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {qzPrinters.map((name) => {
              const isSelected = selectedName === name;
              return (
                <button key={name} onClick={() => handleSelect(name)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px', borderRadius: '20px', cursor: 'pointer', border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0', background: isSelected ? '#f5f7ff' : 'white', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '8px', background: isSelected ? '#6366f1' : '#f1f5f9', borderRadius: '10px' }}>
                      <Printer size={18} color={isSelected ? 'white' : '#64748b'} />
                    </div>
                    <span style={{ fontWeight: isSelected ? '900' : '700', fontSize: '14px', color: isSelected ? '#4338ca' : '#334155' }}>{name}</span>
                  </div>
                  {isSelected && <Check size={20} color="#6366f1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── KOT Station Settings ── */}
      <KOTStationSettings 
        settings={settings}
        setSettings={setSettings}
        categories={categories} 
      />

      {/* ── KOT Exclusion Settings ── */}
      <KOTExclusionSettings 
        settings={settings}
        setSettings={setSettings}
        categories={categories}
      />

      {/* ── Test & Tools ── */}
      {connected && selectedName && (
        <div style={{ ...cardStyle, border: '1px dashed #e2e8f0', background: 'rgba(255,255,255,0.4)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '900', fontSize: '15px', color: '#1e293b' }}>Troubleshooting</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Send a formatting test to <strong>{selectedName}</strong></div>
              </div>
              <button onClick={handleTestPrint} style={{ padding: '12px 24px', borderRadius: '14px', border: 'none', background: '#0f172a', color: 'white', fontWeight: '900', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TestTube size={16} /> Test Formatting
              </button>
           </div>
           {testResult && (
             <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: testResult.success ? '#f0fdf4' : '#fef2f2', color: testResult.success ? '#166534' : '#991b1b', fontSize: '12px', fontWeight: '700', border: '1px solid currentColor' }}>
               {testResult.message}
             </div>
           )}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button 
          onClick={() => {
            window.location.reload();
          }}
          style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          DETECT PRINTERS & REFRESH BRIDGE
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>
        BRIDGE VERSION: 1.3 (PRO)
      </div>
    </div>
  );
};

const KOTStationSettings = ({ settings, setSettings, categories = [] }) => {
  const [newStationName, setNewStationName] = useState('');
  const stations = settings.printerStations || [];

  const addStation = () => {
    if (!newStationName.trim()) return;
    const newStation = {
      id: `stn_${Date.now()}`,
      name: newStationName.trim().toUpperCase(),
      categories: []
    };
    setSettings(prev => ({
      ...prev,
      printerStations: [...(prev.printerStations || []), newStation]
    }));
    setNewStationName('');
  };

  const removeStation = (id) => {
    if (window.confirm("Remove this printing station?")) {
      setSettings(prev => ({
        ...prev,
        printerStations: (prev.printerStations || []).filter(s => s.id !== id)
      }));
    }
  };

  const toggleCategoryInStation = (stationId, catName) => {
    setSettings(prev => ({
      ...prev,
      printerStations: (prev.printerStations || []).map(station => {
        if (station.id === stationId) {
          const hasCat = (station.categories || []).includes(catName);
          return {
            ...station,
            categories: hasCat 
              ? station.categories.filter(c => c !== catName)
              : [...(station.categories || []), catName]
          };
        }
        return station;
      })
    }));
  };

  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', padding: '32px', borderRadius: '32px', border: '1px solid rgba(226, 232, 240, 0.5)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '8px', background: '#e0f2fe', borderRadius: '12px' }}>
          <LayoutGrid size={20} color="#0ea5e9" />
        </div>
        <span style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>KOT Station Routing</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input 
            placeholder="Station Name (e.g. BAR, KITCHEN)" 
            value={newStationName} 
            onChange={e => setNewStationName(e.target.value)}
            style={{ width: '100%', padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: '700', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = '#0ea5e9'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          />
        </div>
        <button onClick={addStation} style={{ padding: '0 32px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Station
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {stations.map(station => (
          <div key={station.id} style={{ padding: '24px', borderRadius: '24px', background: 'white', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0ea5e9' }} />
                 <div style={{ fontWeight: '950', fontSize: '16px', color: '#0f172a' }}>{station.name}</div>
              </div>
              <button onClick={() => removeStation(station.id)} style={{ padding: '8px 12px', background: '#fff1f2', color: '#e11d48', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trash2 size={14} /> REMOVE
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {categories.map(cat => {
                const catName = typeof cat === 'object' ? cat.name : cat;
                const isChecked = (station.categories || []).includes(catName);
                return (
                  <button key={catName} onClick={() => toggleCategoryInStation(station.id, catName)} style={{ padding: '10px 18px', borderRadius: '14px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', background: isChecked ? '#0ea5e9' : '#f8fafc', color: isChecked ? 'white' : '#64748b', border: isChecked ? 'none' : '1px solid #f1f5f9', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isChecked && <Check size={14} />} {catName}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {stations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '14px', fontWeight: '700', border: '2px dashed #e2e8f0', borderRadius: '24px', background: '#f8fafc' }}>
             No stations defined yet. <br />
             <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.7 }}>Define areas like BAR or PANTRY to organize your KOT slips.</span>
          </div>
        )}
      </div>
    </div>
  );
};

const KOTExclusionSettings = ({ settings, setSettings, categories = [] }) => {
  const excludedCategories = settings.excludedKotCategories || [];

  const toggleExclusion = (catName) => {
    setSettings(prev => {
      const current = prev.excludedKotCategories || [];
      const isExcluded = current.includes(catName);
      return {
        ...prev,
        excludedKotCategories: isExcluded 
          ? current.filter(c => c !== catName)
          : [...current, catName]
      };
    });
  };

  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', padding: '32px', borderRadius: '32px', border: '1px solid rgba(226, 232, 240, 0.5)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '8px', background: '#fff7ed', borderRadius: '12px' }}>
          <WifiOff size={20} color="#ea580c" />
        </div>
        <div>
          <span style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>KOT Printing Exclusions</span>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>Select categories that should NEVER be printed on KOT slips (e.g. Water, Soda)</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {categories.map(cat => {
          const catName = typeof cat === 'object' ? cat.name : cat;
          const isExcluded = excludedCategories.includes(catName);
          return (
            <button 
              key={catName} 
              onClick={() => toggleExclusion(catName)} 
              style={{ 
                padding: '12px 20px', borderRadius: '16px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', 
                background: isExcluded ? '#ea580c' : '#f8fafc', 
                color: isExcluded ? 'white' : '#64748b', 
                border: isExcluded ? 'none' : '1px solid #f1f5f9', 
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' 
              }}
            >
              {isExcluded ? <WifiOff size={16} /> : <Check size={16} style={{ opacity: 0.3 }} />} 
              {catName}
              {isExcluded && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px' }}>EXCLUDED</span>}
            </button>
          );
        })}
      </div>

      {categories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>
          No categories found. Add categories to your menu first.
        </div>
      )}
    </div>
  );
};

export default PrinterSetup;
