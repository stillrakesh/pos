/**
 * Cloud Sync Worker
 * ─────────────────
 * Runs on a configurable interval, picks up pending items from sync_queue,
 * and pushes them to the cloud dashboard API (one-way: local → cloud).
 *
 * Works completely offline — the queue persists in SQLite and retries
 * automatically on the next cycle when internet connection is restored.
 */

import { statements } from './db.js';

const DEFAULT_CLOUD_URL = process.env.CLOUD_URL || 'https://tyde-dashboard-tan.vercel.app';
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS) || 15_000; // 15s default
const BATCH_SIZE = 50;

let _running = false;

/**
 * Start the background sync worker.
 */
export function startSyncWorker() {
  const syncCfg = statements.getConfig({ key: 'cloud_sync_config' }) || {};
  const targetUrl = syncCfg.cloudUrl || DEFAULT_CLOUD_URL;
  console.log(`  🔄 Cloud Sync Worker active → ${targetUrl} (every ${SYNC_INTERVAL_MS / 1000}s)`);

  // Run once immediately after startup (2s delay for DB to settle)
  setTimeout(() => runSyncCycle(), 2000);

  // Then on a fixed interval
  setInterval(() => runSyncCycle(), SYNC_INTERVAL_MS);

  // Clean up old completed records once per hour
  setInterval(() => {
    try { statements.cleanOldSyncItems(); } catch (e) {}
  }, 3_600_000);
}

/**
 * One sync cycle — process pending items in batches.
 */
export async function runSyncCycle() {
  if (_running) return;
  _running = true;

  try {
    const syncCfg = statements.getConfig({ key: 'cloud_sync_config' }) || {};
    const targetUrl = (syncCfg.cloudUrl || DEFAULT_CLOUD_URL).replace(/\/$/, '');
    const apiKey = syncCfg.apiKey || process.env.CLOUD_API_KEY || '';

    const pending = statements.getPendingSyncItems({ limit: BATCH_SIZE });
    if (!pending.length) return;

    const events = pending.map(item => {
      let payload;
      try { payload = JSON.parse(item.payload); } catch (e) { payload = item.payload; }
      return {
        local_id: item.id,
        type: item.type,
        payload
      };
    });

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['x-api-key'] = apiKey;
    }

    // Try batch ingestion endpoint first
    try {
      const res = await fetch(`${targetUrl}/api/sync/ingest`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        pending.forEach(item => statements.markSyncComplete({ id: item.id }));
        statements.setConfig({
          key: 'cloud_sync_status',
          value: { lastSyncAt: new Date().toISOString(), status: 'connected', syncedCount: pending.length }
        });
        console.log(`  ☁️  Cloud batch synced ${pending.length} event(s)`);
        return;
      }
    } catch (batchErr) {
      // Fallback to item-by-item sync if batch endpoint is unavailable
    }

    // Fallback item-by-item sync
    let successCount = 0;
    for (const item of pending) {
      try {
        let payload;
        try { payload = JSON.parse(item.payload); } catch (e) { payload = item.payload; }

        const res = await fetch(`${targetUrl}/sync-event`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ type: item.type, payload, local_id: item.id }),
          signal: AbortSignal.timeout(8000)
        });

        if (res.ok) {
          statements.markSyncComplete({ id: item.id });
          successCount++;
        } else if (res.status === 401 || res.status === 403) {
          console.warn(`  ⚠️ Cloud sync rejected: Invalid API Key`);
          statements.setConfig({
            key: 'cloud_sync_status',
            value: { lastSyncAt: new Date().toISOString(), status: 'auth_error', error: 'Invalid API Key' }
          });
          break;
        } else {
          statements.markSyncFailed({ id: item.id });
        }
      } catch (err) {
        // Network deferred
      }
    }

    if (successCount > 0) {
      statements.setConfig({
        key: 'cloud_sync_status',
        value: { lastSyncAt: new Date().toISOString(), status: 'connected', syncedCount: successCount }
      });
    }
  } catch (err) {
    console.warn('  ⚠️ Cloud sync cycle warning:', err.message);
  } finally {
    _running = false;
  }
}

