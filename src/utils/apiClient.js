import { BASE_URL } from '../constants';
console.log('📡 BASE_URL:', BASE_URL);

/**
 * Fetch all orders, optionally filtered by status.
 */
export async function fetchOrders(status) {
  const path = status ? `/orders?status=${encodeURIComponent(status)}` : `/orders`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);
    
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Update order status using PATCH /orders/:id
 */
export async function updateOrderStatusPatch(orderId, status) {
  const path = `/orders/${orderId}`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Update order status (legacy PUT)
 */
export async function updateOrderStatus(orderId, status) {
  const path = `/orders?id=${orderId}`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Sync POS Data to Cloud (Tables, Menu)
 */
export async function syncAppData(tables, menuItems, categories) {
  try {
    const tableUrl = `${BASE_URL}/tables`;
    const menuUrl = `${BASE_URL}/menu`;
    console.log('📡 Syncing Tables to:', tableUrl);
    console.log('📡 Syncing Menu to:', menuUrl);

    await fetch(tableUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables })
    });
    
    await fetch(menuUrl, {
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
 */
export async function createOrder(orderData) {
  const path = `/orders`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch live table status from cloud.
 */
export async function fetchTables() {
  const path = `/tables`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Update table status or full order.
 */
export async function updateTableApi(tableId, data) {
  const path = `/tables/${tableId}`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch all linked devices.
 */
export async function fetchDevices() {
  const path = `/devices`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

/**
 * Update device permission.
 */
export async function updateDeviceStatus(deviceId, status) {
  const path = `/devices/${deviceId}`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url, {
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
  const path = `/devices/${deviceId}`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url, { method: 'DELETE' });
  return res.json();
}

/**
 * Fetch all menu items from cloud.
 */
export async function fetchMenu() {
  const path = `/menu?all=true`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Create a new menu item via POST.
 */
export async function createMenuItem(itemData) {
  const path = `/menu`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);
  console.log("ITEM BEING SENT:", itemData);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData)
  });
  
  const data = await res.json();
  console.log("Backend response:", data);

  if (!data.success) {
    throw new Error(data.error || "Server error");
  }

  return data;
}

/**
 * Delete a menu item.
 */
export async function deleteMenuItem(itemId) {
  const path = `/menu/${itemId}`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} failed`);
  return res.json();
}

/**
 * Update a menu item via PUT.
 */
export async function updateMenuItemApi(id, data) {
  const path = `/menu/${id}`;
  const url = `${BASE_URL}${path}`;
  console.log('📡 Calling URL:', url);

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`PUT ${path} failed`);
  return res.json();
}

/**
 * Check if the API server is reachable.
 */
export async function checkApiHealth() {
  try {
    const url = `${BASE_URL}/health`;
    console.log('📡 Checking health at:', url);
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
