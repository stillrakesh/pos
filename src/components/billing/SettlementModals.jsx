import React, { useState } from 'react';
import { X, Printer, CreditCard, Banknote, Smartphone, Zap } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export const QuickPrintModal = ({ table, settings, onClose, onPrint }) => {
  const [discountVal, setDiscountVal] = useState('0');
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percent'
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(!!settings?.autoServiceCharge);

  if (!table) return null;

  const subtotal = table.order.reduce((acc, i) => acc + (i.price * i.qty), 0);
  
  let discountAmt = 0;
  if (discountType === 'percent') {
    discountAmt = Math.floor(subtotal * (parseFloat(discountVal) || 0) / 100);
  } else {
    discountAmt = parseFloat(discountVal) || 0;
  }

  const service = serviceChargeEnabled ? Math.floor((subtotal - discountAmt) * (settings.serviceChargeRate || 5) / 100) : 0;
  const grandTotal = subtotal - discountAmt + service;

  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', width: '400px', borderRadius: '16px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#111827' }}>Print & Adjust Bill</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Subtotal</div>
            <div style={{ fontSize: '24px', fontWeight: '950', color: '#111827' }}>{formatCurrency(subtotal)}</div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '8px' }}>DISCOUNT</div>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
                <input 
                  type="text" 
                  value={discountVal} 
                  onChange={e => setDiscountVal(e.target.value)}
                  style={{ background: 'white', border: 'none', flex: 1, padding: '8px', fontSize: '14px', borderRadius: '6px', outline: 'none', fontWeight: '500' }}
                />
                <button 
                  onClick={() => setDiscountType('amount')}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '800', background: discountType === 'amount' ? 'white' : 'transparent' }}
                >â‚¹</button>
                <button 
                  onClick={() => setDiscountType('percent')}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '800', background: discountType === 'percent' ? 'white' : 'transparent' }}
                >%</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fdf2f2', borderRadius: '10px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#991b1b' }}>Service Charge ({settings.serviceChargeRate || 5}%)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#991b1b' }}>{formatCurrency(service)}</span>
              <button 
                onClick={() => setServiceChargeEnabled(!serviceChargeEnabled)}
                style={{ width: '36px', height: '20px', borderRadius: '10px', background: serviceChargeEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative' }}
              >
                <div style={{ position: 'absolute', top: '2px', left: serviceChargeEnabled ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }}></div>
              </button>
            </div>
          </div>

          <div style={{ borderTop: '2px dashed #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '800' }}>PAYABLE AMOUNT</div>
            <div style={{ fontSize: '24px', fontWeight: '950', color: '#94161c' }}>{formatCurrency(grandTotal)}</div>
          </div>
        </div>

        <button 
          onClick={() => onPrint(discountAmt, service, grandTotal)}
          style={{ width: '100%', padding: '16px', background: '#a3112a', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <Printer size={20} /> PRINT BILL
        </button>
      </div>
    </div>
  );
};

export const QuickSettleModal = ({ table, settings, onClose, onSettle }) => {
  const [method, setMethod] = useState('Cash');
  const [amountPaidStr, setAmountPaidStr] = useState('');

  if (!table) return null;

  const subtotal = table.order.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const service = settings?.autoServiceCharge ? Math.floor(subtotal * (settings.serviceChargeRate || 5) / 100) : 0;
  const grandTotal = subtotal + service;

  const amountPaid = parseFloat(amountPaidStr) || 0;
  const changeDue = amountPaid > grandTotal ? amountPaid - grandTotal : 0;
  const isExactPaid = amountPaid >= grandTotal;
  const quickCashAmounts = [grandTotal, Math.ceil(grandTotal / 100) * 100, Math.ceil(grandTotal / 500) * 500];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="animate-fade-in" style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '440px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '950', color: '#1f2937' }}>Settle: {table.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        
        <div style={{ fontSize: '32px', fontWeight: '950', color: '#a3112a', marginBottom: '4px' }}>{formatCurrency(grandTotal)}</div>
        <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '700', marginBottom: '24px' }}>Quick settlement for {table.order.length} items</p>

        {/* FAST SETTLE BUTTONS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => onSettle('Cash', grandTotal, 0)}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '16px', borderRadius: '16px', border: '1px solid #d1fae5', background: '#ecfdf5', color: '#047857', fontWeight: '950', cursor: 'pointer' 
            }}
          >
            <Banknote size={18} /> Cash Exact
          </button>
          <button
            onClick={() => onSettle('UPI', grandTotal, 0)}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '16px', borderRadius: '16px', border: '1px solid #ebf5ff', background: '#eff6ff', color: '#2563eb', fontWeight: '950', cursor: 'pointer' 
            }}
          >
            <Smartphone size={18} /> UPI Exact
          </button>
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', margin: '0 -32px 24px', padding: '24px 32px 0' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '900', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>Detailed Payment</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['Cash', 'Card', 'UPI'].map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '12px', fontWeight: '900', fontSize: '13px', 
                  border: `2px solid ${method === m ? '#a3112a' : '#f1f5f9'}`, 
                  background: method === m ? '#fff1f2' : 'white', 
                  color: method === m ? '#a3112a' : '#64748b', cursor: 'pointer' 
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <input
            type="number"
            value={amountPaidStr}
            onChange={(e) => setAmountPaidStr(e.target.value)}
            placeholder="Amount Received..."
            style={{ boxSizing: 'border-box', width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '18px', fontWeight: '950', outline: 'none' }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '14px', fontWeight: '900' }}>
            <span style={{ color: isExactPaid ? '#10b981' : '#f59e0b' }}>
              {isExactPaid ? 'Payment Received' : `Pending ${formatCurrency(grandTotal - amountPaid)}`}
            </span>
            {isExactPaid && changeDue > 0 && <span style={{ color: '#111827' }}>Return {formatCurrency(changeDue)}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer' }}>Cancel</button>
          <button 
            disabled={!isExactPaid && amountPaidStr !== ''} 
            onClick={() => onSettle(method, amountPaid || grandTotal, changeDue)} 
            style={{ 
              flex: 1.5, padding: '16px', background: isExactPaid || amountPaidStr === '' ? '#a3112a' : '#cbd5e1', 
              color: 'white', border: 'none', borderRadius: '16px', fontWeight: '950', cursor: (isExactPaid || amountPaidStr === '') ? 'pointer' : 'not-allowed' 
            }}
          >
            Settle Bill
          </button>
        </div>
      </div>
    </div>
  );
};
