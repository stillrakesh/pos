import React, { useState, useEffect } from 'react';
import { Printer, Wifi, WifiOff, RefreshCw, Check, AlertTriangle, Zap, TestTube } from 'lucide-react';
import { 
  connectQzTray, 
  disconnectQzTray,
  isQzConnected, 
  findPrinters, 
  selectPrinter, 
  getSelectedPrinter, 
  testPrint 
} from '../../utils/qzTrayPrinter';

/**
 * PrinterSetup — Settings panel for configuring QZ Tray thermal printer.
 * Renders inside the GlobalSettingsView as a settings tab.
 */
const PrinterSetup = ({ settings }) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [selectedName, setSelectedName] = useState(getSelectedPrinter() || '');
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');

  // Check connection status on mount
  useEffect(() => {
    setConnected(isQzConnected());
    const saved = getSelectedPrinter();
    if (saved) setSelectedName(saved);
  }, []);

  // ── Connect to QZ Tray ──
  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const ok = await connectQzTray();
      setConnected(ok);
      if (!ok) {
        setError('Could not connect to QZ Tray. Make sure the QZ Tray application is installed and running.');
      }
    } catch (err) {
      setError(err.message);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  // ── Disconnect ──
  const handleDisconnect = async () => {
    await disconnectQzTray();
    setConnected(false);
    setPrinters([]);
  };

  // ── Detect printers ──
  const handleDetect = async () => {
    setDetecting(true);
    setError('');
    try {
      const found = await findPrinters();
      setPrinters(found);
      if (found.length === 0) {
        setError('No printers found. Check that your thermal printer is connected and powered on.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDetecting(false);
    }
  };

  // ── Select a printer ──
  const handleSelect = async (name) => {
    setSelectedName(name);
    setTestResult(null);
    await selectPrinter(name);
  };

  // ── Test print ──
  const handleTestPrint = async () => {
    setTestResult(null);
    setError('');
    const result = await testPrint(settings);
    setTestResult(result);
    if (!result.success) setError(result.message);
  };

  const cardStyle = { 
    background: 'white', padding: '24px', borderRadius: '20px', 
    border: '1px solid #e2e8f0' 
  };
  const labelStyle = { 
    fontSize: '12px', fontWeight: '900', color: '#64748b', 
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' 
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ── Connection Status ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Printer size={20} color="#6366f1" />
          <span style={{ fontSize: '16px', fontWeight: '950', color: '#111827' }}>QZ Tray Connection</span>
        </div>
        
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '16px',
          background: connected 
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(52, 211, 153, 0.03))' 
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(220, 38, 38, 0.03))',
          border: `1px solid ${connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`
        }}>
          <div style={{ 
            padding: '12px', borderRadius: '12px',
            background: connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'
          }}>
            {connected ? <Wifi size={24} color="#10b981" /> : <WifiOff size={24} color="#ef4444" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '900', fontSize: '14px', color: connected ? '#059669' : '#dc2626' }}>
              {connected ? 'Connected to QZ Tray' : 'Not Connected'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginTop: '2px' }}>
              {connected 
                ? 'QZ Tray is active and ready to send prints' 
                : 'Install & run QZ Tray from qz.io to enable direct printing'}
            </div>
          </div>
          {connected ? (
            <button
              onClick={handleDisconnect}
              style={{
                padding: '10px 20px', borderRadius: '12px', border: '1px solid #fecaca',
                background: 'white', color: '#dc2626', cursor: 'pointer',
                fontWeight: '800', fontSize: '12px'
              }}
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              style={{
                padding: '10px 20px', borderRadius: '12px', border: 'none',
                background: connecting ? '#94a3b8' : '#6366f1', color: 'white', cursor: connecting ? 'wait' : 'pointer',
                fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Zap size={14} /> {connecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>

        {!connected && (
          <div style={{ 
            marginTop: '16px', padding: '14px 18px', borderRadius: '12px', 
            background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '12px', 
            color: '#1d4ed8', fontWeight: '700', lineHeight: 1.6
          }}>
            💡 <strong>Setup Guide:</strong><br />
            1. Download QZ Tray from <strong>qz.io</strong> (free for development)<br />
            2. Install and launch the QZ Tray application<br />
            3. Click "Connect" above to establish the connection<br />
            4. Select your thermal printer from the detected list
          </div>
        )}
      </div>

      {/* ── Printer Detection ── */}
      {connected && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div style={labelStyle}>Available Printers</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', marginTop: '-4px' }}>
                {printers.length > 0 ? `${printers.length} printer(s) detected` : 'Click detect to scan for printers'}
              </div>
            </div>
            <button
              onClick={handleDetect}
              disabled={detecting}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px', borderRadius: '12px', border: '1px solid #e2e8f0',
                background: detecting ? '#f1f5f9' : 'white', color: '#374151', cursor: detecting ? 'wait' : 'pointer',
                fontWeight: '800', fontSize: '12px'
              }}
            >
              <RefreshCw size={14} className={detecting ? 'animate-spin' : ''} />
              {detecting ? 'Scanning...' : 'Detect Printers'}
            </button>
          </div>

          {/* Printer list */}
          {printers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {printers.map((name) => {
                const isSelected = selectedName === name;
                return (
                  <button
                    key={name}
                    onClick={() => handleSelect(name)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 18px', borderRadius: '14px', cursor: 'pointer',
                      border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      background: isSelected ? 'rgba(99, 102, 241, 0.04)' : 'white',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Printer size={18} color={isSelected ? '#6366f1' : '#94a3b8'} />
                      <span style={{ 
                        fontWeight: isSelected ? '900' : '700', 
                        fontSize: '13px', 
                        color: isSelected ? '#4f46e5' : '#374151' 
                      }}>
                        {name}
                      </span>
                    </div>
                    {isSelected && (
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '8px', 
                        background: '#6366f1', color: 'white', 
                        fontSize: '10px', fontWeight: '900' 
                      }}>
                        <Check size={12} /> ACTIVE
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Test Print ── */}
      {connected && selectedName && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <TestTube size={18} color="#f59e0b" />
            <span style={{ fontSize: '14px', fontWeight: '900', color: '#111827' }}>Test Print</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>
                Send a test KOT to <strong>{selectedName}</strong>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginTop: '2px' }}>
                Verifies connection, paper, and formatting in one click
              </div>
            </div>
            <button
              onClick={handleTestPrint}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', borderRadius: '14px', border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: 'white', fontWeight: '900', fontSize: '12px', cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(245, 158, 11, 0.25)'
              }}
            >
              <Printer size={16} /> Test Print
            </button>
          </div>

          {/* Test result */}
          {testResult && (
            <div style={{ 
              marginTop: '16px', padding: '14px 18px', borderRadius: '12px',
              background: testResult.success ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`,
              display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '12px', fontWeight: '700',
              color: testResult.success ? '#166534' : '#991b1b'
            }}>
              {testResult.success ? <Check size={16} /> : <AlertTriangle size={16} />}
              {testResult.message}
            </div>
          )}
        </div>
      )}

      {/* ── Error Display ── */}
      {error && (
        <div style={{ 
          padding: '14px 18px', borderRadius: '12px',
          background: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          fontSize: '12px', fontWeight: '700', color: '#991b1b'
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>{error}</div>
        </div>
      )}
    </div>
  );
};

export default PrinterSetup;
