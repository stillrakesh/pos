import React, { useState, useMemo } from 'react';
import { ChevronLeft, Plus, Search, CheckCircle2, ShoppingBag, SendHorizontal, Phone, User, ClipboardList, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PickupModuleProps {
  pickupOrders: any[];
  menuItems: any[];
  categories: string[];
  onBack: () => void;
  onPlaceOrder: (payload: any) => void;
}

export const PickupModule: React.FC<PickupModuleProps> = ({ pickupOrders, menuItems, categories, onBack, onPlaceOrder }) => {
  const [view, setView] = useState<'dashboard' | 'create'>('dashboard');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  
  // Order creation state
  const [cart, setCart] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  // --- Logic ---
  const activePickups = pickupOrders.filter(o => o.status !== 'completed' && o.status !== 'canceled');

  const filteredItems = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return menuItems.filter(i => category === 'All' || i.category === category);
    }
    return menuItems.filter(i => {
      const matchesName = i.name.toLowerCase().includes(query);
      const matchesShortCode = i.short_code && String(i.short_code).toLowerCase().includes(query);
      return matchesName || matchesShortCode;
    }).sort((a, b) => {
      const aExact = a.short_code?.toLowerCase() === query;
      const bExact = b.short_code?.toLowerCase() === query;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [category, search, menuItems]);

  const add = (m: any) =>
    setCart(p => {
      const ex = p.find(i => i.id === m.id);
      if (ex) return p.map(i => i.id === m.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...p, { id: m.id, name: m.name, price: m.price, quantity: 1, category: m.category, isVeg: m.isVeg }];
    });

  const dec = (id: string) =>
    setCart(p => {
      const ex = p.find(i => i.id === id);
      if (ex && ex.quantity > 1) return p.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      return p.filter(i => i.id !== id);
    });

  const getQty = (id: string) => cart.find(i => i.id === id)?.quantity || 0;
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSubmit = () => {
    if (cart.length === 0) return;
    setSending(true);

    const payload = {
      customerName,
      phone: customerPhone,
      items: cart,
      paymentMethod,
      notes
    };

    onPlaceOrder(payload);
    
    setTimeout(() => {
      setSent(true);
      setShowCheckout(false);
      setTimeout(() => {
        setSent(false);
        setSending(false);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setNotes('');
        setPaymentMethod('Cash');
        setView('dashboard');
      }, 1500);
    }, 500);
  };

  // --- VIEWS ---

  if (view === 'create') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f1f5f9', display: 'flex', flexDirection: 'column', zIndex: 30, overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setView('dashboard')} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '8px', borderRadius: '10px', border: 'none' }}><ChevronLeft size={24} /></button>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>New Pickup</h1>
              <p style={{ fontSize: '11px', fontWeight: 700, margin: 0, opacity: 0.8 }}>Add items & customer info</p>
            </div>
          </div>
        </header>

        {/* Menu Section */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px', flexShrink: 0 }}>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes..."
              style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', outline: 'none', background: '#f1f5f9', fontWeight: 700 }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="hide-scrollbar">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{ padding: '8px 18px', borderRadius: '25px', fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap', background: category === c ? '#fbbf24' : '#f1f5f9', color: category === c ? '#000' : '#64748b', border: category === c ? '2px solid #b45309' : 'none', transition: 'all 0.2s' }}>{c}</button>
            ))}
          </div>
        </div>

        {/* Item List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', paddingBottom: '100px' }}>
            {filteredItems.map(item => {
              const qty = getQty(item.id);
              return (
                <motion.div whileTap={{ scale: 0.96 }} key={item.id} onClick={() => add(item)}
                  style={{ background: '#fff', borderRadius: '20px', padding: '16px 20px', border: qty > 0 ? '2px solid #821a1d' : '1px solid #eef2f6', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', height: '85px', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ position: 'absolute', left: 0, top: '16px', bottom: '16px', width: '4px', background: item.isVeg ? '#22c55e' : '#ef4444', borderRadius: '0 4px 4px 0' }} />
                  {qty > 0 && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#821a1d', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 950, boxShadow: '0 4px 10px rgba(130,26,29,0.3)' }}>{qty}</div>}
                  <div style={{ paddingLeft: '8px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 800, lineHeight: 1.2, color: '#1e293b', marginBottom: '2px' }}>{item.name}</p>
                    <p style={{ fontSize: '16px', fontWeight: 950, color: '#821a1d' }}>₹{item.price}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* View Cart Button */}
        {cart.length > 0 && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px', background: 'linear-gradient(to top, #fff 70%, transparent)', zIndex: 40 }}>
            <motion.button initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={() => setShowCheckout(true)}
              style={{ width: '100%', background: '#821a1d', color: '#fff', border: 'none', borderRadius: '20px', padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 25px rgba(130,26,29,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '12px' }}><ShoppingBag size={20} /></div>
                <div style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 800, opacity: 0.8 }}>{cart.length} ITEMS SELECTED</span>
                  <span style={{ fontSize: '18px', fontWeight: 950 }}>VIEW CHECKOUT</span>
                </div>
              </div>
              <span style={{ fontSize: '20px', fontWeight: 900 }}>₹{total}</span>
            </motion.button>
          </div>
        )}

        {/* Checkout Modal */}
        <AnimatePresence>
          {showCheckout && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCheckout(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, backdropFilter: 'blur(6px)' }} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '95vh', zIndex: 110, background: '#fff', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><h2 style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b' }}>Order Details</h2><p style={{ fontSize: '13px', color: '#64748b', fontWeight: 700 }}>Pickup Details</p></div>
                  <button onClick={() => setShowCheckout(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  {/* Customer Info Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ position: 'relative' }}>
                      <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#821a1d' }} />
                      <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer Name (Optional)"
                        style={{ width: '100%', padding: '16px 16px 16px 48px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '15px', fontWeight: 700, outline: 'none' }} />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Phone size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#821a1d' }} />
                      <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone Number (Optional)"
                        style={{ width: '100%', padding: '16px 16px 16px 48px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '15px', fontWeight: 700, outline: 'none' }} />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <ClipboardList size={18} style={{ position: 'absolute', left: '16px', top: '18px', color: '#821a1d' }} />
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Kitchen instructions..."
                        style={{ width: '100%', height: '80px', padding: '16px 16px 16px 48px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '15px', fontWeight: 700, outline: 'none' }} />
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', display: 'block', paddingLeft: '4px' }}>Payment Method</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {['Cash', 'UPI', 'Card'].map(m => (
                          <button 
                            key={m} 
                            onClick={() => setPaymentMethod(m as any)}
                            style={{ 
                              padding: '12px', 
                              borderRadius: '14px', 
                              border: '1.5px solid', 
                              borderColor: paymentMethod === m ? '#821a1d' : '#e2e8f0', 
                              background: paymentMethod === m ? '#fef2f2' : '#fff', 
                              color: paymentMethod === m ? '#821a1d' : '#64748b', 
                              fontWeight: 900, 
                              fontSize: '13px',
                              transition: 'all 0.2s'
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>Order Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <div><p style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>{item.name}</p><p style={{ fontSize: '14px', fontWeight: 900, color: '#821a1d', margin: 0 }}>₹{item.price * item.quantity}</p></div>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                          <button onClick={() => dec(item.id)} style={{ width: '36px', height: '36px', border: 'none', background: 'none', fontWeight: 900 }}>−</button>
                          <span style={{ width: '36px', textAlign: 'center', fontWeight: 950 }}>{item.quantity}</span>
                          <button onClick={() => add(item)} style={{ width: '36px', height: '36px', border: 'none', background: 'none', fontWeight: 900 }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '24px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><span style={{ fontSize: '16px', fontWeight: 700, color: '#64748b' }}>Grand Total</span><span style={{ fontSize: '28px', fontWeight: 950, color: '#1e293b' }}>₹{total}</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                    <button onClick={() => { setCart([]); setShowCheckout(false); }} style={{ background: '#f1f5f9', borderRadius: '20px', border: 'none', padding: '18px', fontSize: '15px', fontWeight: 900, color: '#64748b' }}>CANCEL</button>
                    <button disabled={sending} onClick={handleSubmit} style={{ background: '#821a1d', color: '#fff', border: 'none', borderRadius: '20px', padding: '18px', fontSize: '16px', fontWeight: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(130,26,29,0.3)' }}>
                      {sending ? 'PLACING...' : 'SEND TO POS'}<SendHorizontal size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Success Overlay */}
        <AnimatePresence>
          {sent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ background: '#fff', borderRadius: '32px', padding: '40px 24px', textAlign: 'center', width: '85%', maxWidth: '360px' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><CheckCircle2 size={40} color="#22c55e" /></div>
                <h3 style={{ fontSize: '22px', fontWeight: 950, color: '#065f46' }}>ORDER SENT!</h3>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', marginTop: '8px' }}>Printing KOT on POS...</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f1f5f9', display: 'flex', flexDirection: 'column', zIndex: 30, overflow: 'hidden' }}>
      <header style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onBack} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '8px', borderRadius: '10px', border: 'none' }}><ChevronLeft size={24} /></button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 900, margin: 0, letterSpacing: '0.5px' }}>PICKUPS</h1>
            <p style={{ fontSize: '11px', fontWeight: 700, margin: 0, opacity: 0.8 }}>Live sync with POS</p>
          </div>
        </div>
        <button onClick={() => setView('create')} style={{ background: '#fff', color: '#821a1d', border: 'none', borderRadius: '12px', padding: '8px 16px', fontSize: '12px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          <Plus size={16} strokeWidth={3} /> NEW ORDER
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 100px' }}>
        {activePickups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <div style={{ width: '80px', height: '80px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', opacity: 0.5 }}><ShoppingBag size={40} /></div>
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#64748b' }}>No Active Pickups</h3>
            <p style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px' }}>New orders will appear here</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '16px' }}>
            {activePickups.map(order => {
              const orderItems = order.orders || order.items || [];
              const itemCount = orderItems.reduce((s: number, i: any) => s + (Number(i.qty) || Number(i.quantity) || 0), 0) || orderItems.length;
              const orderTotal = order.totalAmount || orderItems.reduce((s: number, i: any) => s + ((Number(i.price) || 0) * (Number(i.qty) || Number(i.quantity) || 1)), 0);
              const phoneNum = order.phone || order.customerPhone || '';
              const isPaid = order.paymentStatus === 'PAID' || order.payment_status === 'PAID';

              return (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={order.id}
                style={{ background: '#fff', borderRadius: '24px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '100%', background: isPaid ? '#22c55e' : '#f59e0b' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 950, color: '#0f172a', margin: 0 }}>{order.customerName || order.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{order.id}</span>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }} />
                      <span style={{ fontSize: '11px', fontWeight: 900, color: '#821a1d' }}>{itemCount} ITEMS</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <div style={{ 
                      padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: isPaid ? '#f0fdf4' : '#fffbeb', 
                      color: isPaid ? '#16a34a' : '#b45309',
                      border: `1px solid ${isPaid ? '#bbf7d0' : '#fde68a'}`
                    }}>
                      {isPaid ? '✓ PAID' : 'UNPAID'}
                    </div>
                    {order.paymentMethod && (
                      <div style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                        {order.paymentMethod}
                      </div>
                    )}
                  </div>
                </div>

                {phoneNum && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #eef2f6', marginLeft: '10px' }}>
                    <Phone size={14} color="#821a1d" />
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>{phoneNum}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Total</div>
                  <span style={{ fontSize: '24px', fontWeight: 950, color: '#0f172a' }}>₹{orderTotal}</span>
                </div>
              </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
