// Screen Wake Lock utility — keeps mobile screen ON while Kitchen Display is active
// Uses navigator.wakeLock API with NoSleep.js-style silent video fallback for older devices

let wakeLockSentinel: WakeLockSentinel | null = null;
let noSleepVideo: HTMLVideoElement | null = null;
let isActive = false;

// Base64-encoded minimal silent MP4 video (< 1KB) for fallback wake lock
const SILENT_MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABidWR0YQAAAFptZXRhAAAAIWhkbHIAAAAAAAAAAG1kaXIAAAAAAAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjU4Ljc2LjEwMA==';

/**
 * Acquire a screen wake lock to prevent the device from sleeping.
 * Uses the modern Wake Lock API if available, falls back to a silent video loop.
 */
export async function acquireWakeLock(): Promise<void> {
  if (isActive) return;
  isActive = true;

  // Strategy 1: Native Wake Lock API (Chrome 84+, Safari 16.4+)
  if ('wakeLock' in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen wake lock acquired via API');

      wakeLockSentinel.addEventListener('release', () => {
        console.log('[WakeLock] Wake lock was released');
        wakeLockSentinel = null;
      });
    } catch (err) {
      console.warn('[WakeLock] API failed, using video fallback:', err);
      startVideoFallback();
    }
  } else {
    // Strategy 2: Silent video loop fallback (older browsers/iOS)
    console.log('[WakeLock] API not available, using video fallback');
    startVideoFallback();
  }

  // Re-acquire on visibility change (when user switches back to tab/app)
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Release the screen wake lock.
 */
export async function releaseWakeLock(): Promise<void> {
  isActive = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
      console.log('[WakeLock] Released via API');
    } catch { /* ignore */ }
  }

  stopVideoFallback();
}

/** Check if wake lock is currently active */
export function isWakeLockActive(): boolean {
  return isActive && (wakeLockSentinel !== null || noSleepVideo !== null);
}

// ── Internal helpers ──────────────────────────────────────────

function startVideoFallback() {
  if (noSleepVideo) return;
  try {
    noSleepVideo = document.createElement('video');
    noSleepVideo.setAttribute('playsinline', '');
    noSleepVideo.setAttribute('muted', '');
    noSleepVideo.setAttribute('loop', '');
    noSleepVideo.setAttribute('title', 'wake-lock');
    noSleepVideo.muted = true;
    noSleepVideo.style.cssText = 'position:fixed;top:-1px;left:-1px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;';
    noSleepVideo.src = SILENT_MP4;
    document.body.appendChild(noSleepVideo);
    noSleepVideo.play().catch(() => {});
    console.log('[WakeLock] Video fallback started');
  } catch { /* ignore */ }
}

function stopVideoFallback() {
  if (noSleepVideo) {
    noSleepVideo.pause();
    noSleepVideo.remove();
    noSleepVideo = null;
    console.log('[WakeLock] Video fallback stopped');
  }
}

async function handleVisibilityChange() {
  if (!isActive) return;
  if (document.visibilityState === 'visible') {
    // Re-acquire wake lock when page becomes visible again
    if ('wakeLock' in navigator && !wakeLockSentinel) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        console.log('[WakeLock] Re-acquired after visibility change');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      } catch { /* ignore */ }
    }
    // Re-play video fallback if needed
    if (noSleepVideo && noSleepVideo.paused) {
      noSleepVideo.play().catch(() => {});
    }
  }
}
