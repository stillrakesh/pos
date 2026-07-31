import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Download, Trash2, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Activity, X } from 'lucide-react';
import logger from '../../services/loggerService';
import apiService from '../../services/apiService';
import { BASE_URL } from '../../constants';

export const SystemDiagnosticsModal = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [healthStatus, setHealthStatus] = useState({ checking: true, ok: false, details: null });
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setLogs(logger.getLogs());
    const unsubscribe = logger.subscribe(updatedLogs => setLogs([...updatedLogs]));
    runHealthDiagnostics();
    return () => unsubscribe();
  }, [isOpen]);

  const runHealthDiagnostics = async () => {
    setHealthStatus({ checking: true, ok: false, details: null });
    try {
      const isOk = await apiService.checkHealth();
      let diagData = null;
      try {
        diagData = await apiService.fetchNetworkDiagnostics();
      } catch (e) {}

      setHealthStatus({
        checking: false,
        ok: isOk,
        details: diagData || { base_url: BASE_URL, health_ok: isOk }
      });
      logger.info('SYSTEM', `Diagnostic health check completed. Health OK: ${isOk}`);
    } catch (err) {
      setHealthStatus({ checking: false, ok: false, details: { error: err.message } });
      logger.error('SYSTEM', `Diagnostic health check failed: ${err.message}`);
    }
  };

  const handleCopyLogs = () => {
    const text = logger.exportAsText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = logger.exportAsText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-system-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const filteredLogs = logs.filter(l => {
    if (filter === 'ALL') return true;
    if (filter === 'ERROR') return l.type === 'ERROR';
    if (filter === 'API') return l.category === 'API';
    if (filter === 'KOT') return l.category === 'KOT';
    return true;
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: '#0f172a',
        color: '#f8fafc',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        borderRadius: '16px',
        border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Terminal size={22} color="#38bdf8" />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>System Diagnostics & Logs</h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Real-time server connection & network log inspector</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Diagnostic Connection Card */}
        <div style={{ padding: '16px 24px', background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
          <div style={{
            background: healthStatus.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${healthStatus.ok ? '#059669' : '#dc2626'}`,
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {healthStatus.checking ? (
                <RefreshCw size={20} className="animate-spin" color="#38bdf8" />
              ) : healthStatus.ok ? (
                <CheckCircle2 size={22} color="#10b981" />
              ) : (
                <XCircle size={22} color="#ef4444" />
              )}
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: healthStatus.ok ? '#34d399' : '#f87171' }}>
                  {healthStatus.checking ? 'Checking backend health...' : healthStatus.ok ? 'Backend Server Online & Connected' : 'Backend Server Unreachable / Error'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  API Target: <code style={{ color: '#e2e8f0', background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>{BASE_URL}</code>
                  {healthStatus.details?.primaryIp && ` | LAN IP: ${healthStatus.details.primaryIp}`}
                </div>
              </div>
            </div>

            <button
              onClick={runHealthDiagnostics}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              <RefreshCw size={14} /> Re-Check
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div style={{
          padding: '12px 24px',
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'ERROR', 'API', 'KOT'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: filter === f ? '#38bdf8' : '#334155',
                  color: filter === f ? '#0f172a' : '#94a3b8'
                }}
              >
                {f === 'ERROR' ? 'Errors Only' : f}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCopyLogs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: copied ? '#059669' : '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Copy size={14} /> {copied ? 'Copied!' : 'Copy Logs'}
            </button>
            <button
              onClick={handleDownloadLogs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> Save File
            </button>
            <button
              onClick={() => logger.clear()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        </div>

        {/* Logs List Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px',
          fontFamily: 'monospace',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>
              No log entries recorded yet.
            </div>
          ) : (
            filteredLogs.map(l => (
              <div
                key={l.id}
                onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                style={{
                  background: l.type === 'ERROR' ? 'rgba(239, 68, 68, 0.1)' : l.type === 'WARN' ? 'rgba(245, 158, 11, 0.1)' : '#1e293b',
                  borderLeft: `4px solid ${l.type === 'ERROR' ? '#ef4444' : l.type === 'WARN' ? '#f59e0b' : l.type === 'SUCCESS' ? '#10b981' : '#38bdf8'}`,
                  borderRadius: '6px',
                  padding: '10px 14px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>{l.timestamp}</span>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '700',
                      background: l.type === 'ERROR' ? '#991b1b' : l.type === 'WARN' ? '#92400e' : '#1e3a8a',
                      color: '#fff'
                    }}>{l.type}</span>
                    <span style={{ color: '#94a3b8', fontWeight: '600' }}>[{l.category}]</span>
                  </div>
                </div>
                <div style={{ color: l.type === 'ERROR' ? '#fca5a5' : '#f8fafc', marginTop: '4px', wordBreak: 'break-word' }}>
                  {l.message}
                </div>
                {expandedId === l.id && l.details && (
                  <pre style={{
                    marginTop: '8px',
                    padding: '8px',
                    background: '#090d16',
                    borderRadius: '4px',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {l.details}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemDiagnosticsModal;
