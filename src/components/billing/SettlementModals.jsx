import React, { useState } from 'react';
import { X, Printer, CreditCard, Banknote, Smartphone, Zap, Plus, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export const QuickPrintModal = ({ table, settings, onClose, onPrint }) => {
  const [discountVal, setDiscountVal] = useState('0');
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percent'
  const isPickup = table?.type === 'Takeaway' || table?.type === 'Delivery' || String(table?.id).startsWith('TA-') || String(table?.id).startsWith('DL-') || String(table?.id).startsWith('TAK-') || String(table?.id).startsWith('DEL-');
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(isPickup ? false : (table?.service_charge_enabled ?? !!settings?.autoServiceCharge));
  const [gstEnabled, setGstEnabled] = useState(table?.gst_enabled ?? !!settings?.gstEnabled);
  const gstRate = table?.gst_rate ?? settings?.gstRate ?? 5;

  if (!table) return null;

  const subtotal = (table.orders || table.items || []).reduce((acc, i) => acc + (i.price * i.qty), 0);
  
  let discountAmt = 0;
  if (discountType === 'percent') {
    discountAmt = subtotal * (parseFloat(discountVal) || 0) / 100;
  } else {
    discountAmt = parseFloat(discountVal) || 0;
  }

  const service = serviceChargeEnabled ? ((subtotal - discountAmt) * (settings.serviceChargeRate || 5) / 100) : 0;
  const taxableAmount = subtotal - discountAmt + service;
  const gstAmount = gstEnabled ? (taxableAmount * (gstRate / 100)) : 0;
  const grandTotal = Math.ceil(taxableAmount + gstAmount);

  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', width: '400px', borderRadius: '16px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>Print & Adjust Bill</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Subtotal</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>{formatCurrency(subtotal)}</div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#64748b', marginBottom: '8px' }}>DISCOUNT</div>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
                <input 
                  type="text" 
                  value={discountVal} 
                  onChange={e => setDiscountVal(e.target.value)}
                  style={{ background: 'white', border: 'none', flex: 1, padding: '8px', fontSize: '14px', borderRadius: '6px', outline: 'none', fontWeight: '500' }}
                />
                <button 
                  onClick={() => setDiscountType('amount')}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', background: discountType === 'amount' ? 'white' : 'transparent' }}
                >â‚¹</button>
                <button 
                  onClick={() => setDiscountType('percent')}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', background: discountType === 'percent' ? 'white' : 'transparent' }}
                >%</button>
              </div>
            </div>
          </div>

          {!isPickup && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fdf2f2', borderRadius: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#991b1b' }}>Service Charge ({settings.serviceChargeRate || 5}%)</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#991b1b' }}>{formatCurrency(service)}</span>
                <button 
                  onClick={() => setServiceChargeEnabled(!serviceChargeEnabled)}
                  style={{ width: '36px', height: '20px', borderRadius: '10px', background: serviceChargeEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative' }}
                >
                  <div style={{ position: 'absolute', top: '2px', left: serviceChargeEnabled ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }}></div>
                </button>
              </div>
            </div>
          )}

          {/* GST Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '10px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#166534' }}>GST ({gstRate}%)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#166534' }}>{formatCurrency(gstAmount)}</span>
              <button 
                onClick={() => setGstEnabled(!gstEnabled)}
                style={{ width: '36px', height: '20px', borderRadius: '10px', background: gstEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative' }}
              >
                <div style={{ position: 'absolute', top: '2px', left: gstEnabled ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }}></div>
              </button>
            </div>
          </div>

          <div style={{ borderTop: '2px dashed #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '700' }}>PAYABLE AMOUNT</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#94161c' }}>{formatCurrency(grandTotal)}</div>
          </div>
        </div>

        <button 
          onClick={() => onPrint(discountAmt, service, gstAmount, grandTotal, discountType === 'percent' ? parseFloat(discountVal) : 0, serviceChargeEnabled, gstEnabled)}
          style={{ width: '100%', padding: '16px', background: '#94161c', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <Printer size={20} /> PRINT BILL
        </button>
      </div>
    </div>
  );
};

export const QuickSettleModal = ({ table, settings, onClose, onSettle }) => {
  const [payments, setPayments] = useState([]);
  const [method, setMethod] = useState('Cash');
  const [amountPaidStr, setAmountPaidStr] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [showTipEntry, setShowTipEntry] = useState(false);

  if (!table) return null;

  const cartItems = (table.orders || table.items || []);
  const subtotal = cartItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const isPickup = table?.type === 'Takeaway' || table?.type === 'Delivery' || String(table?.id).startsWith('TA-') || String(table?.id).startsWith('DL-') || String(table?.id).startsWith('TAK-') || String(table?.id).startsWith('DEL-');
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(isPickup ? false : (table?.service_charge_enabled ?? !!settings?.autoServiceCharge));
  const [gstEnabled, setGstEnabled] = useState(table?.gst_enabled ?? !!settings?.gstEnabled);
  const gstRate = table?.gst_rate ?? settings?.gstRate ?? 5;

  const service = serviceChargeEnabled ? (subtotal * (table?.service_charge_rate ?? settings?.serviceChargeRate ?? 5) / 100) : 0;
  const taxable = subtotal + service;
  const gst = gstEnabled ? (taxable * (gstRate) / 100) : 0;
  const grandTotal = Math.ceil(taxable + gst);

  const rawEntered = parseFloat(amountPaidStr) || 0;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + rawEntered;
  const changeDue = totalPaid > grandTotal ? totalPaid - grandTotal : 0;
  
  const isExactPaid = totalPaid >= grandTotal;
  const isShortPaid = totalPaid > 0 && totalPaid < grandTotal;
  const isCanSettle = totalPaid > 0;
  const shortfallAmount = isShortPaid ? (grandTotal - totalPaid) : 0;

  const handleAddPayment = () => {
    const amt = parseFloat(amountPaidStr);
    if (amt > 0) {
      setPayments([...payments, { method, amount: amt }]);
      setAmountPaidStr('');
    }
  };

  const handleExecuteSettle = () => {
    const finalPayments = [...payments];
    const amt = parseFloat(amountPaidStr);
    if (amt > 0) finalPayments.push({ method, amount: amt });

    const totalCollected = finalPayments.reduce((acc, p) => acc + p.amount, 0);
    const effectiveGrandTotal = isShortPaid ? totalCollected : grandTotal;

    onSettle(
      finalPayments.length > 0 ? finalPayments : [{ method, amount: effectiveGrandTotal }],
      changeDue,
      effectiveGrandTotal,
      service,
      gst,
      subtotal,
      parseFloat(tipAmount) || 0,
      shortfallAmount
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="animate-fade-in" style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '440px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>Settle: {table.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        
        <div style={{ fontSize: '32px', fontWeight: '700', color: '#94161c', marginBottom: '4px' }}>{formatCurrency(grandTotal)}</div>
        
        {/* Breakdown Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
            <span>Subtotal ({cartItems.length} items)</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          
          {!isPickup && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: serviceChargeEnabled ? '#991b1b' : '#94a3b8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Service Charge ({settings?.serviceChargeRate || 5}%)</span>
                <button 
                  onClick={() => setServiceChargeEnabled(!serviceChargeEnabled)}
                  style={{ width: '28px', height: '16px', borderRadius: '8px', background: serviceChargeEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative' }}
                >
                  <div style={{ position: 'absolute', top: '2px', left: serviceChargeEnabled ? '14px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }}></div>
                </button>
              </div>
              <span>{formatCurrency(service)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', color: gstEnabled ? '#166534' : '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>GST ({gstRate}%)</span>
              <button 
                onClick={() => setGstEnabled(!gstEnabled)}
                style={{ width: '28px', height: '16px', borderRadius: '8px', background: gstEnabled ? '#10b981' : '#cbd5e1', border: 'none', cursor: 'pointer', position: 'relative' }}
              >
                <div style={{ position: 'absolute', top: '2px', left: gstEnabled ? '14px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }}></div>
              </button>
            </div>
            <span>{formatCurrency(gst)}</span>
          </div>
        </div>

        {/* FAST SETTLE BUTTONS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => onSettle([{ method: 'Cash', amount: grandTotal }], 0, grandTotal, service, gst, subtotal, parseFloat(tipAmount) || 0, 0)}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '16px', borderRadius: '16px', border: '1px solid #d1fae5', background: '#ecfdf5', color: '#047857', fontWeight: '600', cursor: 'pointer' 
            }}
          >
            <Banknote size={18} /> Cash Exact
          </button>
          <button
            onClick={() => onSettle([{ method: 'UPI', amount: grandTotal }], 0, grandTotal, service, gst, subtotal, parseFloat(tipAmount) || 0, 0)}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '16px', borderRadius: '16px', border: '1px solid #ebf5ff', background: '#eff6ff', color: '#2563eb', fontWeight: '600', cursor: 'pointer' 
            }}
          >
            <Smartphone size={18} /> UPI Exact
          </button>
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', margin: '0 -32px 24px', padding: '24px 32px 0' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>Detailed Payment</label>
          
          {payments.length > 0 && (
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payments.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500' }}>
                  <span>{p.method}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>{formatCurrency(p.amount)}</span>
                    <button onClick={() => setPayments(payments.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['Cash', 'Card', 'UPI'].map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '12px', fontWeight: '600', fontSize: '13px', 
                  border: `2px solid ${method === m ? '#94161c' : '#f1f5f9'}`, 
                  background: method === m ? '#fff1f2' : 'white', 
                  color: method === m ? '#94161c' : '#64748b', cursor: 'pointer' 
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              value={amountPaidStr}
              onChange={(e) => setAmountPaidStr(e.target.value)}
              placeholder="Amount Received..."
              style={{ boxSizing: 'border-box', flex: 1, padding: '16px', borderRadius: '16px', border: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '18px', fontWeight: '700', outline: 'none' }}
            />
            <button 
              onClick={handleAddPayment}
              disabled={!amountPaidStr}
              style={{ padding: '0 24px', borderRadius: '16px', background: amountPaidStr ? '#10b981' : '#cbd5e1', color: 'white', border: 'none', fontWeight: '600', cursor: amountPaidStr ? 'pointer' : 'not-allowed' }}
            >
              Add
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '13px', fontWeight: '600' }}>
            <span style={{ color: isExactPaid ? '#10b981' : (isShortPaid ? '#ea580c' : '#f59e0b') }}>
              {isExactPaid 
                ? 'Payment Received' 
                : (isShortPaid 
                    ? `Paid ${formatCurrency(totalPaid)} • Discount/Concession ${formatCurrency(shortfallAmount)}`
                    : `Pending ${formatCurrency(grandTotal - totalPaid)}`)}
            </span>
            {isExactPaid && changeDue > 0 && <span style={{ color: '#111827' }}>Return {formatCurrency(changeDue)}</span>}
          </div>

          {/* TIP SECTION (Table Orders Only) */}
          {!isPickup && (
            <div style={{ marginTop: '16px' }}>
              {!showTipEntry ? (
                <button 
                  onClick={() => setShowTipEntry(true)}
                  style={{ background: 'none', border: 'none', color: tipAmount > 0 ? '#047857' : '#f59e0b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}
                >
                  <Plus size={14} /> {tipAmount > 0 ? `STAFF TIP: ${formatCurrency(tipAmount)} (Tap to Edit)` : 'ADD STAFF TIP'}
                </button>
              ) : (
                <div style={{ padding: '16px', background: '#fff7ed', borderRadius: '16px', border: '1px solid #ffedd5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={14} color="#f59e0b"/>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#9a3412' }}>STAFF TIP</span>
                    </div>
                    <button onClick={() => { setShowTipEntry(false); setTipAmount(''); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#94a3b8' }}>₹</span>
                      <input
                        autoFocus
                        type="number"
                        value={tipAmount}
                        onChange={(e) => setTipAmount(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && setShowTipEntry(false)}
                        placeholder="0.00"
                        style={{ boxSizing: 'border-box', width: '100%', padding: '12px 12px 12px 32px', borderRadius: '12px', border: '1.5px solid #fed7aa', background: 'white', fontSize: '16px', fontWeight: '700', outline: 'none', color: '#9a3412' }}
                      />
                    </div>
                    <button 
                      onClick={() => setShowTipEntry(false)}
                      style={{ padding: '0 16px', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                    >
                      <CheckCircle size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '16px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
          <button 
            disabled={!isCanSettle} 
            onClick={handleExecuteSettle} 
            style={{ 
              flex: 1.5, padding: '16px', 
              background: isCanSettle ? (isShortPaid ? '#ea580c' : '#94161c') : '#cbd5e1', 
              color: 'white', border: 'none', borderRadius: '16px', fontWeight: '600', 
              cursor: isCanSettle ? 'pointer' : 'not-allowed', transition: 'all 0.2s' 
            }}
          >
            {isShortPaid ? `Settle Paid (${formatCurrency(totalPaid)})` : 'Settle Bill'}
          </button>
        </div>
      </div>
    </div>
  );
};
