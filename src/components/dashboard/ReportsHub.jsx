import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, ShoppingBag, CreditCard, Clock, Search, Printer, 
  ChevronDown, ChevronUp, Download, BarChart3, PieChart, 
  ArrowUpRight, ArrowDownRight, Package, Calendar, Filter, X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import * as XLSX from 'xlsx';
import { formatCurrency, getOrderTotal, getChannelLabel } from '../../utils/formatters';

const StatCard = ({ label, value, icon: Icon, color, subtext, trend }) => (
  <div style={{ 
    background: 'white', 
    padding: '24px', 
    borderRadius: '24px', 
    border: '1px solid #e2e8f0', 
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'all 0.3s'
  }}
  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 20px -8px rgba(0,0,0,0.05)'; }}
  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ 
        width: '44px', height: '44px', borderRadius: '12px', 
        background: `${color}10`, display: 'flex', alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Icon size={22} color={color} />
      </div>
      {trend && (
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', 
          fontWeight: '800', color: trend > 0 ? '#10b981' : '#ef4444',
          background: trend > 0 ? '#f0fdf4' : '#fef2f2',
          padding: '4px 8px', borderRadius: '8px'
        }}>
          {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div>
      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: '950', color: '#111827', letterSpacing: '-0.5px' }}>{value}</div>
      {subtext && <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginTop: '4px' }}>{subtext}</div>}
    </div>
  </div>
);

const IconButton = ({ icon: Icon, label, onClick, active, color = '#a3112a' }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '14px',
      border: '1px solid', borderColor: active ? color : '#e2e8f0',
      background: active ? `${color}10` : 'white',
      color: active ? color : '#64748b',
      fontSize: '13px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s'
    }}
  >
    <Icon size={18} />
    {label}
  </button>
);

