"use client";

/**
 * Short interface tones synthesised with Web Audio (no audio files to download or cache).
 * Browsers keep audio locked until the page has had a tap, so the shared context is created and
 * resumed on the first touch/key press; before that, tones are silently skipped.
 */
export type Sfx = "connect" | "hangup" | "dropped" | "sent" | "received";

let ctx: AudioContext | null = null;

const audioContext = () => {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  } catch { ctx = null; }
  return ctx;
};

if (typeof window !== "undefined") {
  const unlock = () => { void audioContext()?.resume().catch(() => {}); };
  for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, unlock, { passive: true });
}

// [start offset s, duration s, frequency Hz, peak gain]
const TONES: Record<Sfx, [number, number, number, number][]> = {
  connect: [[0, 0.11, 660, 0.12], [0.11, 0.2, 880, 0.12]],
  hangup: [[0, 0.13, 587, 0.12], [0.13, 0.22, 392, 0.12]],
  dropped: [[0, 0.16, 466, 0.12], [0.2, 0.16, 392, 0.12], [0.4, 0.28, 311, 0.12]],
  sent: [[0, 0.09, 740, 0.07], [0.05, 0.12, 988, 0.06]],
  received: [[0, 0.1, 880, 0.08], [0.1, 0.18, 1175, 0.08]],
};

export function playSfx(name: Sfx) {
  const c = audioContext();
  if (!c || c.state === "closed") return;
  void c.resume().catch(() => {});
  if (c.state !== "running") return;
  const now = c.currentTime;
  for (const [at, dur, freq, peak] of TONES[name]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(peak, now + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(now + at);
    osc.stop(now + at + dur + 0.02);
  }
}
