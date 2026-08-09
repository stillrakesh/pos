import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Wifi, QrCode, Smartphone, ChefHat, Monitor, Copy, Check, ShieldAlert, RefreshCw, X, HelpCircle, AlertTriangle } from 'lucide-react';
import apiService from '../../services/apiService';
import { BASE_URL } from '../../constants';

export const LanConnectModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('captain'); // 'captain' | 'kitchen' | 'pos'
  const [networkInfo, setNetworkInfo] = useState({ primaryIp: '127.0.0.1', interfaces: [], port: 3101 });
  const [selectedIp, setSelectedIp] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [firewallStatus, setFirewallStatus] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchNetworkDetails();
  }, [isOpen]);

  const fetchNetworkDetails = async () => {
    setLoading(true);
    try {
      const data = await apiService.fetchNetworkDiagnostics();
      if (data && data.primaryIp) {
        setNetworkInfo(data);
        setSelectedIp(data.primaryIp);
      } else {
        // Fallback detection from BASE_URL or location
        const host = window.location.hostname || '127.0.0.1';
        setNetworkInfo({ primaryIp: host, interfaces: [{ name: 'Wi-Fi', address: host }], port: 3101 });
        setSelectedIp(host);
      }
    } catch (err) {
      console.warn('Network diagnostics fetch failed:', err);
      const host = window.location.hostname || '127.0.0.1';
      setSelectedIp(host);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentIp = selectedIp || networkInfo.primaryIp || '127.0.0.1';
  const port = networkInfo.port || 3101;

  let targetPath = '/captain/';
  let targetTitle = 'Captain Mobile App';
  let targetDesc = 'Scan with iPhone or Android camera to open Captain Waiter App';

  if (activeTab === 'kitchen') {
    targetPath = '/kitchen/';
    targetTitle = 'Kitchen Mobile App';
    targetDesc = 'Scan with phone or tablet camera to open Mobile Kitchen App';
  } else if (activeTab === 'pos') {
    targetPath = '/';
    targetTitle = 'Main POS Terminal';
    targetDesc = 'Scan to connect secondary POS terminal on another laptop';
  }

  const fullTargetUrl = `http://${currentIp}:${port}${targetPath}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(fullTargetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        color: '#0f172a',
        width: '100%',
        maxWidth: '540px',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '14px' }}>
              <Wifi size={24} color="#38bdf8" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
                Connect Mobile Devices & LAN
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Scan QR code to connect iPhones, Androids, & iPads on Wi-Fi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Target App Selector Tabs */}
          <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '14px' }}>
            <button
              onClick={() => setActiveTab('captain')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'captain' ? '#0f172a' : 'transparent',
                color: activeTab === 'captain' ? '#ffffff' : '#64748b',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Smartphone size={16} /> Captain App
            </button>
            <button
              onClick={() => setActiveTab('kitchen')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'kitchen' ? '#0f172a' : 'transparent',
                color: activeTab === 'kitchen' ? '#ffffff' : '#64748b',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <ChefHat size={16} /> Kitchen App
            </button>
            <button
              onClick={() => setActiveTab('pos')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'pos' ? '#0f172a' : 'transparent',
                color: activeTab === 'pos' ? '#ffffff' : '#64748b',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Monitor size={16} /> Main POS
            </button>
          </div>

          {/* QR Code Card */}
          <div style={{
            background: '#f8fafc',
            border: '2px dashed #cbd5e1',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px'
          }}>
            <div style={{
              background: '#ffffff',
              padding: '16px',
              borderRadius: '16px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0'
            }}>
              {loading ? (
                <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  <RefreshCw size={28} className="animate-spin" />
                </div>
              ) : (
                <QRCodeSVG
                  value={fullTargetUrl}
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              )}
            </div>

            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
                {targetTitle}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                {targetDesc}
              </p>
            </div>

            {/* Clickable / Copyable URL Box */}
            <div style={{
              width: '100%',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <code style={{ fontSize: '13px', fontWeight: '600', color: '#0284c7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fullTargetUrl}
              </code>
              <button
                onClick={handleCopyUrl}
                style={{
                  background: copied ? '#10b981' : '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Wi-Fi Adapter Switcher */}
          {networkInfo.interfaces && networkInfo.interfaces.length > 1 && (
            <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Wi-Fi / LAN IP Adapter:</span>
              <select
                value={selectedIp}
                onChange={(e) => setSelectedIp(e.target.value)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#0f172a',
                  outline: 'none'
                }}
              >
                {networkInfo.interfaces.map(iface => (
                  <option key={iface.address} value={iface.address}>
                    {iface.name} ({iface.address})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 1-Click Auto-Configure Firewall Button */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px 16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>🛡️ Windows Firewall Auto-Config</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Grant 1-click permission to allow phones on any Wi-Fi</div>
              </div>
              <button
                disabled={firewallStatus === 'configuring'}
                onClick={async () => {
                  setFirewallStatus('configuring');
                  try {
                    if (window.electronAPI?.requestFirewallSetup) {
                      const res = await window.electronAPI.requestFirewallSetup();
                      if (res && res.success) {
                        setFirewallStatus('success');
                        setTimeout(() => setFirewallStatus(null), 5000);
                        return;
                      }
                    }
                    
                    const apiRes = await apiService.fixFirewall();
                    if (apiRes && (apiRes.success || apiRes.ok)) {
                      setFirewallStatus('success');
                      setTimeout(() => setFirewallStatus(null), 5000);
                    } else {
                      setFirewallStatus('error');
                    }
                  } catch (err) {
                    console.error('Firewall fix failed:', err);
                    setFirewallStatus('error');
                  }
                }}
                style={{
                  background: firewallStatus === 'success' ? '#10b981' : firewallStatus === 'error' ? '#ef4444' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: firewallStatus === 'configuring' ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: firewallStatus === 'configuring' ? 0.7 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {firewallStatus === 'configuring' ? (
                  <>
                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Unlocking...
                  </>
                ) : firewallStatus === 'success' ? (
                  '✅ Unlocked!'
                ) : firewallStatus === 'error' ? (
                  '❌ Try Again'
                ) : (
                  'Unlock Firewall'
                )}
              </button>
            </div>
            {firewallStatus === 'success' && (
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                ✅ Windows Firewall configured! Ports 3100 & 3101 are now whitelisted on LAN.
              </div>
            )}
            {firewallStatus === 'error' && (
              <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>
                ⚠️ Could not unblock automatically. Run <b>fix-firewall-ultimate.ps1</b> as Administrator.
              </div>
            )}
          </div>

          {/* Troubleshooting Note: Windows Firewall & Same Wi-Fi */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '12px',
            color: '#92400e',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
              <AlertTriangle size={16} color="#d97706" /> LAN Connection Troubleshooting Rules:
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Both devices (Laptop & Phone/Tablet) <b>must be on the exact same Wi-Fi router</b>.</li>
              <li>Click <b>Unlock Firewall</b> above to grant 1-click permission without turning off Windows Defender.</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LanConnectModal;