const ReportsHub = ({ orderHistory, menuItems, tables = [], nonTableOrders = [], products = [] }) => {
  const [rangeType, setRangeType] = useState('This Month');
  const [customRange, setCustomRange] = useState({ 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'products', 'payments'
  const [productQuery, setProductQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'revenue', direction: 'desc' });
  const [showSlowSellers, setShowSlowSellers] = useState(false);

  const getRangeBounds = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date(today);

    switch (rangeType) {
      case 'Today': break;
      case 'Yesterday':
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        break;
      case 'Last 7 Days':
        start.setDate(start.getDate() - 6);
        break;
      case 'Last 30 Days':
        start.setDate(start.getDate() - 29);
        break;
      case 'This Month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'Last Month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'This Quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      case 'Custom':
        start = new Date(customRange.start);
        start.setHours(0, 0, 0, 0);
        end = new Date(customRange.end);
        end.setHours(23, 59, 59, 999);
        break;
      case 'All Time':
        start = new Date(0);
        break;
    }
    return { start, end };
  };

  const { start, end } = getRangeBounds();
  const filteredHistory = orderHistory.filter(order => {
    const timestamp = new Date(order.timestamp);
    return timestamp >= start && timestamp <= end;
  });

  // Basic Metrics
  const totalNetSales = filteredHistory.reduce((acc, order) => acc + (order.grandTotal || 0), 0);
  const totalOrders = filteredHistory.length;
  const avgOrderValue = totalOrders > 0 ? totalNetSales / totalOrders : 0;
  const totalItemsSold = filteredHistory.reduce((acc, order) => acc + (order.cart || order.order || []).reduce((sum, item) => sum + (item.qty || 0), 0), 0);
  
  // Pivot Logic for Products
  const productMap = {};
  // Initialize with all menu items and products to catch those with zero sales
  [...menuItems, ...products].forEach(item => {
    if (!productMap[item.name]) {
      productMap[item.name] = { 
        name: item.name, 
        cat: item.cat || item.category || 'Uncategorized', 
        qty: 0, 
        revenue: 0,
        price: item.price || 0
      };
    }
  });

  filteredHistory.forEach(order => {
    (order.cart || order.order || []).forEach(item => {
      if (!productMap[item.name]) {
        productMap[item.name] = { name: item.name, cat: item.cat || 'Uncategorized', qty: 0, revenue: 0, price: item.price || 0 };
      }
      productMap[item.name].qty += item.qty || 0;
      productMap[item.name].revenue += (item.qty || 0) * (item.price || 0);
    });
  });

  let allProducts = Object.values(productMap);
  
  if (showSlowSellers) {
    // Sort ascending for slow sellers
    allProducts = allProducts.sort((a, b) => a.qty - b.qty);
  } else {
    // Sort based on config
    allProducts.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const filteredProducts = allProducts.filter(p => 
    p.name.toLowerCase().includes(productQuery.toLowerCase()) ||
    p.cat.toLowerCase().includes(productQuery.toLowerCase())
  );

  // Payment Breakdown
  const paymentMethods = ['Cash', 'Card', 'UPI'];
  const paymentData = paymentMethods.map(method => ({
    name: method,
    value: filteredHistory.filter(o => o.paymentMethod === method).reduce((acc, o) => acc + (o.grandTotal || 0), 0)
  })).filter(d => d.value > 0);

  // Growth / Trend Data (Daily)
  const trendData = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateKey = cursor.toISOString().split('T')[0];
    const dayOrders = filteredHistory.filter(o => new Date(o.timestamp).toISOString().split('T')[0] === dateKey);
    trendData.push({
      date: dateKey,
      label: cursor.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      sales: dayOrders.reduce((acc, o) => acc + (o.grandTotal || 0), 0),
      orders: dayOrders.length
    });
    cursor.setDate(cursor.getDate() + 1);
    if (trendData.length > 90) break; // Cap daily trend to 3 months
  }

  const exportReport = () => {
    const data = filteredProducts.map(p => ({
      'Product Name': p.name,
      'Category': p.cat,
      'Quantity Sold': p.qty,
      'Revenue Generated': p.revenue,
      'Status': p.qty === 0 ? 'No Sales' : (p.qty < 5 ? 'Slow Mover' : 'Active')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Product Sales");
    XLSX.writeFile(wb, `TydePOS_Sales_Report_${rangeType.replace(' ', '_')}.xlsx`);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', paddingBottom: '60px' }} className="no-scrollbar">
      {/* HEADER & FILTERS */}
      <div style={{ 
        background: 'rgba(255,255,255,0.9)', 
        backdropFilter: 'blur(20px)', 
        padding: '24px 32px', 
        borderBottom: '1px solid #e2e8f0', 
        position: 'sticky', 
        top: 0, 
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#a3112a', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Reporting Hub</div>
            <h1 style={{ fontSize: '28px', fontWeight: '950', color: '#111827', letterSpacing: '-1px' }}>Intelligence Dashboard</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <IconButton icon={Printer} label="Print" onClick={() => window.print()} />
            <IconButton icon={Download} label="Export Report" onClick={exportReport} color="#10b981" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '4px', background: '#f1f5f9', borderRadius: '16px' }}>
            {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'This Quarter', 'Custom', 'All Time'].map(opt => (
              <button
                key={opt}
                onClick={() => setRangeType(opt)}
                style={{
                  padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '900', border: 'none', cursor: 'pointer',
                  background: rangeType === opt ? 'white' : 'transparent',
                  color: rangeType === opt ? '#111827' : '#64748b',
                  boxShadow: rangeType === opt ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {opt}
              </button>
            ))}
          </div>

          {rangeType === 'Custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <Calendar size={16} color="#94a3b8" />
              <input type="date" value={customRange.start} onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))} style={{ border: 'none', fontSize: '13px', fontWeight: '800', outline: 'none' }} />
              <span style={{ color: '#cbd5e1' }}>→</span>
              <input type="date" value={customRange.end} onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))} style={{ border: 'none', fontSize: '13px', fontWeight: '800', outline: 'none' }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* KPI OVERVIEW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          <StatCard label="Total Revenue" value={formatCurrency(totalNetSales)} icon={TrendingUp} color="#a3112a" subtext={`${totalOrders} completed orders`} trend={12} />
          <StatCard label="Avg Ticket" value={formatCurrency(avgOrderValue)} icon={CreditCard} color="#8b5cf6" subtext="Based on net collection" trend={5} />
          <StatCard label="Total Items" value={totalItemsSold} icon={ShoppingBag} color="#2563eb" subtext={`${totalOrders > 0 ? (totalItemsSold / totalOrders).toFixed(1) : 0} items per bill`} trend={-2} />
          <StatCard label="Total Orders" value={totalOrders} icon={Clock} color="#0f172a" subtext="In the selected period" trend={8} />
        </div>

        {/* TAB NAVIGATION */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '32px' }}>
          {[
            { id: 'overview', label: 'Sales Overview', icon: BarChart3 },
            { id: 'products', label: 'Product Analytics', icon: Package },
            { id: 'payments', label: 'Payment & Channel', icon: PieChart }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 4px', border: 'none', background: 'none', 
                fontSize: '15px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                color: activeTab === tab.id ? '#111827' : '#94a3b8',
              }}
            >
              <tab.icon size={20} />
              {tab.label}
              {activeTab === tab.id && (
                <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: '3px', background: '#a3112a', borderRadius: '99px' }} />
              )}
            </button>
          ))}
        </div>

        {/* CONTENT PANES */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '950', color: '#111827' }}>Revenue Velocity</h3>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '700' }}>Sales trend across the selected timeline</p>
              </div>
              <div style={{ height: '380px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: '800' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: '800' }} />
                    <RechartsTooltip formatter={(v) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="sales" stroke="#a3112a" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '950', color: '#111827', marginBottom: '16px' }}>Top Selling Category</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredProducts.slice(0, 5).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', display: 'grid', placeItems: 'center', fontSize: '14px', fontWeight: '900', color: '#a3112a' }}>{i + 1}</div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>{p.qty} units sold</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '950', color: '#111827' }}>{formatCurrency(p.revenue)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '24px', borderRadius: '24px', color: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <TrendingUp size={18} color="#fbbf24" />
                  <span style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', color: '#94a3b8' }}>Performance Peak</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '950', marginBottom: '4px' }}>Saturday Night</div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>Highest volume recorded between 8:00 PM and 10:30 PM.</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', marginBottom: '32px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '950', color: '#111827' }}>Product Performance Matrix</h3>
                <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '700' }}>Comprehensive sales data for individual items</p>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                  <button onClick={() => setShowSlowSellers(false)} style={{ padding: '8px 16px', borderRadius: '9px', fontSize: '12px', fontWeight: '900', border: 'none', cursor: 'pointer', background: !showSlowSellers ? 'white' : 'transparent', color: !showSlowSellers ? '#111827' : '#94a3b8', boxShadow: !showSlowSellers ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Top Sellers</button>
                  <button onClick={() => setShowSlowSellers(true)} style={{ padding: '8px 16px', borderRadius: '9px', fontSize: '12px', fontWeight: '900', border: 'none', cursor: 'pointer', background: showSlowSellers ? 'white' : 'transparent', color: showSlowSellers ? '#111827' : '#94a3b8', boxShadow: showSlowSellers ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Slow Sellers</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '10px 16px', borderRadius: '14px', border: '1px solid #e2e8f0', minWidth: '280px' }}>
                  <Search size={18} color="#94a3b8" />
                  <input type="text" placeholder="Search product or category..." value={productQuery} onChange={e => setProductQuery(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', width: '100%', fontWeight: '700' }} />
                </div>
              </div>
            </div>

            <div style={{ width: '100%', borderCollapse: 'collapse' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1.5fr 1.5fr', padding: '16px 24px', background: '#f8fafc', borderRadius: '14px', fontSize: '11px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                <span>Item Name</span>
                <span>Category</span>
                <span style={{ textAlign: 'center' }}>Quantity</span>
                <span style={{ textAlign: 'right' }}>Revenue</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredProducts.map((p, i) => (
                  <div key={i} style={{ 
                    display: 'grid', gridTemplateColumns: '3fr 2fr 1.5fr 1.5fr', padding: '18px 24px', borderRadius: '16px', 
                    background: 'white', border: '1px solid #f1f5f9', alignItems: 'center', transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a3112a44'; e.currentTarget.style.background = '#fffcfc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.background = 'white'; }}
                  >
                    <span style={{ fontWeight: '900', color: '#1e293b' }}>{p.name}</span>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '700' }}>{p.cat}</span>
                    <span style={{ textAlign: 'center', fontWeight: '950', color: p.qty === 0 ? '#ef4444' : '#2563eb' }}>{p.qty}</span>
                    <span style={{ textAlign: 'right', fontWeight: '950', color: '#111827' }}>{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '950', color: '#111827', marginBottom: '24px' }}>Payment Distribution</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#a3112a', '#2563eb', '#10b981'][index % 3]} stroke="none" />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(v) => formatCurrency(v)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '20px' }}>
                {paymentData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: ['#a3112a', '#2563eb', '#10b981'][i % 3] }} />
                    <span style={{ fontSize: '13px', fontWeight: '900', color: '#111827' }}>{d.name}</span>
                    <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '700' }}>{((d.value / totalNetSales) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '950', color: '#111827', marginBottom: '24px' }}>Channel Performance</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {['Dine In', 'Takeaway', 'Delivery'].map(channel => {
                  const channelTotal = filteredHistory.filter(o => getChannelLabel(o) === channel).reduce((acc, o) => acc + (o.grandTotal || 0), 0);
                  const percentage = totalNetSales > 0 ? (channelTotal / totalNetSales) * 100 : 0;
                  const icons = { 'Dine In': Clock, 'Takeaway': ShoppingBag, 'Delivery': Package };
                  const Icon = icons[channel];
                  return (
                    <div key={channel}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ padding: '8px', borderRadius: '10px', background: '#f1f5f9' }}><Icon size={18} color="#475569" /></div>
                          <span style={{ fontSize: '15px', fontWeight: '900', color: '#111827' }}>{channel}</span>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: '950', color: '#111827' }}>{formatCurrency(channelTotal)}</span>
                      </div>
                      <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #a3112a, #f97316)', borderRadius: '99px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsHub;
