/**
 * Analytics API — Read-only intelligence endpoints.
 * Queries the orders + expenses tables.
 * Supports business-day offset for cafes open past midnight.
 */
import { Router } from 'express';
import { statements } from '../db.js';
import { startSyncWorker, runSyncCycle, verifyCloudApiKey } from '../syncWorker.js';

const router = Router();

// ─── Helper: apply business-day offset ───────────────────────
// closeHour: hour (0-6) at which the new business day "starts"
// e.g. closeHour=2 means orders before 2 AM belong to the previous day
function getBusinessDate(isoString, closeHourOffset) {
  if (!closeHourOffset || closeHourOffset === 0) {
    return isoString.split('T')[0];
  }
  const d = new Date(isoString);
  d.setHours(d.getHours() - closeHourOffset);
  return d.toISOString().split('T')[0];
}

// ─── Helper: expand business date range to UTC timestamps ─────
function expandRangeToUTC(from, to, closeHourOffset) {
  const offsetMs = (closeHourOffset || 0) * 3600 * 1000;
  // from date at 00:00 + offset = actual UTC start
  const startUTC = new Date(`${from}T00:00:00.000Z`).getTime() + offsetMs;
  // to date at 23:59:59 + offset = actual UTC end
  const endUTC = new Date(`${to}T23:59:59.999Z`).getTime() + offsetMs;
  return {
    from: new Date(startUTC).toISOString(),
    to: new Date(endUTC).toISOString()
  };
}

// ─── GET /api/analytics/config ───────────────────────────────
// Returns business day close hour setting
router.get('/config', (req, res) => {
  try {
    const cfg = statements.getConfig({ key: 'analytics_config' }) || {};
    res.json({ success: true, closeHour: cfg.closeHour || 0 });
  } catch (err) {
    res.json({ success: true, closeHour: 0 });
  }
});

