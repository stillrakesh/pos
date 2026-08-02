
import { getBackendURL } from '../config';

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  note?: string;
}

export interface OrderPayload {
  tableId: string;
  tableNumber: string;
  items: OrderItem[];
  notes: string;
  status: string;
  printKOT?: boolean;
  isSaveOnly?: boolean;
}

const getOfflineQueue = (): OrderPayload[] => {
  try {
    return JSON.parse(localStorage.getItem('offline_orders') || '[]');
  } catch {
    return [];
  }
};

const saveOfflineQueue = (queue: OrderPayload[]) => {
  localStorage.setItem('offline_orders', JSON.stringify(queue));
};

export const submitOrder = async (payload: OrderPayload) => {
  const baseUrl = getBackendURL();
  if (!baseUrl) throw new Error('Backend URL not configured');

  try {
    const response = await fetch(`${baseUrl}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit order');
    }

    return await response.json();
  } catch (error: any) {
    // Detect network/fetch errors vs backend errors
    const isNetworkError = error instanceof TypeError || 
                           error.name === 'AbortError' || 
                           error.message?.includes('Failed to fetch') ||
                           error.message?.includes('network');

    if (isNetworkError) {
      console.warn('[Offline Sync] Network error, queueing order locally:', error);
      const queue = getOfflineQueue();
      
      // Prevent exact duplicate inserts
      const isDuplicate = queue.some(q => 
        q.tableId === payload.tableId && 
        q.notes === payload.notes &&
        JSON.stringify(q.items) === JSON.stringify(payload.items)
      );

      if (!isDuplicate) {
        queue.push(payload);
        saveOfflineQueue(queue);
      }
      
      // Return custom indicator to let UI handle it gracefully
      return { success: true, offline: true };
    }
    throw error;
  }
};

export const syncOfflineOrders = async () => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`[Offline Sync] Attempting to sync ${queue.length} pending orders...`);
  const remaining: OrderPayload[] = [];

  for (const payload of queue) {
    try {
      // Direct fetch bypass to avoid re-queueing on failure
      const baseUrl = getBackendURL();
      const response = await fetch(`${baseUrl}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, printKOT: true })
      });

      if (!response.ok) {
        // If it's a validation error, discard it to avoid blocking the queue
        const error = await response.json();
        console.error(`[Offline Sync] Sync failed for Table ${payload.tableNumber} (Discarding invalid order):`, error);
      } else {
        console.log(`[Offline Sync] Synced order successfully for Table ${payload.tableNumber}`);
      }
    } catch (err) {
      console.warn(`[Offline Sync] Failed to sync order for Table ${payload.tableNumber}, keeping in queue:`, err);
      remaining.push(payload);
    }
  }

  saveOfflineQueue(remaining);
  
  // Dispatch custom event to notify UI to refresh its pending sync badge
  window.dispatchEvent(new CustomEvent('offline-sync-updated'));
};
