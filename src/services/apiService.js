import { BASE_URL, CLOUD_URL } from '../constants';

/**
 * ApiService: Centralized module for all network requests.
 * Isolates the fetch API and endpoint definitions from business logic and UI.
 */

const headers = { 'Content-Type': 'application/json' };

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 300;

/**
 * Fetch with automatic retry + exponential backoff + timeout.
 * - GET requests retry on any failure (network or server 5xx).
 * - Mutations (POST/PUT/PATCH/DELETE) only retry on network errors,
 *   NOT on 4xx (to prevent double-submitting orders).
 */
const fetchWithRetry = async (url, options = {}, retries = DEFAULT_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes((options.method || 'GET').toUpperCase());

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Add timeout via AbortSignal if not already present
      const fetchOptions = { ...options };
      if (!fetchOptions.signal) {
        fetchOptions.signal = AbortSignal.timeout(timeoutMs);
      }

      const res = await fetch(url, fetchOptions);

      // Don't retry client errors (4xx) on mutations — the request was received
      if (!res.ok && isMutation && res.status >= 400 && res.status < 500) {
        return res; // Let handleResponse deal with the error
      }

      // Retry server errors (5xx) 
      if (!res.ok && res.status >= 500 && attempt < retries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[API] Server error ${res.status} on ${url}, retrying in ${delay}ms (${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err) {
      // Network error or timeout — always retry
      if (attempt < retries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[API] ${err.name === 'TimeoutError' ? 'Timeout' : 'Network error'} on ${url}, retrying in ${delay}ms (${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err; // Final attempt failed
    }
  }
};

/** Shorthand: fetch with retry + handle JSON response */
const resilientFetch = (url, options, retries, timeoutMs) =>
  fetchWithRetry(url, options, retries, timeoutMs).then(handleResponse);

const handleResponse = async (res) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${res.status}`);
  }
  return res.json();
};

export const apiService = {
  // --- CLOUD SYNC ---
  async syncToCloud(payload) {
    return resilientFetch(`${CLOUD_URL}/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  },

  async fetchCloudSync() {
    return resilientFetch(`${CLOUD_URL}/sync`, { signal: AbortSignal.timeout(5000) });
  },

  async fetchCloudSyncHealth() {
    return resilientFetch(`${CLOUD_URL}/sync`, { signal: AbortSignal.timeout(6000) });
  },

  async syncAppData(tables, menuItems, categories) {
    try {
      await fetchWithRetry(`${BASE_URL}/tables`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tables })
      });
      await fetchWithRetry(`${BASE_URL}/menu`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items: menuItems, cats: categories })
      });
      return true;
    } catch (err) {
      console.error("Cloud Sync Failed:", err);
      return false;
    }
  },

  // --- TABLES ---
  async fetchTables() {
    return resilientFetch(`${BASE_URL}/tables`, { signal: AbortSignal.timeout(3000) });
  },

  async fetchTableById(id) {
    return resilientFetch(`${BASE_URL}/table/${id}`);
  },

  async createTable(tableData) {
    return resilientFetch(`${BASE_URL}/tables`, {
      method: 'POST',
      headers,
      body: JSON.stringify(tableData)
    });
  },

  async updateTable(id, data) {
    return resilientFetch(`${BASE_URL}/tables/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
  },

  async patchTable(id, data) {
    return resilientFetch(`${BASE_URL}/tables/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });
  },

  async deleteTable(id) {
    return resilientFetch(`${BASE_URL}/tables/${id}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(4000)
    });
  },

  async clearTable(id) {
    return resilientFetch(`${BASE_URL}/table/${id}/clear`, { method: 'POST' });
  },

  async shiftTable(fromId, toId) {
    return resilientFetch(`${BASE_URL}/table/shift`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fromId, toId })
    });
  },

  async mergeTables(fromId, toId) {
    return resilientFetch(`${BASE_URL}/table/merge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fromId, toId })
    });
  },

  async splitTable(fromId, toId, itemsToMove) {
    return resilientFetch(`${BASE_URL}/table/split`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fromId, toId, itemsToMove })
    });
  },

  // --- MENU & CATEGORIES ---
  async fetchMenu() {
    return resilientFetch(`${BASE_URL}/menu`, { signal: AbortSignal.timeout(4000) });
  },

  async createMenuItem(itemData) {
    return resilientFetch(`${BASE_URL}/menu`, {
      method: 'POST',
      headers,
      body: JSON.stringify(itemData)
    });
  },

  async updateMenuItem(id, data) {
    return resilientFetch(`${BASE_URL}/menu/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
  },

  async deleteMenuItem(id) {
    return resilientFetch(`${BASE_URL}/menu/${id}`, { method: 'DELETE' });
  },

  async fetchCategories() {
    return resilientFetch(`${BASE_URL}/categories`, { signal: AbortSignal.timeout(4000) });
  },

  async saveCategories(categories) {
    return resilientFetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ categories })
    });
  },

  // --- ORDERS ---
  async fetchOrders(status) {
    const path = status ? `/orders?status=${encodeURIComponent(status)}` : `/orders`;
    return resilientFetch(`${BASE_URL}${path}`);
  },

  async createOrder(payload) {
    return resilientFetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  },

  async updateOrder(id, data) {
    return resilientFetch(`${BASE_URL}/orders/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
  },

  async deleteOrder(id) {
    return resilientFetch(`${BASE_URL}/orders/${id}`, {
      method: 'DELETE',
      headers
    });
  },

  async patchOrder(id, data) {
    return resilientFetch(`${BASE_URL}/orders/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });
  },

  async updateOrderStatus(orderId, status) {
    return resilientFetch(`${BASE_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status })
    });
  },

  // --- CRM & AUDIT (Phase 2) ---
  async fetchCustomer(phone) {
    return resilientFetch(`${BASE_URL}/customers?phone=${phone}`);
  },
  
  async fetchCustomers() {
    return resilientFetch(`${BASE_URL}/customers`);
  },

  async fetchCustomerHistory(phone) {
    return resilientFetch(`${BASE_URL}/customers/${encodeURIComponent(phone)}/history`);
  },

  async fetchAuditLogs() {
    return resilientFetch(`${BASE_URL}/audit`);
  },

  async logAudit(action, details) {
    return resilientFetch(`${BASE_URL}/audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, details })
    });
  },

  // --- INVENTORY & RECIPES (Phase 3) ---
  async fetchInventoryItems() {
    return resilientFetch(`${BASE_URL}/inventory/items`);
  },
  async createInventoryItem(data) {
    return resilientFetch(`${BASE_URL}/inventory/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
  },
  async updateInventoryItem(id, data) {
    return resilientFetch(`${BASE_URL}/inventory/items/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
  },
  async deleteInventoryItem(id) {
    return resilientFetch(`${BASE_URL}/inventory/items/${id}`, {
      method: 'DELETE',
      headers
    });
  },
  async fetchRecipes() {
    return resilientFetch(`${BASE_URL}/inventory/recipes`);
  },
  async upsertRecipe(menuItemId, inventoryItemId, quantityRequired) {
    return resilientFetch(`${BASE_URL}/inventory/recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ menu_item_id: menuItemId, inventory_item_id: inventoryItemId, quantity_required: quantityRequired })
    });
  },
  async removeRecipeItem(menuItemId, inventoryItemId) {
    return resilientFetch(`${BASE_URL}/inventory/recipes/${menuItemId}/${inventoryItemId}`, {
      method: 'DELETE',
      headers
    });
  },
  async adjustInventoryStock(inventoryItemId, changeType, quantity) {
    return resilientFetch(`${BASE_URL}/inventory/adjust`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inventory_item_id: inventoryItemId, change_type: changeType, quantity })
    });
  },

  // --- BILLING & PAYMENTS ---
  async settleBill(tableId, paymentMode, orderDetails) {
    return resilientFetch(`${BASE_URL}/billing/settle`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ table_id: tableId, payment_mode: paymentMode, order_details: orderDetails })
    });
  },

  async getBillNumber(tableId) {
    return resilientFetch(`${BASE_URL}/billing/bill-number/${tableId}`);
  },

  async updateDeviceStatus(deviceId, status) {
    return resilientFetch(`${BASE_URL}/devices/${deviceId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status })
    });
  },

  async deleteDevice(deviceId) {
    return resilientFetch(`${BASE_URL}/devices/${deviceId}`, { method: 'DELETE' });
  },

  // --- CONFIG & SYSTEM ---
  async fetchConfig(key) {
    return resilientFetch(`${BASE_URL}/api/config/${key}`);
  },

  async saveConfig(key, value) {
    return resilientFetch(`${BASE_URL}/api/config/${key}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(value)
    });
  },

  async fetchLanInfo() {
    return resilientFetch(`${BASE_URL}/api/lan`);
  },

  async fetchVersion() {
    return resilientFetch('/version.json');
  },

  async syncLocalData(payload) {
    return resilientFetch(`${BASE_URL}/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  },

  async syncCaptainMode(enabled) {
    return resilientFetch(`${BASE_URL}/api/captain-mode`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled })
    });
  },

  async fetchNetwork() {
    return resilientFetch(`${BASE_URL}/api/network`);
  },

  async fetchNetworkDiagnostics() {
    return resilientFetch(`${BASE_URL}/api/network-diagnostics`);
  },

  async checkHealth() {
    return fetchWithRetry(`${BASE_URL}/health`, {}, 0, 2000).then(res => res.ok).catch(() => false);
  },

  async fetchPrinters() {
    // The printer API is often served on the same origin as the frontend in electron/desktop setups
    return resilientFetch(`${window.location.origin}/api/printers`);
  },

  async checkCustomHealth(url) {
    try {
      const res = await fetchWithRetry(`${url}/api/health`, {}, 0, 5000);
      return { ok: res.ok, status: res.status };
    } catch (err) {
      throw err;
    }
  },

  // --- ANALYTICS & EXPENSES ---
  async fetchAnalyticsConfig() {
    return resilientFetch(`${BASE_URL}/api/analytics/config`);
  },

  async updateAnalyticsConfig(data) {
    return resilientFetch(`${BASE_URL}/api/analytics/config`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
  },

  async fetchExpenses(from, to) {
    return resilientFetch(`${BASE_URL}/api/analytics/expenses?from=${from}&to=${to}`);
  },

  async addExpense(data) {
    return resilientFetch(`${BASE_URL}/api/analytics/expenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
  },

  async deleteExpense(id) {
    return resilientFetch(`${BASE_URL}/api/analytics/expenses/${id}`, { method: 'DELETE' });
  },

  // --- KDS (Phase 6 Upgrade) ---
  async fetchKdsTickets() {
    return resilientFetch(`${BASE_URL}/api/kds`);
  },
  
  async createKdsTicket(data) {
    return resilientFetch(`${BASE_URL}/api/kds`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
  },

  async syncKdsTicket(table_number, items) {
    return resilientFetch(`${BASE_URL}/api/kds/sync/${encodeURIComponent(table_number)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ items })
    });
  },

  async updateKdsTicket(id, status) {
    return resilientFetch(`${BASE_URL}/api/kds/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status })
    });
  },

  async fetchAllKdsTickets() {
    return resilientFetch(`${BASE_URL}/api/kds/all`);
  },

  async fetchKdsStats() {
    return resilientFetch(`${BASE_URL}/api/kds/stats`);
  },

  async updateKdsItemStatus(ticketId, itemIndex, status) {
    return resilientFetch(`${BASE_URL}/api/kds/${ticketId}/item`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ itemIndex, status })
    });
  },

  async fetchBillingHistory() {
    return resilientFetch(`${BASE_URL}/api/billing/history`);
  },

  async updateBillPaymentMethod(id, payment_method) {
    return resilientFetch(`${BASE_URL}/api/billing/history/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ payment_method })
    });
  }
};

export default apiService;