// ─── POST /api/analytics/config ──────────────────────────────
router.post('/config', (req, res) => {
  try {
    const { closeHour } = req.body;
    const hour = Math.min(6, Math.max(0, parseInt(closeHour) || 0));
    const existing = statements.getConfig({ key: 'analytics_config' }) || {};
    statements.setConfig({ key: 'analytics_config', value: { ...existing, closeHour: hour } });
    res.json({ success: true, closeHour: hour });
  } catch (err) {
    console.error('[POST /analytics/config]', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// ─── GET /api/analytics/cloud-sync ─────────────────────────────
router.get('/cloud-sync', (req, res) => {
  try {
    const config = statements.getConfig({ key: 'cloud_sync_config' }) || {};
    const status = statements.getConfig({ key: 'cloud_sync_status' }) || {};
    res.json({ success: true, config, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/analytics/cloud-sync/verify ─────────────────────
router.post('/cloud-sync/verify', async (req, res) => {
  try {
    const { apiKey, cloudUrl } = req.body;
    const result = await verifyCloudApiKey(cloudUrl, apiKey);
    
    // Store status in DB
    statements.setConfig({
      key: 'cloud_sync_status',
      value: {
        lastSyncAt: new Date().toISOString(),
        status: result.status,
        message: result.message,
        verifiedAt: result.verifiedAt || null
      }
    });

    res.json({ success: result.success, ...result });
  } catch (err) {
    res.status(500).json({ success: false, status: 'error', message: err.message });
  }
});

// ─── POST /api/analytics/cloud-sync ────────────────────────────
router.post('/cloud-sync', async (req, res) => {
  try {
    const { apiKey, cloudUrl } = req.body;
    const existing = statements.getConfig({ key: 'cloud_sync_config' }) || {};
    const newConfig = {
      ...existing,
      apiKey: apiKey !== undefined ? String(apiKey).trim() : (existing.apiKey || ''),
      cloudUrl: cloudUrl !== undefined ? String(cloudUrl).trim() : (existing.cloudUrl || 'https://tyde-dashboard-tan.vercel.app')
    };
    statements.setConfig({ key: 'cloud_sync_config', value: newConfig });
    
    // Run verification immediately
    const verifyResult = await verifyCloudApiKey(newConfig.cloudUrl, newConfig.apiKey);
    statements.setConfig({
      key: 'cloud_sync_status',
      value: {
        lastSyncAt: new Date().toISOString(),
        status: verifyResult.status,
        message: verifyResult.message,
        verifiedAt: verifyResult.verifiedAt || null
      }
    });

    // Trigger sync cycle immediately upon saving config
    runSyncCycle().catch(err => console.warn('Manual sync trigger error:', err));
    
    res.json({ success: true, config: newConfig, verify: verifyResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/analytics/cloud-sync/trigger ─────────────────────
router.post('/cloud-sync/trigger', async (req, res) => {
  try {
    const config = statements.getConfig({ key: 'cloud_sync_config' }) || {};
    if (!config.apiKey) {
      return res.status(400).json({ success: false, error: 'Please enter your Cloud API Key in Settings → Server tab first.' });
    }
    
    await runSyncCycle();
    const status = statements.getConfig({ key: 'cloud_sync_status' }) || {};
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD ─
router.get('/summary', (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    const cfg = statements.getConfig({ key: 'analytics_config' }) || {};
    const closeHour = cfg.closeHour || 0;
    const { from: utcFrom, to: utcTo } = expandRangeToUTC(from, to, closeHour);

    const orders = statements.getCompletedOrdersInRange({ from: utcFrom, to: utcTo });

    let totalRevenue = 0, totalOrders = 0, totalItems = 0;
    let totalGst = 0, totalSC = 0;
    const paymentBreakdown = {};

    orders.forEach(order => {
      const grand = Number(order.grand_total || 0);
      const items = order.items || [];
      const subtotal = items.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || i.qty || 1)), 0);
      const scEnabled = order.service_charge_enabled === 1;
      const scRate = Number(order.service_charge_rate || 0);
      const gstEnabled = order.gst_enabled === 1;
      const gstRate = Number(order.gst_rate || 0);
      const sc = scEnabled ? Math.floor(subtotal * scRate / 100) : 0;
      const gst = gstEnabled ? Math.floor((subtotal + sc) * gstRate / 100) : 0;

      const revenue = grand > 0 ? grand : (subtotal + sc + gst);
      totalRevenue += revenue;
      totalOrders++;
      totalItems += items.reduce((s, i) => s + Number(i.quantity || i.qty || 1), 0);
      totalGst += gst;
      totalSC += sc;

      const pm = order.payment_method || 'Unknown';
      paymentBreakdown[pm] = (paymentBreakdown[pm] || 0) + revenue;
    });

    res.json({
      success: true,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      totalItems,
      avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders * 100) / 100 : 0,
      totalGst: Math.round(totalGst * 100) / 100,
      totalServiceCharge: Math.round(totalSC * 100) / 100,
      paymentBreakdown
    });
  } catch (err) {
    console.error('[GET /analytics/summary]', err);
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

// ─── GET /api/analytics/trend?from=&to=&groupBy=day|hour ──────
router.get('/trend', (req, res) => {
  try {
    const { from, to, groupBy = 'day' } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    const cfg = statements.getConfig({ key: 'analytics_config' }) || {};
    const closeHour = cfg.closeHour || 0;
    const { from: utcFrom, to: utcTo } = expandRangeToUTC(from, to, closeHour);

    const orders = statements.getCompletedOrdersInRange({ from: utcFrom, to: utcTo });

    const buckets = {};
    orders.forEach(order => {
      const grand = Number(order.grand_total || 0);
      const items = order.items || [];
      const subtotal = items.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || i.qty || 1)), 0);
      const revenue = grand > 0 ? grand : subtotal;

      let key;
      if (groupBy === 'hour') {
        const d = new Date(order.created_at);
        key = `${String(d.getHours()).padStart(2, '0')}:00`;
      } else {
        key = getBusinessDate(order.created_at, closeHour);
      }

      if (!buckets[key]) buckets[key] = { revenue: 0, orders: 0, items: 0 };
      buckets[key].revenue += revenue;
      buckets[key].orders++;
      buckets[key].items += items.reduce((s, i) => s + Number(i.quantity || i.qty || 1), 0);
    });

    // Fill gaps for day grouping
    const result = [];
    if (groupBy === 'day') {
      const cursor = new Date(`${from}T00:00:00Z`);
      const endDate = new Date(`${to}T00:00:00Z`);
      while (cursor <= endDate) {
        const key = cursor.toISOString().split('T')[0];
        result.push({ key, label: cursor.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), ...(buckets[key] || { revenue: 0, orders: 0, items: 0 }) });
        cursor.setDate(cursor.getDate() + 1);
        if (result.length > 120) break;
      }
    } else {
      // Hour grouping: 0–23
      for (let h = 0; h < 24; h++) {
        const key = `${String(h).padStart(2, '0')}:00`;
        result.push({ key, label: key, ...(buckets[key] || { revenue: 0, orders: 0, items: 0 }) });
      }
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[GET /analytics/trend]', err);
    res.status(500).json({ error: 'Failed to compute trend' });
  }
});

// ─── GET /api/analytics/products?from=&to= ───────────────────
router.get('/products', (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    const cfg = statements.getConfig({ key: 'analytics_config' }) || {};
    const closeHour = cfg.closeHour || 0;
    const { from: utcFrom, to: utcTo } = expandRangeToUTC(from, to, closeHour);

    const orders = statements.getCompletedOrdersInRange({ from: utcFrom, to: utcTo });

    // Also load previous period for comparison
    const rangeMs = new Date(utcTo).getTime() - new Date(utcFrom).getTime();
    const prevFrom = new Date(new Date(utcFrom).getTime() - rangeMs).toISOString();
    const prevTo = utcFrom;
    const prevOrders = statements.getCompletedOrdersInRange({ from: prevFrom, to: prevTo });

    const productMap = {};
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const name = item.name || 'Unknown';
        if (!productMap[name]) productMap[name] = { name, category: item.category || 'General', qty: 0, revenue: 0 };
        const qty = Number(item.quantity || item.qty || 1);
        productMap[name].qty += qty;
        productMap[name].revenue += qty * Number(item.price || 0);
      });
    });

    const prevProductMap = {};
    prevOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const name = item.name || 'Unknown';
        if (!prevProductMap[name]) prevProductMap[name] = { qty: 0 };
        prevProductMap[name].qty += Number(item.quantity || item.qty || 1);
      });
    });

    const products = Object.values(productMap).map(p => {
      const prevQty = prevProductMap[p.name]?.qty || 0;
      const change = prevQty > 0 ? Math.round(((p.qty - prevQty) / prevQty) * 100) : null;
      return { ...p, prevQty, change };
    }).sort((a, b) => b.revenue - a.revenue);

    res.json({ success: true, products });
  } catch (err) {
    console.error('[GET /analytics/products]', err);
    res.status(500).json({ error: 'Failed to compute products' });
  }
});

// ─── GET /api/analytics/comparison?from=&to= ─────────────────
// Compares current period vs previous period of same length
router.get('/comparison', (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    const cfg = statements.getConfig({ key: 'analytics_config' }) || {};
    const closeHour = cfg.closeHour || 0;
    const { from: utcFrom, to: utcTo } = expandRangeToUTC(from, to, closeHour);

    const rangeMs = new Date(utcTo).getTime() - new Date(utcFrom).getTime();
    const prevFrom = new Date(new Date(utcFrom).getTime() - rangeMs - 1).toISOString();
    const prevTo = new Date(new Date(utcFrom).getTime() - 1).toISOString();

    const current = statements.getCompletedOrdersInRange({ from: utcFrom, to: utcTo });
    const previous = statements.getCompletedOrdersInRange({ from: prevFrom, to: prevTo });

    const calcMetrics = (orders) => {
      let revenue = 0, count = 0, items = 0;
      orders.forEach(o => {
        const grand = Number(o.grand_total || 0);
        const oItems = o.items || [];
        const sub = oItems.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || i.qty || 1), 0);
        revenue += grand > 0 ? grand : sub;
        count++;
        items += oItems.reduce((s, i) => s + Number(i.quantity || i.qty || 1), 0);
      });
      return { revenue: Math.round(revenue * 100) / 100, orders: count, items, aov: count > 0 ? Math.round(revenue / count * 100) / 100 : 0 };
    };

    const curr = calcMetrics(current);
    const prev = calcMetrics(previous);

    const pct = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : (a > 0 ? 100 : 0);

    res.json({
      success: true,
      current: curr,
      previous: prev,
      changes: {
        revenue: pct(curr.revenue, prev.revenue),
        orders: pct(curr.orders, prev.orders),
        items: pct(curr.items, prev.items),
        aov: pct(curr.aov, prev.aov)
      }
    });
  } catch (err) {
    console.error('[GET /analytics/comparison]', err);
    res.status(500).json({ error: 'Failed to compute comparison' });
  }
});

// ─── GET /api/analytics/expenses?from=&to= ───────────────────
router.get('/expenses', (req, res) => {
  try {
    const { from, to } = req.query;
    const expenses = statements.getAllExpenses({ from, to });
    const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    res.json({ success: true, expenses, total: Math.round(total * 100) / 100 });
  } catch (err) {
    console.error('[GET /analytics/expenses]', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// ─── POST /api/analytics/expenses ────────────────────────────
router.post('/expenses', (req, res) => {
  try {
    const { amount, category, note, expense_date } = req.body;
    if (!amount || isNaN(Number(amount))) return res.status(400).json({ error: 'amount is required' });
    const result = statements.insertExpense({ amount: Number(amount), category, note, expense_date });
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('[POST /analytics/expenses]', err);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// ─── DELETE /api/analytics/expenses/:id ──────────────────────
router.delete('/expenses/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    statements.deleteExpense({ id });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /analytics/expenses]', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
