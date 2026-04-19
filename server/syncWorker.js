/**
 * Cloud Sync Worker
 * ─────────────────
 * Runs on a configurable interval, picks up pending items from sync_queue,
 * and pushes them to the cloud backend (one-way: local → cloud only).
 *
 * Works completely offline — the queue persists in SQLite and retries
 * automatically on the next cycle when the connection is restored.
 */

import { statements } from './db.js';

const CLOUD_URL = process.env.CLOUD_URL || 'https://restaurant-cloud-backend.onrender.com';
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS) || 30_000; // 30s default
const BATCH_SIZE = 20;

let _running = false;

/**
 * Start the background sync worker.
 * Safe to call multiple times — only one instance runs at a time.
 */
export function startSyncWorker() {
  console.log(`  🔄 Cloud Sync Worker → ${CLOUD_URL} (every ${SYNC_INTERVAL_MS / 1000}s)`);

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
 * One sync cycle — process all pending items in batches.
 */
async function runSyncCycle() {
  if (_running) return; // Prevent overlap
  _running = true;

  try {
    const pending = statements.getPendingSyncItems({ limit: BATCH_SIZE });
    if (!pending.length) return;

    console.log(`  ☁️  Syncing ${pending.length} item(s) to cloud...`);
    let successCount = 0;

    for (const item of pending) {
      try {
        let payload;
        try { payload = JSON.parse(item.payload); } catch (e) { payload = item.payload; }

        const res = await fetch(`${CLOUD_URL}/sync-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: item.type, payload, local_id: item.id }),
          signal: AbortSignal.timeout(8000)
        });

        if (res.ok) {
          statements.markSyncComplete({ id: item.id });
          successCount++;
        } else {
          console.warn(`  ⚠️  Cloud rejected sync item #${item.id}: HTTP ${res.status}`);
          statements.markSyncFailed({ id: item.id });
        }
      } catch (err) {
        // Network error — leave as 'pending' so it retries next cycle
        console.warn(`  ⚠️  Sync item #${item.id} deferred: ${err.message}`);
      }
    }

    if (successCount > 0) {
      console.log(`  ✅ Cloud synced ${successCount}/${pending.length} items`);
    }
  } catch (err) {
    console.warn('  ⚠️  Sync worker cycle error:', err.message);
  } finally {
    _running = false;
  }
}
