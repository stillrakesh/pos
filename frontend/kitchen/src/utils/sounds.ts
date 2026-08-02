// Web Audio API sound effects for Kitchen Display System
// No external audio files required — generates tones programmatically

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Always resume if suspended (mobile browsers require user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Loud, alertful multi-tone chime for new KOT orders.
 * Plays 3 ascending notes (C5→E5→G5) with higher volume and longer sustain
 * so it's clearly audible on phone speakers across a noisy kitchen.
 */
export function playNewOrderSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Three-note ascending major chord: C5, E5, G5 — bright and attention-grabbing
    const notes = [
      { freq: 523.25, delay: 0 },      // C5
      { freq: 659.25, delay: 0.15 },    // E5
      { freq: 783.99, delay: 0.30 },    // G5
    ];

    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square'; // Square wave is louder and more piercing than sine
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.35, now + delay); // Higher volume
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.5);
    });

    // Second burst after a short gap for urgency (double-ring effect)
    const gap = 0.6;
    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + gap + delay);
      gain.gain.setValueAtTime(0.30, now + gap + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + gap + delay + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + gap + delay);
      osc.stop(now + gap + delay + 0.45);
    });

  } catch { /* silent fail on unsupported browsers */ }
}

/** Short double-beep for qty/order modifications */
export function playModifiedSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    [440, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      gain.gain.setValueAtTime(0.20, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.2);
    });
  } catch { /* silent fail */ }
}

/** Sound for table shift/move notification */
export function playTableShiftSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Descending two-tone: attention but not as urgent as new order
    [659.25, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.2);
      gain.gain.setValueAtTime(0.22, now + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.35);
    });
  } catch { /* silent fail */ }
}

/** Soft success chime for item marked ready */
export function playReadySound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch { /* silent fail */ }
}

/** Vibrate device if supported */
export function vibrateDevice(pattern: number | number[] = 50) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* silent fail */ }
}

/**
 * Unlock AudioContext on first user interaction.
 * Mobile browsers (iOS/Android) require a user gesture before audio can play.
 * Call this once on first tap/click anywhere on the page.
 */
export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Play a silent buffer to fully unlock on iOS
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch { /* silent fail */ }
}
