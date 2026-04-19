import React, { useState, useEffect } from 'react';
import { Globe, Save, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { BASE_URL, setBaseUrl } from '../../constants';

const ConnectionSettings = ({ onSaved, isSetup = false }) => {
  const [url, setUrl] = useState(localStorage.getItem('backend_url') || '');
  const [status, setStatus] = useState('idle'); // 'idle' | 'testing' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const testConnection = async (testUrl) => {
    if (!testUrl) {
      setStatus('error');
      setErrorMsg('Please enter a backend URL');
      return;
    }
    
    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
      setStatus('error');
      setErrorMsg('URL must start with http:// or https://');
      return;
    }

    setStatus('testing');
    setErrorMsg('');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(`${testUrl}/api/health`, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(`Server returned ${res.status}`);
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setStatus('error');
      setErrorMsg('Could not reach the server. Check IP and Port.');
    }
  };

  const handleSave = () => {
    if (!url) return alert('Backend URL is required');
    if (!url.startsWith('http://') && !url.startsWith('https://')) return alert('Invalid URL format');

    localStorage.setItem('backend_url', url);
    setBaseUrl(url);
    if (onSaved) onSaved(url);
    window.location.reload(); // Reload to re-init all services with new URL
  };

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '40px',
      background: isSetup ? '#f8fafc' : 'transparent'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '480px', 
        background: 'white', 
        padding: '40px', 
        borderRadius: '32px', 
        boxShadow: isSetup ? '0 25px 50px -12px rgba(0,0,0,0.1)' : 'none',
        border: isSetup ? '1px solid #e2e8f0' : 'none'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '20px', background: '#a3112a', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' 
          }}>
            <Globe size={32} color="white" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}>
            Backend Connection
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Enter the IP address and port of your TYDE POS Server.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
            Backend Server URL
          </label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://192.168.1.40:4000"
              style={{
                width: '100%',
                padding: '16px 20px',
                borderRadius: '16px',
                border: `2px solid ${status === 'error' ? '#fca5a5' : status === 'success' ? '#86efac' : '#e2e8f0'}`,
                fontSize: '16px',
                outline: 'none',
                transition: 'all 0.2s',
                fontWeight: '600'
              }}
            />
          </div>
          {status === 'error' && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '13px', fontWeight: '700' }}>
              <AlertTriangle size={16} /> {errorMsg}
            </div>
          )}
          {status === 'success' && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontSize: '13px', fontWeight: '700' }}>
              <CheckCircle2 size={16} /> Backend is Online
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => testConnection(url)}
            disabled={status === 'testing'}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '16px',
              border: '2px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={18} className={status === 'testing' ? 'animate-spin' : ''} />
            Test
          </button>
          
          <button 
            onClick={handleSave}
            style={{
              flex: 2,
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              background: '#a3112a',
              color: 'white',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            Save & Connect <ArrowRight size={18} />
          </button>
        </div>

        {isSetup && (
          <div style={{ marginTop: '32px', padding: '16px', background: '#fef3c7', borderRadius: '16px', border: '1px solid #fde68a' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#92400e', lineHeight: 1.5, fontWeight: '600' }}>
              <b>First Time Setup:</b> Please ensure your POS server is running on another computer or this machine before connecting.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default ConnectionSettings;
