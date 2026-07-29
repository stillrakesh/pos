import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TrendingUp, ShoppingBag, CreditCard, Clock, Search, Printer, Download, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Package, Calendar, Zap, AlertTriangle, CheckCircle, DollarSign, Layers, Trash2, Plus, Settings, Users, ShieldAlert, RefreshCw, FileText, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';
import { formatCurrency, getOrderTotal } from '../../utils/formatters';
import { BASE_URL } from '../../constants';
import apiService from '../../services/apiService';


const PALETTE = ['#94161c','#2563eb','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ef4444','#84cc16'];

const KPICard = ({ label, value, icon: Icon, color, sub, trend }) => (
  <div style={{ background:'white', padding:'24px', borderRadius:'20px', border:'1px solid #e2e8f0', display:'flex', flexDirection:'column', gap:'12px', transition:'transform 0.2s' }}
    onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
    onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
      <div style={{ width:44, height:44, borderRadius:12, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={22} color={color} />
      </div>
      {trend != null && (
        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:800, color: trend>=0?'#10b981':'#ef4444', background: trend>=0?'#f0fdf4':'#fef2f2', padding:'3px 8px', borderRadius:8 }}>
          {trend>=0?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>}{Math.abs(trend)}%
        </div>
      )}
    </div>
    <div>
      <div style={{ fontSize:11, color:'#64748b', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:950, color:'#111827', letterSpacing:'-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, marginTop:4 }}>{sub}</div>}
    </div>
  </div>
);

const SectionCard = ({ title, subtitle, children, action }) => (
  <div style={{ background:'white', padding:'28px', borderRadius:'24px', border:'1px solid #e2e8f0' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
      <div>
        <div style={{ fontSize:17, fontWeight:950, color:'#111827' }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:'#64748b', fontWeight:700, marginTop:2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const TabBtn = ({ label, icon: Icon, active, onClick }) => (
  <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 4px', border:'none', background:'none', fontSize:14, fontWeight:900, cursor:'pointer', color: active?'#111827':'#94a3b8', borderBottom:`3px solid ${active?'#94161c':'transparent'}`, transition:'all 0.2s', position:'relative', whiteSpace:'nowrap' }}>
    <Icon size={17} />{label}
  </button>
);

const RANGES = ['Today','Yesterday','Last 7 Days','Last 30 Days','This Month','Last Month','Custom'];

const ReportsHub = ({ orderHistory=[], menuItems=[], tables=[], nonTableOrders=[], loadHistory, initialTab='overview' }) => {
  const [tab, setTab] = useState(initialTab || 'overview');

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);
  const [range, setRange] = useState('Today');
  const [custom, setCustom] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
  const [closeHour, setCloseHour] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newExp, setNewExp] = useState({ amount:'', category:'Staff', note:'', date: new Date().toISOString().split('T')[0] });
  const [productQ, setProductQ] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [localCloseHour, setLocalCloseHour] = useState(0);

  // Orders search tab state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState('All');
  const [orderPayFilter, setOrderPayFilter] = useState('All');
  const [orderSort, setOrderSort] = useState({ field: 'timestamp', dir: 'desc' });
  const [orderPage, setOrderPage] = useState(1);
  const ORDER_PAGE_SIZE = 20;

  // --- Phase 2: CRM & Audit ---
  const [crmData, setCrmData] = useState([]);
  const [auditData, setAuditData] = useState([]);
  const [crmSearch, setCrmSearch] = useState('');
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState(null);
  const [customerOrdersHistory, setCustomerOrdersHistory] = useState([]);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustName, setNewCustName] = useState('');

  // ─── Date range bounds (with business-day offset) ────────────
  const getDateRange = () => {
    const today = new Date(); today.setHours(23,59,59,999);
    let start = new Date(); start.setHours(0,0,0,0);
    let end = new Date(today);
    switch(range) {
      case 'Yesterday': start.setDate(start.getDate()-1); end.setDate(end.getDate()-1); end.setHours(23,59,59,999); break;
      case 'Last 7 Days': start.setDate(start.getDate()-6); break;
      case 'Last 30 Days': start.setDate(start.getDate()-29); break;
      case 'This Month': start = new Date(today.getFullYear(), today.getMonth(), 1); break;
      case 'Last Month': start = new Date(today.getFullYear(), today.getMonth()-1, 1); end = new Date(today.getFullYear(), today.getMonth(), 0, 23,59,59,999); break;
      case 'Custom': start = new Date(custom.start+'T00:00:00'); end = new Date(custom.end+'T23:59:59'); break;
    }
    // Apply business-day close offset: shift boundary back by closeHour
    const offsetMs = closeHour * 3600 * 1000;
    return { start: new Date(start.getTime() + offsetMs), end: new Date(end.getTime() + offsetMs) };
  };

  // ─── CRITICAL FIX: Only use orderHistory (settled/completed orders from DB).
  //     nonTableOrders are LIVE, ACTIVE, UNSETTLED orders and must NOT be in analytics.
  //     The backend /api/billing/history endpoint already returns only COMPLETED and CANCELED orders.
  const allOrders = useMemo(() => orderHistory || [], [orderHistory]);

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  // ─── Strictly filter to PAID + not cancelled ─────────────────
  // isPaid = the order has PAID payment status AND is not cancelled/canceled
  const filteredOrders = useMemo(() => allOrders.filter(o => {
    if (!o || !o.timestamp) return false;
    const ts = new Date(o.timestamp);
    if (isNaN(ts.getTime())) return false;
    const status = String(o.status || '').toUpperCase();
    const payStatus = String(o.paymentStatus || o.payment_status || '').toUpperCase();
    // Must be PAID and not cancelled in any spelling variant
    const isCancelled = status === 'CANCELED' || status === 'CANCELLED' || payStatus === 'CANCELLED' || payStatus === 'CANCELED';
    if (isCancelled) return false;
    const isPaid = payStatus === 'PAID' || status === 'COMPLETED';
    return isPaid && ts >= rangeStart && ts <= rangeEnd;
  }), [allOrders, rangeStart, rangeEnd]);

  // Previous period (same length) for comparison
  const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
  const prevStart = new Date(rangeStart.getTime() - rangeMs - 1);
  const prevEnd = new Date(rangeStart.getTime() - 1);
  const prevOrders = useMemo(() => allOrders.filter(o => {
    if (!o || !o.timestamp) return false;
    const ts = new Date(o.timestamp);
    if (isNaN(ts.getTime())) return false;
    const status = String(o.status || '').toUpperCase();
    const payStatus = String(o.paymentStatus || o.payment_status || '').toUpperCase();
    const isCancelled = status === 'CANCELED' || status === 'CANCELLED' || payStatus === 'CANCELLED' || payStatus === 'CANCELED';
    if (isCancelled) return false;
    const isPaid = payStatus === 'PAID' || status === 'COMPLETED';
    return isPaid && ts >= prevStart && ts <= prevEnd;
  }), [allOrders, prevStart, prevEnd]);

  // ─── KPI Metrics ─────────────────────────────────────────────
  const totalRevenue = filteredOrders.reduce((s, o) => s + (o.grandTotal || o.grand_total || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalItems = filteredOrders.reduce((s, o) => s + (o.cart || o.orders || o.items || []).reduce((ss, i) => ss + (i.qty || i.quantity || 1), 0), 0);
  const totalGst = filteredOrders.reduce((s, o) => s + (Number(o.gstAmount) || Number(o.gst_amount) || 0), 0);
  const totalSC = filteredOrders.reduce((s, o) => s + (Number(o.serviceCharge) || Number(o.service_charge) || 0), 0);
  const totalTips = filteredOrders.reduce((s, o) => s + (Number(o.tipAmount) || Number(o.tip_amount) || 0), 0);

  const prevRevenue = prevOrders.reduce((s, o) => s + (o.grandTotal || o.grand_total || 0), 0);
  const prevOrdsCount = prevOrders.length;
  const pct = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : (a > 0 ? 100 : 0);
  const netSales = totalRevenue - totalGst - totalSC;
  const prevNetSales = prevRevenue -
    prevOrders.reduce((s,o)=>s+(Number(o.gstAmount)||Number(o.gst_amount)||0),0) -
    prevOrders.reduce((s,o)=>s+(Number(o.serviceCharge)||Number(o.service_charge)||0),0);

  const changes = {
    revenue: pct(totalRevenue, prevRevenue),
    netSales: pct(netSales, prevNetSales),
    orders: pct(totalOrders, prevOrdsCount),
    items: pct(totalItems, prevOrders.reduce((s,o)=>s+(o.cart||o.orders||o.items||[]).reduce((ss,i)=>ss+(i.qty||i.quantity||1),0),0)),
    aov: pct(avgOrderValue, prevOrdsCount > 0 ? prevRevenue / prevOrdsCount : 0),
    tips: pct(totalTips, prevOrders.reduce((s, o) => s + (Number(o.tipAmount || 0) + Number(o.tip_amount || 0)), 0))
  };

  // ─── Payment Breakdown ────────────────────────────────────────
  const payBreakdown = {};
  filteredOrders.forEach(o => {
    if (o.splitPayments && o.splitPayments.length > 0) {
      o.splitPayments.forEach(p => { payBreakdown[p.method] = (payBreakdown[p.method] || 0) + p.amount; });
    } else {
      const m = o.paymentMethod || o.payment_method || 'Cash';
      payBreakdown[m] = (payBreakdown[m] || 0) + (o.grandTotal || o.grand_total || 0);
    }
  });
  const payData = Object.entries(payBreakdown).map(([name, value]) => ({ name, value: Math.round(value) })).filter(d => d.value > 0);

  // ─── Source Breakdown (Dine-in vs Takeaway) ──────────────────
  const sourceBreakdown = { 'Dine In': 0, 'Pickup': 0 };
  const sourceCounts = { 'Dine In': 0, 'Pickup': 0 };
  
  filteredOrders.forEach(o => {
    const id = String(o.id || '').toUpperCase();
    const tableNum = String(o.table_number || o.tableNumber || o.table || '').toUpperCase();
    const type = o.type || o.orderType || '';
    const isPickup = type === 'Takeaway' || type === 'Delivery' || 
                     id.startsWith('TA-') || id.startsWith('DL-') || id.startsWith('TAK-') || id.startsWith('DEL-') ||
                     tableNum.startsWith('TA-') || tableNum.startsWith('DL-') || tableNum.startsWith('TAK-') || tableNum.startsWith('DEL-');
    
    if (isPickup) {
      sourceBreakdown['Pickup'] += (o.grandTotal || o.grand_total || 0);
      sourceCounts['Pickup']++;
    } else {
      sourceBreakdown['Dine In'] += (o.grandTotal || o.grand_total || 0);
      sourceCounts['Dine In']++;
    }
  });
  const sourceData = Object.entries(sourceBreakdown).map(([name, value]) => ({ name, value: Math.round(value) }));

  // ─── Revenue Trend (daily) ────────────────────────────────────
  const trend = [];
  const trendCursor = new Date(rangeStart);
  trendCursor.setHours(0,0,0,0);
  const trendEnd = new Date(rangeEnd);
  while (trendCursor <= trendEnd && trend.length < 120) {
    const dayStr = trendCursor.toISOString().split('T')[0];
    const dayOrders = filteredOrders.filter(o => new Date(o.timestamp).toISOString().split('T')[0] === dayStr);
    trend.push({
      key: dayStr,
      label: trendCursor.toLocaleDateString('en-IN', { day:'numeric', month:'short' }),
      revenue: dayOrders.reduce((s,o)=>s+(o.grandTotal||o.grand_total||0),0),
      orders: dayOrders.length
    });
    trendCursor.setDate(trendCursor.getDate()+1);
  }

  // ─── Hourly Breakdown ─────────────────────────────────────────
  const hourlyBuckets = Array.from({ length:24 }, (_,h) => ({ key:`${String(h).padStart(2,'0')}:00`, label:`${String(h).padStart(2,'0')}:00`, revenue:0, orders:0 }));
  filteredOrders.forEach(o => {
    const h = new Date(o.timestamp).getHours();
    hourlyBuckets[h].revenue += o.grandTotal || o.grand_total || 0;
    hourlyBuckets[h].orders++;
  });

  // ─── Product Performance ──────────────────────────────────────
  const productMap = {};
  // Seed with menu items so zero-sellers appear
  (menuItems || []).forEach(item => {
    if (!item?.name) return;
    productMap[item.name] = { name:item.name, category: item.category||item.cat||'General', qty:0, revenue:0 };
  });
  filteredOrders.forEach(o => {
    (o.cart || o.orders || o.items || []).forEach(item => {
      const nm = item.name || 'Unknown';
      if (!productMap[nm]) productMap[nm] = { name:nm, category: item.category||item.cat||'General', qty:0, revenue:0 };
      const qty = item.qty || item.quantity || 1;
      productMap[nm].qty += qty;
      productMap[nm].revenue += qty * (item.price || 0);
    });
  });
  // Previous period product qty for comparison
  const prevProductQty = {};
  prevOrders.forEach(o => {
    (o.cart || o.orders || o.items || []).forEach(item => {
      const nm = item.name || 'Unknown';
      prevProductQty[nm] = (prevProductQty[nm] || 0) + (item.qty || item.quantity || 1);
    });
  });
  const products = Object.values(productMap).map(p => {
    const prevQty = prevProductQty[p.name] || 0;
    const change = prevQty > 0 ? Math.round(((p.qty - prevQty) / prevQty) * 100) : null;
    return { ...p, prevQty, change };
  }).sort((a,b) => b.revenue - a.revenue);

  // ─── Staff Analytics ──────────────────────────────────────────
  const staffSales = {};
  filteredOrders.forEach(o => {
    const staff = o.served_by || o.captain_name || o.captain || 'Cashier';
    if (!staffSales[staff]) staffSales[staff] = { name: staff, revenue: 0, orders: 0, tips: 0 };
    staffSales[staff].revenue += (o.grandTotal || o.grand_total || 0);
    staffSales[staff].orders += 1;
    staffSales[staff].tips += (o.tip_amount || 0);
  });
  const topCaptains = Object.values(staffSales).sort((a,b) => b.revenue - a.revenue);

  // ─── Orders Search (for the Orders tab) ──────────────────────
  // Search across ALL settled orders regardless of date range
  const allSettledOrders = useMemo(() => {
    return (orderHistory || []).filter(o => {
      const status = String(o.status || '').toUpperCase();
      const payStatus = String(o.paymentStatus || o.payment_status || '').toUpperCase();
      const isCancelled = status === 'CANCELED' || status === 'CANCELLED' || payStatus === 'CANCELLED' || payStatus === 'CANCELED';
      return !isCancelled && (payStatus === 'PAID' || status === 'COMPLETED');
    });
  }, [orderHistory]);

  const orderTypeFilters = ['All', 'Dine In', 'Takeaway', 'Delivery'];
  const orderPayFilters = ['All', 'Cash', 'UPI', 'Card', 'Split'];

  const searchedOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return allSettledOrders.filter(o => {
      // Type filter
      if (orderTypeFilter !== 'All') {
        const id = String(o.id || '').toUpperCase();
        const tableNum = String(o.table_number || o.tableNumber || '').toUpperCase();
        const type = o.type || o.orderType || '';
        let oType = 'Dine In';
        if (type === 'Takeaway' || id.startsWith('TA-') || id.startsWith('TAK-') || tableNum.startsWith('TA-') || tableNum.startsWith('TAK-')) oType = 'Takeaway';
        else if (type === 'Delivery' || id.startsWith('DL-') || id.startsWith('DEL-') || tableNum.startsWith('DL-') || tableNum.startsWith('DEL-')) oType = 'Delivery';
        if (oType !== orderTypeFilter) return false;
      }
      // Payment filter
      if (orderPayFilter !== 'All') {
        const pm = o.paymentMethod || o.payment_method || 'Cash';
        if (!pm.toLowerCase().includes(orderPayFilter.toLowerCase())) return false;
      }
      // Text search
      if (!q) return true;
      const customer = (o.customerName || o.customer_name || '').toLowerCase();
      const phone = (o.phone || '').toLowerCase();
      const id = String(o.id || '').toLowerCase();
      const pm = (o.paymentMethod || o.payment_method || '').toLowerCase();
      const amount = String(o.grandTotal || o.grand_total || 0);
      const tableNum = String(o.table_number || o.tableNumber || o.table || '').toLowerCase();
      const note = (o.note || o.notes || '').toLowerCase();
      // Item search
      const itemNames = (o.cart || o.orders || o.items || []).map(i => (i.name || '').toLowerCase()).join(' ');
      return customer.includes(q) || phone.includes(q) || id.includes(q) || pm.includes(q) || amount.includes(q) || tableNum.includes(q) || itemNames.includes(q) || note.includes(q);
    }).sort((a, b) => {
      const dir = orderSort.dir === 'asc' ? 1 : -1;
      if (orderSort.field === 'timestamp') return dir * (new Date(b.timestamp) - new Date(a.timestamp)) * -1;
      if (orderSort.field === 'grandTotal') return dir * ((a.grandTotal || a.grand_total || 0) - (b.grandTotal || b.grand_total || 0));
      return 0;
    });
  }, [allSettledOrders, orderSearch, orderTypeFilter, orderPayFilter, orderSort]);

  const totalSearchedPages = Math.ceil(searchedOrders.length / ORDER_PAGE_SIZE);
  const pagedOrders = searchedOrders.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE);

  useEffect(() => { setOrderPage(1); }, [orderSearch, orderTypeFilter, orderPayFilter, orderSort]);

  useEffect(() => {
    apiService.fetchAnalyticsConfig().then(d=>{ setCloseHour(d.closeHour||0); setLocalCloseHour(d.closeHour||0); }).catch(()=>{});
  }, []);

  useEffect(() => { loadExpenses(); }, [range, custom]);

  useEffect(() => {
    if (tab === 'crm') loadCRM();
    if (tab === 'audit') loadAudit();
  }, [tab]);

  const loadCRM = async () => {
    try {
      const res = await apiService.fetchCustomers();
      if (res.success) setCrmData(res.customers || []);
    } catch (err) { console.warn("Failed to load CRM:", err); }
  };

  const loadAudit = async () => {
    try {
      const res = await apiService.fetchAuditLogs();
      if (res.success) setAuditData(res.logs || []);
    } catch (err) { console.warn("Failed to load audit logs:", err); }
  };

  const loadExpenses = async () => {
    setLoading(true);
    const s = rangeStart.toISOString().split('T')[0];
    const e = rangeEnd.toISOString().split('T')[0];
    try {
      const res = await apiService.fetchExpenses(s, e);
      if (res.success) setExpenses(res.expenses || []);
    } catch(err) { console.warn('Expenses fetch failed:', err); }
    setLoading(false);
  };

  const handleRefresh = async () => {
    if (!loadHistory) return;
    setRefreshing(true);
    try {
      await loadHistory();
    } catch(e) {}
    setRefreshing(false);
  };

  const saveCloseHour = async () => {
    try {
      await apiService.updateAnalyticsConfig({ closeHour: localCloseHour });
      setCloseHour(localCloseHour);
      setShowSettings(false);
    } catch(err) { console.error('Failed to update config:', err); }
  };

  const addExpense = async () => {
    if(!newExp.amount || isNaN(newExp.amount)) return;
    try {
      await apiService.addExpense({ amount: Number(newExp.amount), category: newExp.category, note: newExp.note, expense_date: newExp.date });
      setNewExp({ amount:'', category:'Staff', note:'', date: new Date().toISOString().split('T')[0] });
      loadExpenses();
    } catch(err) { console.error('Failed to add expense:', err); }
  };

  const delExpense = async (id) => {
    try {
      await apiService.deleteExpense(id);
      loadExpenses();
    } catch(err) { console.error('Failed to delete expense:', err); }
  };

  const expenseTotal = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const netProfit = totalRevenue - expenseTotal;

  const peakHour = hourlyBuckets.reduce((best,h)=>h.revenue>best.revenue?h:best, { key:'--', revenue:0 });
  const topProducts = products.slice(0,5);
  const slowProducts = [...products].sort((a,b)=>a.qty-b.qty).slice(0,5);
  const filteredProducts = products.filter(p=>p.name.toLowerCase().includes(productQ.toLowerCase())||(p.category||'').toLowerCase().includes(productQ.toLowerCase()));

  const insights = [];
  if(changes.revenue < -10) insights.push({ type:'warn', text:`Revenue is down ${Math.abs(changes.revenue)}% vs previous period` });
  if(changes.revenue > 15) insights.push({ type:'good', text:`Revenue up ${changes.revenue}% vs previous period 🔥` });
  if(changes.orders < -10) insights.push({ type:'warn', text:`Order count dropped ${Math.abs(changes.orders)}%` });
  if(peakHour.revenue > 0) insights.push({ type:'info', text:`Peak hour: ${peakHour.key} with ₹${Math.round(peakHour.revenue)} revenue` });
  products.filter(p=>p.change!=null&&p.change<-20).slice(0,2).forEach(p=>insights.push({ type:'warn', text:`${p.name} sales down ${Math.abs(p.change)}% vs last period` }));
  const growing = products.find(p=>p.change!=null&&p.change>30);
  if(growing) insights.push({ type:'good', text:`${growing.name} is growing fast (+${growing.change}%)` });

  const exportData = () => {
    const rows = filteredProducts.map(p=>({ Item:p.name, Category:p.category, 'Units Sold':p.qty, 'Revenue (₹)': Math.round(p.revenue), 'vs Last Period': p.change!=null?`${p.change}%`:'N/A' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const sumRows = [
      { Metric:'Revenue', Value: Math.round(totalRevenue) },
      { Metric:'Net Sales', Value: Math.round(netSales) },
      { Metric:'GST Collected', Value: Math.round(totalGst) },
      { Metric:'Service Charge', Value: Math.round(totalSC) },
      { Metric:'Orders', Value: totalOrders },
      { Metric:'Staff Tips', Value: Math.round(totalTips) },
      { Metric:'AOV', Value: Math.round(avgOrderValue) },
      { Metric:'Items Sold', Value: totalItems }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), 'Summary');

    // Export all settled orders
    const orderRows = allSettledOrders.map(o => ({
      'Date/Time': o.timestamp ? new Date(o.timestamp).toLocaleString('en-IN') : '',
      'Order ID': o.id,
      'Table / Type': o.table_number || o.tableNumber || o.type || '',
      'Customer': o.customerName || o.customer_name || '',
      'Phone': o.phone || '',
      'Items': (o.cart || o.orders || o.items || []).map(i => `${i.name}×${i.qty||i.quantity||1}`).join(', '),
      'Payment': o.paymentMethod || o.payment_method || '',
      'Grand Total (₹)': o.grandTotal || o.grand_total || 0,
      'GST': o.gstAmount || o.gst_amount || 0,
      'Service Charge': o.serviceCharge || o.service_charge || 0,
      'Tip': o.tipAmount || o.tip_amount || 0,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), 'All Orders');

    XLSX.writeFile(wb, `Analytics_${range.replace(/ /g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getOrderTypeBadge = (o) => {
    const id = String(o.id || '').toUpperCase();
    const tableNum = String(o.table_number || o.tableNumber || '').toUpperCase();
    const type = o.type || o.orderType || '';
    if (type === 'Delivery' || id.startsWith('DL-') || id.startsWith('DEL-') || tableNum.startsWith('DL-') || tableNum.startsWith('DEL-')) return { label: 'Delivery', color: '#2563eb', bg: '#eff6ff' };
    if (type === 'Takeaway' || id.startsWith('TA-') || id.startsWith('TAK-') || tableNum.startsWith('TA-') || tableNum.startsWith('TAK-')) return { label: 'Takeaway', color: '#8b5cf6', bg: '#f5f3ff' };
    return { label: 'Dine In', color: '#94161c', bg: '#fff1f2' };
  };

  const sortIcon = (field) => {
    if (orderSort.field !== field) return null;
    return orderSort.dir === 'asc' ? <ChevronUp size={13}/> : <ChevronDown size={13}/>;
  };
  const toggleSort = (field) => {
    setOrderSort(prev => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'desc' });
  };

  const TABS = [
    {id:'overview', label:'Overview', icon:BarChart3},
    {id:'orders', label:'Orders', icon:FileText},
    {id:'sales', label:'Sales', icon:TrendingUp},
    {id:'products', label:'Products', icon:Package},
    {id:'payments', label:'Payments', icon:CreditCard},
    {id:'expenses', label:'Expenses', icon:DollarSign},
    {id:'crm', label:'CRM', icon:Users},
    {id:'audit', label:'Audit', icon:ShieldAlert},
    {id:'staff', label:'Staff', icon:Users},
  ];

  return (
    <div style={{ flex:1, overflowY:'auto', background:'#f8fafc', paddingBottom:60 }} className="no-scrollbar">

      {/* HEADER */}
      <div style={{ background:'rgba(255,255,255,0.95)', backdropFilter:'blur(20px)', padding:'20px 28px', borderBottom:'1px solid #e2e8f0', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, color:'#94161c', fontWeight:900, textTransform:'uppercase', letterSpacing:2 }}>Business Intelligence</div>
            <h1 style={{ fontSize:24, fontWeight:950, color:'#111827', letterSpacing:-0.5, margin:0 }}>Analytics Dashboard</h1>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setShowSettings(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:12, border:'1px solid #e2e8f0', background:'white', color:'#64748b', fontSize:13, fontWeight:700, cursor:'pointer' }}><Settings size={15}/>Day Close: {closeHour===0?'12 AM':`${closeHour} AM`}</button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:12, border:'1px solid #e2e8f0', background: refreshing ? '#f1f5f9' : 'white', color: refreshing ? '#94a3b8' : '#64748b', fontSize:13, fontWeight:700, cursor: refreshing ? 'default' : 'pointer', transition:'all 0.2s' }}
              title="Refresh data from server"
            >
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button onClick={()=>window.print()} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:12, border:'1px solid #e2e8f0', background:'white', color:'#64748b', fontSize:13, fontWeight:700, cursor:'pointer' }}><Printer size={15}/>Print</button>
            <button onClick={exportData} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:12, border:'none', background:'#10b981', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}><Download size={15}/>Export</button>
          </div>
        </div>

        {/* Range Selector */}
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:4, padding:4, background:'#f1f5f9', borderRadius:14 }}>
            {RANGES.map(r=>(
              <button key={r} onClick={()=>setRange(r)} style={{ padding:'7px 14px', borderRadius:10, fontSize:12, fontWeight:900, border:'none', cursor:'pointer', background: range===r?'white':'transparent', color: range===r?'#111827':'#64748b', boxShadow: range===r?'0 2px 8px rgba(0,0,0,0.08)':'none', transition:'all 0.2s' }}>{r}</button>
            ))}
          </div>
          {range==='Custom' && (
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'white', padding:'6px 12px', borderRadius:12, border:'1px solid #e2e8f0' }}>
              <Calendar size={14} color="#94a3b8"/>
              <input type="date" value={custom.start} onChange={e=>setCustom(p=>({...p,start:e.target.value}))} style={{ border:'none', fontSize:13, fontWeight:800, outline:'none', color:'#1e293b' }}/>
              <span style={{ color:'#cbd5e1' }}>→</span>
              <input type="date" value={custom.end} onChange={e=>setCustom(p=>({...p,end:e.target.value}))} style={{ border:'none', fontSize:13, fontWeight:800, outline:'none', color:'#1e293b' }}/>
            </div>
          )}
          {loading && <div style={{ fontSize:12, color:'#94a3b8', fontWeight:700 }}>⟳ Loading...</div>}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:24, borderBottom:'1px solid #e2e8f0', marginTop:16, overflowX:'auto' }}>
          {TABS.map(t=>(
            <TabBtn key={t.id} label={t.label} icon={t.icon} active={tab===t.id} onClick={()=>setTab(t.id)}/>
          ))}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'white', borderRadius:24, padding:32, width:360, boxShadow:'0 25px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:18, fontWeight:950, color:'#111827', marginBottom:8 }}>Business Day Close Time</div>
            <div style={{ fontSize:13, color:'#64748b', marginBottom:20, lineHeight:1.6 }}>Orders before this hour are counted in the <strong>previous day's</strong> sales. Use for cafes open past midnight.</div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:800, color:'#334155', display:'block', marginBottom:8 }}>Day closes at:</label>
              <select value={localCloseHour} onChange={e=>setLocalCloseHour(Number(e.target.value))} style={{ width:'100%', padding:10, borderRadius:10, border:'1px solid #cbd5e1', fontSize:15, fontWeight:700 }}>
                {[0,1,2,3,4,5,6].map(h=><option key={h} value={h}>{h===0?'12:00 AM (Midnight — Standard)':`${h}:00 AM`}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setShowSettings(false)} style={{ flex:1, padding:12, borderRadius:12, border:'1px solid #e2e8f0', background:'white', fontWeight:700, cursor:'pointer', color:'#64748b' }}>Cancel</button>
              <button onClick={saveCloseHour} style={{ flex:1, padding:12, borderRadius:12, border:'none', background:'#94161c', color:'white', fontWeight:800, cursor:'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding:'28px', display:'flex', flexDirection:'column', gap:24 }}>

        {/* KPI CARDS — shown on all tabs except orders */}
        {tab !== 'orders' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
              <KPICard label="Total Revenue" value={formatCurrency(totalRevenue||0)} icon={TrendingUp} color="#94161c" sub={`${totalOrders||0} orders`} trend={changes.revenue}/>
              <KPICard label="Net Sales (Base)" value={formatCurrency(netSales||0)} icon={DollarSign} color="#059669" sub="Excl. GST/SC" trend={changes.netSales}/>
              <KPICard label="Avg Order Value" value={formatCurrency(avgOrderValue||0)} icon={CreditCard} color="#8b5cf6" sub="per bill" trend={changes.aov}/>
              <KPICard label="Items Sold" value={totalItems||0} icon={ShoppingBag} color="#2563eb" sub={`${totalOrders>0?(totalItems/totalOrders).toFixed(1):0} per order`} trend={changes.items}/>
              <KPICard label="Total Orders" value={totalOrders||0} icon={Clock} color="#10b981" sub="completed" trend={changes.orders}/>
            </div>

            {/* SOURCE BREAKDOWN ROW */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ background:'white', padding:20, borderRadius:16, border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:12, color:'#64748b', fontWeight:800 }}>DINE-IN REVENUE</div>
                  <div style={{ fontSize:22, fontWeight:950, color:'#111827' }}>{formatCurrency(sourceBreakdown['Dine In'])}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700 }}>{sourceCounts['Dine In']} orders</div>
                </div>
                <div style={{ padding:10, borderRadius:12, background:'#fef2f2' }}><ShoppingBag size={20} color="#94161c"/></div>
              </div>
              <div style={{ background:'white', padding:20, borderRadius:16, border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:12, color:'#64748b', fontWeight:800 }}>PICKUP / TAKEAWAY</div>
                  <div style={{ fontSize:22, fontWeight:950, color:'#111827' }}>{formatCurrency(sourceBreakdown['Pickup'])}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700 }}>{sourceCounts['Pickup']} orders</div>
                </div>
                <div style={{ padding:10, borderRadius:12, background:'#eff6ff' }}><Package size={20} color="#2563eb"/></div>
              </div>
            </div>

            {/* GST + SC row */}
            {((totalGst||0)>0||(totalSC||0)>0) && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div style={{ background:'white', padding:20, borderRadius:16, border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div><div style={{ fontSize:12, color:'#64748b', fontWeight:800 }}>GST COLLECTED</div><div style={{ fontSize:22, fontWeight:950, color:'#111827' }}>{formatCurrency(totalGst||0)}</div></div>
                  <div style={{ padding:10, borderRadius:12, background:'#fef3c720' }}><Layers size={20} color="#f59e0b"/></div>
                </div>
                <div style={{ background:'white', padding:20, borderRadius:16, border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div><div style={{ fontSize:12, color:'#64748b', fontWeight:800 }}>SERVICE CHARGE</div><div style={{ fontSize:22, fontWeight:950, color:'#111827' }}>{formatCurrency(totalSC||0)}</div></div>
                  <div style={{ padding:10, borderRadius:12, background:'#ecfdf520' }}><DollarSign size={20} color="#10b981"/></div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════ ORDERS SEARCH TAB ══════════════ */}
        {tab === 'orders' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Search header */}
            <div style={{ background:'white', padding:'20px 24px', borderRadius:20, border:'1px solid #e2e8f0' }}>
              <div style={{ fontSize:17, fontWeight:950, color:'#111827', marginBottom:4 }}>Order Explorer</div>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:700, marginBottom:16 }}>
                Search across all {allSettledOrders.length} settled orders — by customer, item, phone, payment method, or amount
              </div>

              {/* Search bar */}
              <div style={{ position:'relative', marginBottom:14 }}>
                <Search size={16} color="#94a3b8" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)' }}/>
                <input
                  placeholder="Search by customer name, item, phone, payment method, amount, order ID…"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  style={{ width:'100%', padding:'11px 14px 11px 42px', borderRadius:12, border:'1.5px solid #e2e8f0', fontSize:14, fontWeight:600, outline:'none', boxSizing:'border-box', transition:'border 0.2s' }}
                  onFocus={e=>e.target.style.borderColor='#94161c'}
                  onBlur={e=>e.target.style.borderColor='#e2e8f0'}
                />
                {orderSearch && (
                  <button onClick={()=>setOrderSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', border:'none', background:'none', cursor:'pointer', color:'#94a3b8' }}>
                    <X size={15}/>
                  </button>
                )}
              </div>

              {/* Filter chips */}
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:800, color:'#64748b', display:'flex', alignItems:'center', gap:4 }}><Filter size={13}/> Type:</span>
                {orderTypeFilters.map(f => (
                  <button key={f} onClick={()=>setOrderTypeFilter(f)} style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:800, border:`1.5px solid ${orderTypeFilter===f?'#94161c':'#e2e8f0'}`, background: orderTypeFilter===f?'#94161c':'white', color: orderTypeFilter===f?'white':'#475569', cursor:'pointer', transition:'all 0.15s' }}>{f}</button>
                ))}
                <span style={{ fontSize:12, fontWeight:800, color:'#64748b', marginLeft:8, display:'flex', alignItems:'center', gap:4 }}><CreditCard size={13}/> Payment:</span>
                {orderPayFilters.map(f => (
                  <button key={f} onClick={()=>setOrderPayFilter(f)} style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:800, border:`1.5px solid ${orderPayFilter===f?'#2563eb':'#e2e8f0'}`, background: orderPayFilter===f?'#2563eb':'white', color: orderPayFilter===f?'white':'#475569', cursor:'pointer', transition:'all 0.15s' }}>{f}</button>
                ))}
              </div>
            </div>

            {/* Results summary bar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 4px' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#64748b' }}>
                {searchedOrders.length === 0 ? 'No orders found' : `Showing ${searchedOrders.length} order${searchedOrders.length !== 1 ? 's' : ''}`}
                {orderSearch && <span style={{ color:'#94161c' }}> matching "{orderSearch}"</span>}
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'#94161c' }}>
                Total: {formatCurrency(searchedOrders.reduce((s,o) => s + (o.grandTotal || o.grand_total || 0), 0))}
              </div>
            </div>

            {/* Orders table */}
            <div style={{ background:'white', borderRadius:20, border:'1px solid #e2e8f0', overflow:'hidden' }}>
              {/* Table header */}
              <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.8fr 1.4fr 0.9fr 0.9fr 0.8fr 1fr', padding:'12px 20px', background:'#f8fafc', borderBottom:'2px solid #e2e8f0', gap:8 }}>
                {[
                  { label:'Date / Time', field:'timestamp' },
                  { label:'Order ID', field:null },
                  { label:'Customer', field:null },
                  { label:'Type', field:null },
                  { label:'Payment', field:null },
                  { label:'Items', field:null },
                  { label:'Amount', field:'grandTotal' },
                ].map((col, i) => (
                  <div
                    key={i}
                    onClick={col.field ? () => toggleSort(col.field) : undefined}
                    style={{ fontSize:11, fontWeight:900, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', display:'flex', alignItems:'center', gap:4, cursor: col.field ? 'pointer' : 'default', userSelect:'none' }}
                  >
                    {col.label}{col.field && sortIcon(col.field)}
                  </div>
                ))}
              </div>

              {/* Table rows */}
              <div style={{ maxHeight:520, overflowY:'auto' }}>
                {pagedOrders.length === 0 && (
                  <div style={{ textAlign:'center', padding:'48px 24px', color:'#94a3b8' }}>
                    <Search size={32} style={{ marginBottom:12, opacity:0.4 }}/>
                    <div style={{ fontSize:15, fontWeight:700 }}>No orders found</div>
                    <div style={{ fontSize:13, marginTop:4 }}>Try different search terms or filters</div>
                  </div>
                )}
                {pagedOrders.map((o, i) => {
                  const badge = getOrderTypeBadge(o);
                  const cartItems = o.cart || o.orders || o.items || [];
                  const itemSummary = cartItems.slice(0, 2).map(it => `${it.name}×${it.qty||it.quantity||1}`).join(', ') + (cartItems.length > 2 ? ` +${cartItems.length - 2}` : '');
                  const pm = o.paymentMethod || o.payment_method || 'Cash';
                  const pmColor = pm === 'Cash' ? '#10b981' : pm === 'UPI' ? '#8b5cf6' : pm === 'Card' ? '#2563eb' : '#f59e0b';
                  return (
                    <div
                      key={i}
                      style={{ display:'grid', gridTemplateColumns:'1.4fr 0.8fr 1.4fr 0.9fr 0.9fr 0.8fr 1fr', padding:'13px 20px', borderBottom:'1px solid #f1f5f9', gap:8, alignItems:'center', transition:'background 0.15s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                      onMouseLeave={e=>e.currentTarget.style.background='white'}
                    >
                      <div style={{ fontSize:12, color:'#64748b', fontWeight:700 }}>
                        {o.timestamp ? new Date(o.timestamp).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true }) : '—'}
                      </div>
                      <div style={{ fontSize:12, fontWeight:800, color:'#334155', fontFamily:'monospace' }}>
                        #{String(o.id || '').slice(0, 10)}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#111827' }}>{o.customerName || o.customer_name || 'Walk-In'}</div>
                        {(o.phone) && <div style={{ fontSize:11, color:'#94a3b8' }}>{o.phone}</div>}
                      </div>
                      <div>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800, background:badge.bg, color:badge.color }}>
                          {badge.label}
                        </span>
                      </div>
                      <div>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:800, background:`${pmColor}15`, color:pmColor }}>
                          {pm}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:'#64748b', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={cartItems.map(it => `${it.name}×${it.qty||it.quantity||1}`).join(', ')}>
                        {itemSummary || '—'}
                      </div>
                      <div style={{ fontSize:15, fontWeight:950, color:'#111827' }}>
                        {formatCurrency(o.grandTotal || o.grand_total || 0)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalSearchedPages > 1 && (
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, padding:'16px', borderTop:'1px solid #f1f5f9' }}>
                  <button onClick={()=>setOrderPage(p=>Math.max(1,p-1))} disabled={orderPage===1} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'white', fontWeight:700, cursor: orderPage===1 ? 'default' : 'pointer', color: orderPage===1 ? '#cbd5e1' : '#334155' }}>← Prev</button>
                  <span style={{ fontSize:13, fontWeight:700, color:'#64748b' }}>Page {orderPage} of {totalSearchedPages}</span>
                  <button onClick={()=>setOrderPage(p=>Math.min(totalSearchedPages,p+1))} disabled={orderPage===totalSearchedPages} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'white', fontWeight:700, cursor: orderPage===totalSearchedPages ? 'default' : 'pointer', color: orderPage===totalSearchedPages ? '#cbd5e1' : '#334155' }}>Next →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {tab==='overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Insight Cards */}
            {insights.length>0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
                {insights.map((ins,i)=>(
                  <div key={i} style={{ padding:'14px 18px', borderRadius:14, background: ins.type==='good'?'#f0fdf4':ins.type==='warn'?'#fffbeb':'#eff6ff', border:`1px solid ${ins.type==='good'?'#bbf7d0':ins.type==='warn'?'#fde68a':'#bfdbfe'}`, display:'flex', alignItems:'center', gap:12 }}>
                    {ins.type==='good'?<CheckCircle size={18} color="#10b981"/>:ins.type==='warn'?<AlertTriangle size={18} color="#f59e0b"/>:<Zap size={18} color="#2563eb"/>}
                    <span style={{ fontSize:13, fontWeight:700, color:'#1e293b', lineHeight:1.4 }}>{ins.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Revenue Chart */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
              <SectionCard title="Revenue Trend" subtitle="Daily sales over selected period">
                <div style={{ height:300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#94161c" stopOpacity={0.15}/><stop offset="95%" stopColor="#94161c" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:'#94a3b8', fontWeight:700 }}/>
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize:11, fill:'#94a3b8', fontWeight:700 }} tickFormatter={v=>`₹${v>=1000?`${(v/1000).toFixed(1)}k`:v}`}/>
                      <RechartsTooltip formatter={v=>[formatCurrency(v),'Revenue']} labelStyle={{ fontWeight:700 }}/>
                      <Area type="monotone" dataKey="revenue" stroke="#94161c" strokeWidth={3} fill="url(#revGrad)" dot={{ r:3, fill:'#94161c' }}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Top Items" subtitle="By revenue">
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {topProducts.length===0 && <div style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:'20px 0' }}>No data for this period</div>}
                  {topProducts.map((p,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:`${PALETTE[i%8]}15`, display:'grid', placeItems:'center', fontSize:12, fontWeight:900, color:PALETTE[i%8] }}>{i+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{p.qty} units</div>
                      </div>
                      <div style={{ fontSize:13, fontWeight:950, color:'#111827' }}>{formatCurrency(p.revenue)}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* Staff Incentives / Tips Section (Quick View) */}
        {tab === 'overview' && totalTips > 0 && (
          <div style={{ background: '#fff7ed', padding: '24px', borderRadius: '24px', border: '1px solid #ffedd5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: '#f59e0b15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={26} color="#f59e0b" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#9a3412', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Staff Incentives (Tips)</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>{formatCurrency(totalTips)}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', marginBottom: 2 }}>Total tips collected in this period</div>
              <div style={{ fontSize: 11, color: '#c2410c', fontWeight: 800, background: '#ffedd5', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>Excluded from Net Revenue</div>
            </div>
          </div>
        )}

        {tab === 'overview' && (
          <div style={{ marginTop: '20px' }}>
            <SectionCard title="Top Captains" subtitle="By generated revenue">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {topCaptains.length===0 && <div style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:'20px 0' }}>No staff data found</div>}
                {topCaptains.slice(0,5).map((c,i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:`${PALETTE[i%8]}15`, display:'grid', placeItems:'center', fontSize:12, fontWeight:900, color:PALETTE[i%8] }}>{i+1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700 }}>{c.orders} orders</div>
                    </div>
                    <div style={{ fontSize:13, fontWeight:900, color:'#111827' }}>{formatCurrency(c.revenue)}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* STAFF TAB */}
        {tab==='staff' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              <KPICard label="Total Active Staff" value={topCaptains.length} icon={Users} color="#8b5cf6" />
              <KPICard label="Total Staff Sales" value={formatCurrency(topCaptains.reduce((s,c)=>s+c.revenue,0))} icon={TrendingUp} color="#10b981" />
              <KPICard label="Total Tips Collected" value={formatCurrency(totalTips)} icon={Zap} color="#f59e0b" />
            </div>
            
            <SectionCard title="Staff Performance" subtitle="Revenue & order count per captain">
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                      <th style={{ padding:12, textAlign:'left', fontSize:12, fontWeight:800, color:'#64748b' }}>Staff Name</th>
                      <th style={{ padding:12, textAlign:'right', fontSize:12, fontWeight:800, color:'#64748b' }}>Orders Handled</th>
                      <th style={{ padding:12, textAlign:'right', fontSize:12, fontWeight:800, color:'#64748b' }}>Tips Collected</th>
                      <th style={{ padding:12, textAlign:'right', fontSize:12, fontWeight:800, color:'#64748b' }}>Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCaptains.map((c,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:12, fontSize:14, fontWeight:800, color:'#1e293b' }}>{c.name}</td>
                        <td style={{ padding:12, textAlign:'right', fontSize:13, fontWeight:700, color:'#64748b' }}>{c.orders}</td>
                        <td style={{ padding:12, textAlign:'right', fontSize:13, fontWeight:700, color:'#10b981' }}>{formatCurrency(c.tips)}</td>
                        <td style={{ padding:12, textAlign:'right', fontSize:14, fontWeight:900, color:'#94161c' }}>{formatCurrency(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* SALES TAB */}
        {tab==='sales' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <SectionCard title="Hourly Revenue Heatmap" subtitle="Peak hours analysis">
              <div style={{ height:240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyBuckets} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize:10, fill:'#94a3b8', fontWeight:700 }}/>
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize:10, fill:'#94a3b8' }} tickFormatter={v=>`₹${v>=1000?`${(v/1000).toFixed(1)}k`:v}`}/>
                    <RechartsTooltip formatter={v=>[formatCurrency(v),'Revenue']}/>
                    <Bar dataKey="revenue" fill="#94161c" radius={[4,4,0,0]}>
                      {hourlyBuckets.map((h,i)=><Cell key={i} fill={h.key===peakHour.key?'#94161c':'#e2e8f0'}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {peakHour.revenue>0 && (
                <div style={{ marginTop:12, padding:'10px 16px', background:'#fef2f2', borderRadius:10, fontSize:13, color:'#94161c', fontWeight:700 }}>
                  🔥 Peak: {peakHour.key} — {formatCurrency(peakHour.revenue)} revenue, {peakHour.orders} orders
                </div>
              )}
            </SectionCard>

            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
              <SectionCard title="Orders & Revenue by Day" subtitle="Combined bar chart">
                <div style={{ height:280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:'#94a3b8', fontWeight:700 }}/>
                      <YAxis yAxisId="rev" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:'#94a3b8' }} tickFormatter={v=>`₹${v>=1000?`${(v/1000).toFixed(1)}k`:v}`}/>
                      <YAxis yAxisId="ord" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:'#94a3b8' }}/>
                      <RechartsTooltip formatter={(v,n)=>n==='revenue'?[formatCurrency(v),'Revenue']:[v,'Orders']}/>
                      <Bar yAxisId="rev" dataKey="revenue" fill="#94161c" radius={[4,4,0,0]} opacity={0.85}/>
                      <Bar yAxisId="ord" dataKey="orders" fill="#2563eb" radius={[4,4,0,0]} opacity={0.7}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Sales by Source" subtitle="Dine-in vs Pickup">
                <div style={{ height:200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        <Cell fill="#94161c" stroke="none"/>
                        <Cell fill="#2563eb" stroke="none"/>
                      </Pie>
                      <RechartsTooltip formatter={v=>[formatCurrency(v),'Revenue']}/>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
                  {sourceData.map((d,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#f8fafc', borderRadius:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:3, background: i===0?'#94161c':'#2563eb' }}/>
                        <span style={{ fontSize:12, fontWeight:800, color:'#1e293b' }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize:13, fontWeight:950, color:'#111827' }}>{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {tab==='products' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, background:'white', padding:'10px 16px', borderRadius:14, border:'1px solid #e2e8f0' }}>
                <Search size={16} color="#94a3b8"/>
                <input placeholder="Search items or category..." value={productQ} onChange={e=>setProductQ(e.target.value)} style={{ border:'none', outline:'none', fontSize:13, fontWeight:700, width:'100%' }}/>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              <SectionCard title="🔥 Top Performers" subtitle="Highest revenue items">
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {topProducts.map((p,i)=>(
                    <div key={i} style={{ padding:'12px 16px', background:'#f8fafc', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div><div style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>{p.name}</div><div style={{ fontSize:11, color:'#94a3b8' }}>{p.category} · {p.qty} units</div></div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:14, fontWeight:950, color:'#111827' }}>{formatCurrency(p.revenue)}</div>
                        {p.change!=null&&<div style={{ fontSize:11, fontWeight:700, color:p.change>=0?'#10b981':'#ef4444' }}>{p.change>=0?'+':''}{p.change}%</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="💤 Slow Movers" subtitle="Items needing attention">
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {slowProducts.filter(p=>p.qty<5).slice(0,5).map((p,i)=>(
                    <div key={i} style={{ padding:'12px 16px', background:'#fffbeb', borderRadius:12, border:'1px solid #fde68a', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div><div style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>{p.name}</div><div style={{ fontSize:11, color:'#94a3b8' }}>{p.category}</div></div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:14, fontWeight:950, color: p.qty===0?'#ef4444':'#f59e0b' }}>{p.qty} sold</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{p.qty===0?'No sales':'Low volume'}</div>
                      </div>
                    </div>
                  ))}
                  {slowProducts.filter(p=>p.qty<5).length===0&&<div style={{ color:'#94a3b8', textAlign:'center', padding:20 }}>All items performing well!</div>}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="All Products" subtitle={`${filteredProducts.length} items`}>
              <div style={{ display:'grid', gridTemplateColumns:'3fr 1.5fr 1fr 1fr 1fr', padding:'10px 16px', background:'#f8fafc', borderRadius:10, fontSize:11, fontWeight:900, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
                <span>Item</span><span>Category</span><span style={{ textAlign:'center' }}>Units</span><span style={{ textAlign:'center' }}>vs Last</span><span style={{ textAlign:'right' }}>Revenue</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:500, overflowY:'auto' }}>
                {filteredProducts.map((p,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 1.5fr 1fr 1fr 1fr', padding:'12px 16px', borderRadius:10, background:'white', border:'1px solid #f1f5f9', alignItems:'center', transition:'all 0.15s' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='#fecaca';e.currentTarget.style.background='#fffcfc';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#f1f5f9';e.currentTarget.style.background='white';}}>
                    <span style={{ fontWeight:800, color:'#1e293b', fontSize:13 }}>{p.name}</span>
                    <span style={{ fontSize:12, color:'#64748b', fontWeight:700 }}>{p.category}</span>
                    <span style={{ textAlign:'center', fontWeight:950, color: p.qty===0?'#ef4444':'#2563eb', fontSize:13 }}>{p.qty}</span>
                    <span style={{ textAlign:'center', fontSize:12, fontWeight:700, color: p.change==null?'#94a3b8':p.change>=0?'#10b981':'#ef4444' }}>{p.change!=null?(p.change>=0?'+':'')+p.change+'%':'—'}</span>
                    <span style={{ textAlign:'right', fontWeight:950, color:'#111827', fontSize:13 }}>{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab==='payments' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <SectionCard title="Payment Distribution" subtitle="By method">
              <div style={{ height:260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={payData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} dataKey="value">
                      {payData.map((e,i)=><Cell key={i} fill={PALETTE[i%8]} stroke="none"/>)}
                    </Pie>
                    <RechartsTooltip formatter={v=>[formatCurrency(v),'Amount']}/>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
                {payData.map((d,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#f8fafc', borderRadius:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:12, height:12, borderRadius:4, background:PALETTE[i%8] }}/>
                      <span style={{ fontSize:14, fontWeight:800, color:'#1e293b' }}>{d.name}</span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:14, fontWeight:950, color:'#111827' }}>{formatCurrency(d.value)}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{totalRevenue>0?((d.value/totalRevenue)*100).toFixed(1):0}%</div>
                    </div>
                  </div>
                ))}
                {payData.length===0&&<div style={{ color:'#94a3b8', textAlign:'center', padding:20, fontSize:13 }}>No payment data for this period</div>}
              </div>
            </SectionCard>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <SectionCard title="Revenue Summary">
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[{ label:'Total Revenue', val: totalRevenue||0, color:'#94161c' },{ label:'GST Collected', val: totalGst||0, color:'#f59e0b' },{ label:'Service Charge', val: totalSC||0, color:'#10b981' }].map((row,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', background:`${row.color}08`, borderRadius:12, border:`1px solid ${row.color}20` }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>{row.label}</span>
                      <span style={{ fontSize:15, fontWeight:950, color:row.color }}>{formatCurrency(row.val)}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', background:'#fff7ed', borderRadius:12, border:'1px solid #ffedd5', marginTop:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Zap size={14} color="#f59e0b"/>
                      <span style={{ fontSize:13, fontWeight:700, color:'#9a3412' }}>Staff Tips Collected</span>
                    </div>
                    <span style={{ fontSize:15, fontWeight:950, color:'#f59e0b' }}>{formatCurrency(totalTips||0)}</span>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="Day-end Cash Count">
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {['Cash','UPI','Card'].map(m=>{
                    const amt = payBreakdown[m]||0;
                    return (
                      <div key={m} style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', background:'#f8fafc', borderRadius:10 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:'#334155' }}>{m}</span>
                        <span style={{ fontSize:14, fontWeight:950, color: amt>0?'#111827':'#94a3b8' }}>{formatCurrency(amt)}</span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* EXPENSES TAB */}
        {tab==='expenses' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {/* Net Profit Banner */}
            <div style={{ padding:'24px 28px', background: netProfit>=0?'linear-gradient(135deg,#065f46,#047857)':'linear-gradient(135deg,#991b1b,#b91c1c)', borderRadius:20, color:'white', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:12, fontWeight:800, opacity:0.8, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Net Profit (Revenue − Expenses)</div>
                <div style={{ fontSize:36, fontWeight:950, letterSpacing:-1 }}>{formatCurrency(netProfit)}</div>
              </div>
              <div style={{ textAlign:'right', opacity:0.85 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>Revenue: {formatCurrency(totalRevenue||0)}</div>
                <div style={{ fontSize:13, fontWeight:700 }}>Expenses: {formatCurrency(expenseTotal)}</div>
              </div>
            </div>

            {/* Add Expense */}
            <SectionCard title="Log Expense">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr 1.5fr auto', gap:10, alignItems:'flex-end' }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:800, color:'#64748b', display:'block', marginBottom:6 }}>AMOUNT (₹)</label>
                  <input type="number" placeholder="0.00" value={newExp.amount} onChange={e=>setNewExp(p=>({...p,amount:e.target.value}))} style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #cbd5e1', fontSize:14, fontWeight:800, outline:'none' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:800, color:'#64748b', display:'block', marginBottom:6 }}>CATEGORY</label>
                  <select value={newExp.category} onChange={e=>setNewExp(p=>({...p,category:e.target.value}))} style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #cbd5e1', fontSize:13, fontWeight:700, outline:'none' }}>
                    {['Staff','Supplies','Utilities','Rent','Other'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:800, color:'#64748b', display:'block', marginBottom:6 }}>NOTE</label>
                  <input placeholder="Description..." value={newExp.note} onChange={e=>setNewExp(p=>({...p,note:e.target.value}))} style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #cbd5e1', fontSize:13, outline:'none' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:800, color:'#64748b', display:'block', marginBottom:6 }}>DATE</label>
                  <input type="date" value={newExp.date} onChange={e=>setNewExp(p=>({...p,date:e.target.value}))} style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #cbd5e1', fontSize:13, fontWeight:700, outline:'none' }}/>
                </div>
                <button onClick={addExpense} style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 18px', borderRadius:10, border:'none', background:'#94161c', color:'white', fontSize:13, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}><Plus size={16}/>Add</button>
              </div>
            </SectionCard>

            {/* Expense List */}
            <SectionCard title="Expense Log" subtitle={`Total: ${formatCurrency(expenseTotal)}`}>
              {expenses.length===0 && <div style={{ color:'#94a3b8', textAlign:'center', padding:32, fontSize:13 }}>No expenses logged for this period</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {expenses.map((e,i)=>(
                  <div key={e.id||i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'#f8fafc', borderRadius:12, border:'1px solid #f1f5f9' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ padding:'4px 10px', borderRadius:8, background:'#e2e8f0', fontSize:11, fontWeight:800, color:'#475569' }}>{e.category}</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#1e293b' }}>{e.note||'—'}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{e.expense_date}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ fontSize:15, fontWeight:950, color:'#ef4444' }}>−{formatCurrency(e.amount)}</div>
                      <button onClick={()=>delExpense(e.id)} style={{ padding:'4px 8px', borderRadius:8, border:'none', background:'#fee2e2', color:'#ef4444', cursor:'pointer' }}><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* CRM TAB */}
        {/* CRM TAB */}
        {tab === 'crm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionCard 
              title="Customer Database & CRM" 
              subtitle="Track customer visit history, lifetime spend, and loyalty points"
              action={
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  style={{
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={16} /> Add Customer
                </button>
              }
            >
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 13 }} />
                <input 
                  type="text" 
                  placeholder="Search by name, phone number, or visit history..." 
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', fontWeight: '600' }}
                />
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800 }}>Customer</th>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800 }}>Phone</th>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800 }}>Visits</th>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800 }}>Total Spent</th>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800 }}>Loyalty Pts</th>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800 }}>Last Visit</th>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmData.filter(c => (c.phone || '').includes(crmSearch) || (c.name || '').toLowerCase().includes(crmSearch.toLowerCase())).map((c, i) => {
                      const visits = c.visits || 1;
                      const tier = visits >= 5 ? 'VIP' : visits >= 2 ? 'Regular' : 'New';
                      const tierBg = tier === 'VIP' ? '#fef3c7' : tier === 'Regular' ? '#e0e7ff' : '#f1f5f9';
                      const tierColor = tier === 'VIP' ? '#d97706' : tier === 'Regular' ? '#4338ca' : '#64748b';

                      return (
                        <tr 
                          key={i} 
                          style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s ease' }}
                          onClick={async () => {
                            setSelectedCustomerProfile(c);
                            setCustomerOrdersHistory([]);
                            // Fetch from server database for complete history
                            try {
                              const res = await apiService.fetchCustomerHistory(c.phone);
                              if (res?.success && res.orders?.length > 0) {
                                setCustomerOrdersHistory(res.orders);
                                // Also update profile from server (more accurate)
                                if (res.customer) setSelectedCustomerProfile(res.customer);
                                return;
                              }
                            } catch (err) { console.warn('Server history fetch failed, using local:', err); }
                            // Fallback: filter from local orderHistory
                            const phoneStr = String(c.phone || '').trim();
                            const nameStr = String(c.name || '').toLowerCase().trim();
                            const history = (orderHistory || []).filter(o => {
                              const oPhone = String(o.phone || o.customerPhone || '').trim();
                              const oName = String(o.customerName || o.customer_name || '').toLowerCase().trim();
                              return (phoneStr && oPhone === phoneStr) || (nameStr && oName && oName === nameStr);
                            });
                            setCustomerOrdersHistory(history);
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '14px 16px', fontWeight: 800, color: '#1e293b' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: 'var(--primary)', fontSize: '13px' }}>
                                {(c.name || 'G')[0].toUpperCase()}
                              </div>
                              <div>
                                <div>{c.name || 'Guest'}</div>
                                <span style={{ background: tierBg, color: tierColor, fontSize: '11px', fontWeight: '800', padding: '1px 6px', borderRadius: '8px' }}>
                                  {tier}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: '700', color: '#475569' }}>{c.phone}</td>
                          <td style={{ padding: '14px 16px', fontWeight: '700' }}>{c.visits || 1} {c.visits === 1 ? 'visit' : 'visits'}</td>
                          <td style={{ padding: '14px 16px', fontWeight: '900', color: '#10b981', fontSize: '14px' }}>{formatCurrency(c.total_spent || 0)}</td>
                          <td style={{ padding: '14px 16px', fontWeight: '800', color: '#8b5cf6' }}>✨ {c.loyalty_points || 0} pts</td>
                          <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                            {c.last_visit ? new Date(c.last_visit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer', color: '#334155' }}
                            >
                              View History
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {crmData.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '14px' }}>
                          No customer records found yet. Customers will automatically appear here as orders are placed with phone numbers!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* CUSTOMER PROFILE MODAL */}
        {selectedCustomerProfile && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="animate-fade-in" style={{ background: 'white', borderRadius: '16px', width: '650px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              
              {/* Profile Header */}
              <div style={{ background: 'var(--primary)', color: 'white', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '900' }}>
                    {(selectedCustomerProfile.name || 'G')[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>{selectedCustomerProfile.name || 'Guest'}</h3>
                    <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>📱 {selectedCustomerProfile.phone}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomerProfile(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '12px' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Stats Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ background: 'white', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Visits</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', marginTop: '2px' }}>{selectedCustomerProfile.visits || 1}</div>
                </div>
                <div style={{ background: 'white', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Total Spent</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#10b981', marginTop: '2px' }}>{formatCurrency(selectedCustomerProfile.total_spent || 0)}</div>
                </div>
                <div style={{ background: 'white', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Loyalty Pts</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#8b5cf6', marginTop: '2px' }}>✨ {selectedCustomerProfile.loyalty_points || 0}</div>
                </div>
                <div style={{ background: 'white', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Avg Order</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#0284c7', marginTop: '2px' }}>
                    {formatCurrency(selectedCustomerProfile.visits > 0 ? (selectedCustomerProfile.total_spent / selectedCustomerProfile.visits) : selectedCustomerProfile.total_spent || 0)}
                  </div>
                </div>
              </div>

              {/* Order History Section */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '12px' }}>Past Order History</h4>
                {customerOrdersHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>
                    No settled order history records found for this customer.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {customerOrdersHistory.map((order, idx) => {
                      const items = order.cart || order.orders || order.items || [];
                      return (
                        <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
                            <div>
                              <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>Order #{order.id}</span>
                              <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>
                                {new Date(order.timestamp || order.created_at || Date.now()).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontWeight: '900', color: '#10b981', fontSize: '14px' }}>
                              {formatCurrency(order.grandTotal || order.totalAmount || order.grand_total || 0)}
                            </div>
                          </div>

                          <div style={{ fontSize: '12px', color: '#475569' }}>
                            {(items || []).map((it, iidx) => (
                              <span key={iidx} style={{ display: 'inline-block', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', marginRight: '6px', marginBottom: '4px', fontWeight: '600' }}>
                                {it.qty || it.quantity || 1}x {it.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                <button
                  onClick={() => setSelectedCustomerProfile(null)}
                  style={{ padding: '8px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD NEW CUSTOMER MODAL */}
        {showAddCustomerModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="animate-fade-in" style={{ background: 'white', borderRadius: '16px', width: '420px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Add New Customer to CRM</h3>
                <button onClick={() => setShowAddCustomerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>Phone Number *</label>
                  <input
                    type="text"
                    placeholder="Enter 10-digit mobile number"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    maxLength="10"
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '4px', textTransform: 'uppercase' }}>Customer Name *</label>
                  <input
                    type="text"
                    placeholder="Enter customer full name"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={() => setShowAddCustomerModal(false)}
                    style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', color: '#475569' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!newCustPhone || newCustPhone.length < 10) return alert("Please enter a valid 10-digit mobile number.");
                      if (!newCustName) return alert("Please enter customer name.");
                      try {
                        await apiService.saveCustomer({ phone: newCustPhone, name: newCustName });
                        // Refresh CRM data
                        const res = await apiService.fetchCustomers();
                        if (res.success) setCrmData(res.customers || []);
                        setShowAddCustomerModal(false);
                        setNewCustPhone('');
                        setNewCustName('');
                        alert("Customer saved to CRM successfully!");
                      } catch (err) {
                        alert("Failed to save customer: " + err.message);
                      }
                    }}
                    style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Save Customer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AUDIT LOGS TAB */}
        {tab === 'audit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionCard title="Security & Audit Logs" subtitle="Tracking sensitive actions">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800 }}>Time</th>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800 }}>Action</th>
                      <th style={{ padding: '12px 16px', color: '#64748b', fontWeight: 800 }}>User / Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.map((log, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(log.timestamp || log.created_at).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '4px', fontSize: 11, fontWeight: 800, 
                            background: log.action?.includes('DELETE') ? '#fee2e2' : '#f1f5f9',
                            color: log.action?.includes('DELETE') ? '#ef4444' : '#475569'
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.details}</td>
                      </tr>
                    ))}
                    {auditData.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No audit logs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ReportsHub;
