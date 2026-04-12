const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001/api'
  : '/api';

/**
 * Fetch all orders, optionally filtered by status.
 * @param {'NEW'|'PRINTED'|'COMPLETED'} [status] 
 * @returns {Promise<{success: boolean, count: number, orders: Array}>}
 */
export async function fetchOrders(status) {
  const url = status 
    ? `${API_BASE}/orders?status=${encodeURIComponent(status)}` 
    : `${API_BASE}/orders`;
    
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /api/orders failed: ${res.status}`);
  return res.json();
}

/**
 * Update order status.
 */
export async function updateOrderStatus(orderId, status) {
  const url = `${API_BASE}/orders?id=${orderId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error(`PUT /api/orders failed: ${res.status}`);
  return res.json();
}

/**
 * Sync POS Data to Cloud (Tables, Menu)
 */
export async function syncAppData(tables, menuItems, categories) {
  try {
    await fetch(`${API_BASE}/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables })
    });
    
    await fetch(`${API_BASE}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: menuItems, cats: categories })
    });
    
    return true;
  } catch (err) {
    console.error("Cloud Sync Failed:", err);
    return false;
  }
}

/**
 * Create a new order via API.
 * @param {Object} orderData - { table_number, items, notes }
 * @returns {Promise<{success: boolean, order: Object}>} 
 */
export async function createOrder(orderData) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });
  if (!res.ok) throw new Error(`POST /api/orders failed: ${res.status}`);
  return res.json();
}

/**
 * Check if the API server is reachable.
 * @returns {Promise<boolean>}
 */
export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
