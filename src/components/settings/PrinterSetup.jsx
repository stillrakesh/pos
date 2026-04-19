import React, { useState, useEffect } from 'react';
import { Printer, Wifi, WifiOff, RefreshCw, Check, AlertTriangle, Zap, TestTube, LayoutGrid, Save, Trash2, Plus } from 'lucide-react';
import { 
  connectQzTray, 
  disconnectQzTray,
  isQzConnected, 
  findPrinters, 
  selectPrinter, 
  getSelectedPrinter, 
  testPrint 
} from '../../utils/qzTrayPrinter';
import { BASE_URL } from '../../constants';

/**
 * PrinterSetup — Overhauled Settings panel for configuring printing.
 * Now features improved UI, Station management, and persistence.
 */
const PrinterSetup = ({ settings, categories, setSettings, onSave }) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [qzPrinters, setQzPrinters] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [selectedName, setSelectedName] = useState(getSelectedPrinter() || '');
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setConnected(isQzConnected());
    const saved = getSelectedPrinter();
    if (saved) setSelectedName(saved);
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const ok = await connectQzTray();
      setConnected(ok);
      if (!ok) setError('Could not connect to QZ Tray. Ensure it is running.');
    } catch (err) {
      setError(err.message);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectQzTray();
    setConnected(false);
    setQzPrinters([]);
  };

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

  const handleTestPrint = async () => {
    setTestResult(null);
    setError('');
    const result = await testPrint(settings);
    setTestResult(result);
    if (!result.success) setError(result.message);
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
    <div style={{ maxWidth: '850px', margin: '20px auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '100px', position: 'relative' }}>
      
      {/* ── Save Floating Action Button ── */}
      <div style={{ 
        position: 'fixed', bottom: '30px', right: '30px', zIndex: 100,
        display: 'flex', gap: '12px'
      }}>
        <button 
          onClick={onSave}
          style={{ 
            padding: '16px 32px', borderRadius: '100px', border: 'none',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: 'white', fontWeight: '900', fontSize: '15px', cursor: 'pointer',
            boxShadow: '0 20px 25px -5px rgba(79, 70, 229, 0.4)',
            display: 'flex', alignItems: 'center', gap: '10px',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 25px 30px -5px rgba(79, 70, 229, 0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(79, 70, 229, 0.4)'; }}
        >
          <Save size={20} /> Save Printer Config
        </button>
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
      
      {/* ── Connection Status ── */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ padding: '8px', background: '#eef2ff', borderRadius: '12px' }}>
            <Printer size={20} color="#6366f1" />
          </div>
          <span style={titleStyle}>QZ Tray Hardware Link</span>
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
              {connected ? 'Hardware Connected' : 'Hardware Disconnected'}
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>
              {connected 
                ? 'Ready to dispatch print jobs to local hardware' 
                : 'Start QZ Tray on this terminal to enable printing'}
            </div>
          </div>
          {connected ? (
            <button onClick={handleDisconnect} style={{ padding: '12px 24px', borderRadius: '14px', border: '1px solid #fecaca', background: 'white', color: '#dc2626', cursor: 'pointer', fontWeight: '800', fontSize: '13px' }}>
              Disconnect
            </button>
          ) : (
            <button onClick={handleConnect} disabled={connecting} style={{ padding: '12px 24px', borderRadius: '14px', border: 'none', background: connecting ? '#94a3b8' : '#6366f1', color: 'white', cursor: connecting ? 'wait' : 'pointer', fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} /> {connecting ? 'Linking...' : 'Link Hardware'}
            </button>
          )}
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

export default PrinterSetup;
