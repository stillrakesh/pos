// Screen Wake Lock utility — keeps screen ON while Kitchen/Captain Display is active.
// Uses native Screen Wake Lock API without video elements to prevent Web Audio muting on mobile.

let wakeLockSentinel: any = null;
let isActive = false;
let userGestureBound = false;

/**
 * Enable Screen Wake Lock.
 */
export async function acquireWakeLock(): Promise<void> {
  isActive = true;

  // Request native Screen Wake Lock
  tryNativeWakeLock();

  // Bind gesture listener in case browser required user action for permission
  if (!userGestureBound) {
    bindUserGestures();
  }

  // Re-acquire on tab visibility change
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Disable Screen Wake Lock.
 */
export async function releaseWakeLock(): Promise<void> {
  isActive = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  unbindUserGestures();

  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
      console.log('[WakeLock] Native Sentinel Released');
    } catch {}
  }
}

/**
 * Returns true if wake lock is currently active.
 */
export function isWakeLockActive(): boolean {
  return isActive && wakeLockSentinel !== null;
}

// ── Private Helpers ──────────────────────────────────────────

async function tryNativeWakeLock() {
  if (!isActive) return;
  if ('wakeLock' in navigator && (navigator as any).wakeLock) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      console.log('[WakeLock] ✅ Native Screen Wake Lock Acquired');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
        if (isActive) {
          setTimeout(tryNativeWakeLock, 1000);
        }
      });
    } catch (err: any) {
      console.warn('[WakeLock] Native request failed (HTTP/Browser constraint):', err?.message || err);
    }
  }
}

function handleUserGesture() {
  if (!isActive) return;
  if (!wakeLockSentinel) {
    tryNativeWakeLock();
  }
}

function bindUserGestures() {
  userGestureBound = true;
  const events = ['touchstart', 'touchend', 'click', 'pointerdown'];
  events.forEach(evt => {
    window.addEventListener(evt, handleUserGesture, { passive: true });
  });
}

function unbindUserGestures() {
  userGestureBound = false;
  const events = ['touchstart', 'touchend', 'click', 'pointerdown'];
  events.forEach(evt => {
    window.removeEventListener(evt, handleUserGesture);
  });
}

function handleVisibilityChange() {
  if (!isActive) return;
  if (document.visibilityState === 'visible') {
    tryNativeWakeLock();
  }
}
