const getBackendUrl = () => localStorage.getItem('backend_url') || 'http://localhost:3001';
const API_BASE = getBackendUrl().endsWith('/api') ? getBackendUrl() : `${getBackendUrl()}/api`;

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
 * Update order status using PATCH /orders/:id
 */
export async function updateOrderStatusPatch(orderId, status) {
  const url = `${API_BASE}/orders/${orderId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error(`PATCH /api/orders/${orderId} failed: ${res.status}`);
  return res.json();
}

/**
 * Update order status (legacy PUT)
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
 * Fetch live table status from cloud.
 * @returns {Promise<{success: boolean, tables: Array}>}
 */
export async function fetchTables() {
  const url = `${API_BASE}/tables`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /api/tables failed: ${res.status}`);
  return res.json();
}

/**
 * Update table status or full order.
 */
export async function updateTableApi(tableId, data) {
  const url = `${API_BASE}/tables/${tableId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`PUT /api/tables failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch all linked devices.
 */
export async function fetchDevices() {
  const res = await fetch(`${API_BASE}/devices`);
  if (!res.ok) throw new Error(`GET /api/devices failed`);
  return res.json();
}

/**
 * Update device permission.
 */
export async function updateDeviceStatus(deviceId, status) {
  const res = await fetch(`${API_BASE}/devices/${deviceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return res.json();
}

/**
 * Remove device.
 */
export async function deleteDevice(deviceId) {
  const res = await fetch(`${API_BASE}/devices/${deviceId}`, { method: 'DELETE' });
  return res.json();
}

/**
 * Check if the API server is reachable.
 */
export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
