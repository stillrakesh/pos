// Screen Wake Lock utility — keeps mobile screen ON while Captain app is active
// Uses navigator.wakeLock API with silent video fallback for older devices

let wakeLockSentinel: WakeLockSentinel | null = null;
let noSleepVideo: HTMLVideoElement | null = null;
let isActive = false;

const SILENT_MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABidWR0YQAAAFptZXRhAAAAIWhkbHIAAAAAAAAAAG1kaXIAAAAAAAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjU4Ljc2LjEwMA==';

export async function acquireWakeLock(): Promise<void> {
  if (isActive) return;
  isActive = true;
  if ('wakeLock' in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen wake lock acquired via API');
      wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
    } catch (err) {
      console.warn('[WakeLock] API failed, using video fallback:', err);
      startVideoFallback();
    }
  } else {
    console.log('[WakeLock] API not available, using video fallback');
    startVideoFallback();
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

export async function releaseWakeLock(): Promise<void> {
  isActive = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (wakeLockSentinel) {
    try { await wakeLockSentinel.release(); wakeLockSentinel = null; } catch { /* ignore */ }
  }
  stopVideoFallback();
}

function startVideoFallback() {
  if (noSleepVideo) return;
  try {
    noSleepVideo = document.createElement('video');
    noSleepVideo.setAttribute('playsinline', '');
    noSleepVideo.setAttribute('muted', '');
    noSleepVideo.setAttribute('loop', '');
    noSleepVideo.muted = true;
    noSleepVideo.style.cssText = 'position:fixed;top:-1px;left:-1px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;';
    noSleepVideo.src = SILENT_MP4;
    document.body.appendChild(noSleepVideo);
    noSleepVideo.play().catch(() => {});
  } catch { /* ignore */ }
}

function stopVideoFallback() {
  if (noSleepVideo) { noSleepVideo.pause(); noSleepVideo.remove(); noSleepVideo = null; }
}

async function handleVisibilityChange() {
  if (!isActive) return;
  if (document.visibilityState === 'visible') {
    if ('wakeLock' in navigator && !wakeLockSentinel) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
      } catch { /* ignore */ }
    }
    if (noSleepVideo && noSleepVideo.paused) { noSleepVideo.play().catch(() => {}); }
  }
}
