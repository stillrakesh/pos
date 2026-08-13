// Web Audio API sound effects for Kitchen Display System
// Programmatic synth sound generation — no external mp3 files required

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Check if audio has been unlocked by user gesture */
export function isAudioUnlocked(): boolean {
  return unlocked && audioCtx !== null && audioCtx.state === 'running';
}

/**
 * Unlock AudioContext on first user interaction.
 * Must be called inside a touchstart / click event handler.
 */
export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Play a silent 0.01s buffer to force iOS Safari AudioContext state to 'running'
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    unlocked = true;
    console.log('[Audio] ✅ Web Audio API Unlocked successfully');
  } catch (e) {
    console.warn('[Audio] Unlock failed:', e);
  }
}

/**
 * Loud, alertful multi-tone chime for new KOT orders.
 * Plays 3 ascending notes (C5→E5→G5) with higher volume and longer sustain
 * so it's clearly audible on phone speakers across a noisy kitchen.
 */
export function playNewOrderSound() {
  try {
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, delay: 0 },      // C5
      { freq: 659.25, delay: 0.15 },    // E5
      { freq: 783.99, delay: 0.30 },    // G5
    ];

    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.40, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.5);
    });

    const gap = 0.6;
    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + gap + delay);
      gain.gain.setValueAtTime(0.35, now + gap + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + gap + delay + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + gap + delay);
      osc.stop(now + gap + delay + 0.45);
    });

  } catch (e) {
    console.warn('[Audio] playNewOrderSound error:', e);
  }
}

/** Short double-beep for qty/order modifications */
export function playModifiedSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [440, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      gain.gain.setValueAtTime(0.25, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.2);
    });
  } catch { /* silent fail */ }
}

/** Pleasant chime when marking item/ticket as READY */
export function playReadySound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [523.25, 659.25, 1046.50].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.25, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  } catch { /* silent fail */ }
}

/** Sound for table shift/move notification */
export function playTableShiftSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [659.25, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.2);
      gain.gain.setValueAtTime(0.25, now + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.35);
    });
  } catch { /* silent fail */ }
}

/** Warning sound when disconnected from server */
export function playDisconnectWarning() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [300, 250].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.2);
      gain.gain.setValueAtTime(0.3, now + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.2);
    });
  } catch { /* silent fail */ }
}

/** Vibrate device (if supported by hardware/browser) */
export function vibrateDevice(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch { /* ignore */ }
}
