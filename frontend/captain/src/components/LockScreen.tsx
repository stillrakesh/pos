import React, { useState, useEffect } from 'react';
import { Delete, ArrowRight, ShieldCheck } from 'lucide-react';
import { getBackendURL } from '../config';

interface LockScreenProps {
  onUnlock: () => void;
  requiredLength?: number;
  verifyEndpoint?: string;
  title?: string;
  description?: string;
  onCancel?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ 
  onUnlock, 
  requiredLength = 4, 
  verifyEndpoint = '/api/auth/verify',
  title = 'Captain Access',
  description = `Enter your ${requiredLength}-digit staff PIN to unlock the table network.`,
  onCancel
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleNumber = (num: number) => {
    if (pin.length < requiredLength) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleSubmit = async () => {
    if (pin.length !== requiredLength) return;
    
    setLoading(true);
    try {
      const baseUrl = getBackendURL();
      const response = await fetch(`${baseUrl}${verifyEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        onUnlock();
      } else {
        setError(true);
        setPin('');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(true);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === requiredLength) {
      handleSubmit();
    }
  }, [pin, requiredLength]);

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: '#f8fafc',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, color: '#1e293b', overflow: 'hidden', fontFamily: 'sans-serif'
    }}>
      
      {/* Background Decor */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '384px', height: '384px', backgroundColor: 'rgba(130,26,29,0.08)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '320px', height: '320px', backgroundColor: 'rgba(130,26,29,0.05)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }}></div>

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '384px', padding: '0 32px' }}>
        
        {/* Header Icon */}
        <div style={{ marginBottom: '32px', position: 'relative' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px', backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid rgba(130,26,29,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 40px -10px rgba(130,26,29,0.15)' }}>
            <ShieldCheck color="#821a1d" size={40} strokeWidth={1.5} />
          </div>
        </div>
        
        <h1 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '12px', color: '#1e293b', letterSpacing: '-0.5px' }}>{title}</h1>
        <p style={{ color: '#64748b', fontSize: '15px', fontWeight: 500, marginBottom: '40px', textAlign: 'center', maxWidth: '280px', lineHeight: 1.5 }}>
          {description}
        </p>

        {/* Dynamic PIN Display */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '40px', animation: error ? 'shake 0.4s ease-in-out' : 'none' }}>
          {Array.from({ length: requiredLength }).map((_, i) => {
            const isActive = pin.length > i;
            return (
              <div 
                key={i} 
                style={{
                  width: '18px', height: '18px', borderRadius: '50%', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  backgroundColor: error ? '#ef4444' : isActive ? '#821a1d' : '#e2e8f0',
                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: error ? '0 0 15px rgba(239,68,68,0.4)' : isActive ? '0 0 15px rgba(130,26,29,0.4)' : 'inset 0 2px 4px rgba(0,0,0,0.05)'
                }}
              />
            );
          })}
        </div>

        {/* Keypad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '280px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              className="keypad-btn"
            >
              {num}
            </button>
          ))}
          
          <button onClick={handleDelete} className="keypad-btn-secondary">
            <Delete size={24} strokeWidth={2} />
          </button>
          
          <button onClick={() => handleNumber(0)} className="keypad-btn">
            0
          </button>

          <button
            onClick={handleSubmit}
            disabled={pin.length !== requiredLength || loading}
            style={{
              height: '68px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s ease', border: 'none',
              backgroundColor: pin.length === requiredLength && !loading ? '#821a1d' : '#e2e8f0',
              color: pin.length === requiredLength && !loading ? 'white' : '#94a3b8',
              cursor: pin.length === requiredLength && !loading ? 'pointer' : 'not-allowed',
              boxShadow: pin.length === requiredLength && !loading ? '0 10px 25px -5px rgba(130,26,29,0.4)' : 'none'
            }}
          >
            {loading ? (
              <div style={{ width: '24px', height: '24px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            ) : (
              <ArrowRight size={28} strokeWidth={2.5} />
            )}
          </button>
        </div>

        {/* Status Messages */}
          {error && (
            <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '14px', backgroundColor: '#fef2f2', padding: '10px 24px', borderRadius: '14px', border: '1px solid #fecaca', textAlign: 'center', animation: 'fade-in 0.3s ease-out forwards' }}>
              Incorrect PIN. Try again.
            </div>
          )}
          {onCancel && (
            <button 
              onClick={onCancel}
              style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: '#64748b', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
            >
              CANCEL
            </button>
          )}
        </div>
      
      {/* Custom CSS injection */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .keypad-btn {
          height: 68px;
          border-radius: 24px;
          background-color: #ffffff;
          color: #1e293b;
          font-size: 26px;
          font-weight: 700;
          border: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
          font-family: 'Inter', system-ui, sans-serif;
        }
        .keypad-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
          border-color: #e2e8f0;
        }
        .keypad-btn:active {
          transform: translateY(2px) scale(0.96);
          background-color: #f8fafc;
          box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
        }
        .keypad-btn-secondary {
          height: 68px;
          border-radius: 24px;
          background-color: transparent;
          color: #64748b;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .keypad-btn-secondary:hover {
          color: #0f172a;
          background-color: rgba(226,232,240,0.5);
        }
        .keypad-btn-secondary:active {
          transform: scale(0.92);
        }
      `}</style>
    </div>
  );
};
