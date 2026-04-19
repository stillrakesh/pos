import React, { useState, useEffect } from 'react';
import { Wifi, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Link, Globe } from 'lucide-react';

const ConnectionManager = ({ backendUrl, isConnected, onUpdate, onRestore }) => {
  const [url, setUrl] = useState(backendUrl);
  const [testStatus, setTestStatus] = useState('idle'); // 'idle' | 'testing' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [localIp, setLocalIp] = useState('Detecting...');

  useEffect(() => {
    setUrl(backendUrl);
  }, [backendUrl]);

  useEffect(() => {
    // Attempt to fetch local network IP from backend if connected
    if (isConnected) {
      fetch(`${backendUrl}/api/network`)
        .then(res => res.json())
        .then(data => setLocalIp(data.ip))
        .catch(() => setLocalIp('Unknown'));
    }
  }, [backendUrl, isConnected]);

  const testConnection = async (testUrl) => {
    if (!testUrl) return;
    setTestStatus('testing');
    setErrorMsg('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${testUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setErrorMsg(`Error ${res.status}`);
      }
    } catch (err) {
      setTestStatus('error');
      setErrorMsg('Server Unreachable');
    }
  };

  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Status Overview */}
      <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f3f4f6', paddingBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937' }}>
             <Wifi size={20} color={isConnected ? '#10b981' : '#ef4444'} /> Backend Connection Status
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444' }}></div>
            <span style={{ fontSize: '12px', fontWeight: '900', color: isConnected ? '#10b981' : '#ef4444' }}>
              {isConnected ? 'STABLE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Current Endpoint</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', wordBreak: 'break-all' }}>{backendUrl}</div>
          </div>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Local Network IP</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0369a1' }}>{localIp}</div>
          </div>
        </div>

        {isLocalhost && (
          <div style={{ padding: '12px 16px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={18} color="#c2410c" />
            <div style={{ fontSize: '13px', color: '#9a3412', fontWeight: '600' }}>
              <b>Note:</b> You are using localhost. Captain devices on the same network will not be able to connect. Use your local IP (e.g. 192.168.x.x).
            </div>
          </div>
        )}
      </div>

      {/* 2. Configuration Panel */}
      <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>Update Connection</h3>
        
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Backend Server URL</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.1.40:4000"
              style={{
                flex: 1,
                padding: '14px 18px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '15px',
                fontWeight: '600',
                outline: 'none',
                background: '#f8fafc'
              }}
            />
            <button 
              onClick={() => testConnection(url)}
              disabled={testStatus === 'testing'}
              style={{
                padding: '14px 24px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: 'white',
                color: '#475569',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {testStatus === 'testing' ? <RefreshCw size={18} className="spin" /> : <Globe size={18} />} Test
            </button>
            <button 
              onClick={() => onUpdate(url)}
              style={{
                padding: '14px 28px',
                borderRadius: '12px',
                border: 'none',
                background: '#a3112a',
                color: 'white',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              Connect <ArrowRight size={18} />
            </button>
          </div>
          
          {testStatus === 'error' && (
            <div style={{ marginTop: '12px', color: '#dc2626', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} /> {errorMsg}
            </div>
          )}
          {testStatus === 'success' && (
            <div style={{ marginTop: '12px', color: '#16a34a', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} /> Server reachable!
            </div>
          )}
        </div>
      </div>

      {/* 3. Maintenance */}
      <div style={{ background: '#fff', padding: '24px 32px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>Sync Tables & Menu</h4>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Restore all data from the connected backend system.</p>
        </div>
        <button 
          onClick={onRestore} 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#f1f5f9', color: '#475569', fontWeight: '800', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}
        >
          <RefreshCw size={16} /> Restore
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default ConnectionManager;
