import React, { useState } from 'react';
import { CheckSquare, Sunset, Banknote, CreditCard, Smartphone, ShieldCheck } from 'lucide-react';

const DayCloseWizard = ({ orderHistory, onCompleteDayClose }) => {
  const [cashCount, setCashCount] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  const payments = { Cash: 0, Card: 0, UPI: 0 };
  let totalDiscounts = 0;

  orderHistory.forEach(order => {
    payments[order.paymentMethod] = (payments[order.paymentMethod] || 0) + (order.grandTotal || 0);
    totalDiscounts += order.discountAmt || 0;
  });

  const totalExpectedSales = payments.Cash + payments.Card + payments.UPI;
  const cashDifference = parseFloat(cashCount || 0) - payments.Cash;

  const handleClose = () => {
    if (cashCount === '') {
      alert("Please enter the physical cash counted in the drawer.");
      return;
    }
    setIsCompleted(true);
  };

  if (isCompleted) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }} className="animate-fade-in">
        <div style={{ background: 'white', padding: '48px', borderRadius: '32px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f0fdf4', display: 'grid', placeItems: 'center', margin: '0 auto 24px' }}>
            <ShieldCheck size={40} color="#10b981" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '950', color: '#111827', marginBottom: '12px' }}>Day Closed Successfully</h2>
          <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '15px', fontWeight: '700', lineHeight: 1.6 }}>All tables have been cleared and Z-Report has been finalized. The system is ready for the next shift.</p>
          <button
            onClick={onCompleteDayClose}
            style={{ width: '100%', padding: '16px', background: '#a3112a', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '950', cursor: 'pointer', fontSize: '16px' }}
          >
            Start Fresh Shift
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px', background: '#f8fafc', overflowY: 'auto' }} className="animate-fade-in no-scrollbar">
      <div style={{ background: 'white', padding: '40px', borderRadius: '32px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '640px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
          <div style={{ padding: '12px', borderRadius: '14px', background: '#fff1f2' }}>
            <Sunset size={32} color="#a3112a" />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '950', color: '#111827' }}>End of Day Settlement</h2>
            <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '700' }}>Confirm Z-Report before shift closure</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '32px 0' }}>
          <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>SYSTEM NET SALES</div>
            <div style={{ fontSize: '28px', fontWeight: '950', color: '#111827' }}>₹{totalExpectedSales.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>TOTAL DISCOUNTS</div>
            <div style={{ fontSize: '28px', fontWeight: '950', color: '#ef4444' }}>₹{totalDiscounts.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ background: '#f0fdfa', padding: '20px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#0d9488', fontWeight: '900' }}>UPI / DIGITAL</div>
              <div style={{ fontSize: '18px', fontWeight: '950', color: '#111827' }}>₹{payments.UPI.toLocaleString('en-IN')}</div>
            </div>
            <Smartphone size={24} color="#0d9488" opacity={0.6} />
          </div>
          <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '900' }}>CARD PAYMENTS</div>
              <div style={{ fontSize: '18px', fontWeight: '950', color: '#111827' }}>₹{payments.Card.toLocaleString('en-IN')}</div>
            </div>
            <CreditCard size={24} color="#2563eb" opacity={0.6} />
          </div>
        </div>

        <div style={{ borderTop: '2px dashed #f1f5f9', margin: '32px 0' }}></div>

        <h3 style={{ fontSize: '18px', fontWeight: '950', color: '#111827', marginBottom: '20px' }}>Cash Drawer Verification</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '20px', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '900', textTransform: 'uppercase' }}>EXPECTED CASH</div>
            <div style={{ fontSize: '24px', fontWeight: '950', color: '#166534' }}>₹{payments.Cash.toLocaleString('en-IN')}</div>
          </div>
          <Banknote size={40} color="#16a34a" opacity={0.3} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '900', color: '#1f2937', marginBottom: '10px' }}>Physical Cash Counted (₹)</label>
            <input
              type="number"
              value={cashCount}
              onChange={(e) => setCashCount(e.target.value)}
              placeholder="Enter actual cash in drawer..."
              style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '18px', fontWeight: '950', outline: 'none' }}
              autoComplete="off"
            />
          </div>

          {cashCount !== '' && (
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderRadius: '16px',
              background: cashDifference === 0 ? '#f0fdf4' : cashDifference > 0 ? '#eff6ff' : '#fef2f2', 
              border: `1px solid ${cashDifference === 0 ? '#dcfce7' : cashDifference > 0 ? '#dbeafe' : '#fee2e2'}`
            }}>
              <span style={{ fontSize: '15px', fontWeight: '900', color: cashDifference === 0 ? '#166534' : cashDifference > 0 ? '#1e40af' : '#991b1b' }}>
                {cashDifference === 0 ? "Drawer Balanced" : cashDifference > 0 ? "Cash Overage" : "Cash Shortage"}
              </span>
              <span style={{ fontSize: '15px', fontWeight: '950', color: cashDifference === 0 ? '#166534' : cashDifference > 0 ? '#1e40af' : '#991b1b' }}>
                {cashDifference > 0 ? "+" : ""}₹{cashDifference.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={handleClose}
          style={{ width: '100%', padding: '18px', fontSize: '16px', background: '#111827', color: 'white', border: 'none', borderRadius: '18px', fontWeight: '950', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseEnter={(e) => e.target.style.background = '#000'}
          onMouseLeave={(e) => e.target.style.background = '#111827'}
        >
          Confirm Close & Finalize Z-Report
        </button>
      </div>
    </div>
  );
};

export default DayCloseWizard;
