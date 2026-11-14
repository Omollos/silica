/**
 * Lightweight procedural Web Audio API sound effects (zero external audio files).
 * Quiet, tactile feedback for young commanders.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.08,
  delay = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Ignore audio playback errors in locked contexts
  }
}

export function playClick(enabled = true): void {
  if (!enabled) return;
  playTone(540, 0.07, 'triangle', 0.06);
}

export function playAdvance(enabled = true): void {
  if (!enabled) return;
  playTone(440, 0.09, 'sine', 0.06, 0);
  playTone(587.33, 0.12, 'sine', 0.06, 0.06);
}

export function playResult(enabled = true): void {
  if (!enabled) return;
  playTone(660, 0.1, 'triangle', 0.05, 0);
}

export function playWarning(enabled = true): void {
  if (!enabled) return;
  playTone(330, 0.14, 'sawtooth', 0.04, 0);
  playTone(294, 0.18, 'sawtooth', 0.04, 0.13);
}

export function playSuccess(enabled = true): void {
  if (!enabled) return;
  playTone(523.25, 0.14, 'sine', 0.07, 0);
  playTone(659.25, 0.14, 'sine', 0.07, 0.1);
  playTone(783.99, 0.28, 'sine', 0.08, 0.2);
}

export function playFailure(enabled = true): void {
  if (!enabled) return;
  playTone(311.13, 0.2, 'triangle', 0.07, 0);
  playTone(261.63, 0.25, 'triangle', 0.07, 0.18);
  playTone(196.0, 0.35, 'triangle', 0.07, 0.36);
}