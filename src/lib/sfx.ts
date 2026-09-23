"use client";
import { readLocalPref } from "@/lib/local-pref";

/**
 * Short interface tones synthesised with Web Audio (no audio files to download or cache).
 * Browsers keep audio locked until the page has had a tap, so the shared context is created and
 * resumed on the first touch/key press; before that, tones are silently skipped.
 * Preferences are device-local: a master switch plus one tone (or "off") per category.
 */
export type Sfx = "connect" | "hangup" | "dropped" | "sent" | "received";
export type ToneId = "pop" | "soft" | "ding" | "chime" | "bell" | "marimba" | "rise" | "fall" | "drop" | "beep" | "low";
export type RingId = "classic" | "soft" | "chime";

// [start offset s, duration s, frequency Hz, peak gain]
type Note = [number, number, number, number];
const TONES: Record<ToneId, { wave: OscillatorType; notes: Note[] }> = {
  pop: { wave: "sine", notes: [[0, 0.09, 740, 0.07], [0.05, 0.12, 988, 0.06]] },
  soft: { wave: "sine", notes: [[0, 0.22, 523, 0.07]] },
  ding: { wave: "sine", notes: [[0, 0.1, 880, 0.08], [0.1, 0.18, 1175, 0.08]] },
  chime: { wave: "sine", notes: [[0, 0.12, 1047, 0.07], [0.1, 0.12, 1319, 0.07], [0.2, 0.26, 1568, 0.07]] },
  bell: { wave: "triangle", notes: [[0, 0.5, 1319, 0.07]] },
  marimba: { wave: "triangle", notes: [[0, 0.15, 523, 0.1], [0.12, 0.22, 784, 0.1]] },
  rise: { wave: "sine", notes: [[0, 0.11, 660, 0.12], [0.11, 0.2, 880, 0.12]] },
  fall: { wave: "sine", notes: [[0, 0.13, 587, 0.12], [0.13, 0.22, 392, 0.12]] },
  drop: { wave: "sine", notes: [[0, 0.16, 466, 0.12], [0.2, 0.16, 392, 0.12], [0.4, 0.28, 311, 0.12]] },
  beep: { wave: "square", notes: [[0, 0.08, 1000, 0.035], [0.14, 0.08, 1000, 0.035]] },
  low: { wave: "sine", notes: [[0, 0.26, 330, 0.1]] },
};

export const SFX_CATEGORIES: Record<Sfx, { tones: ToneId[]; def: ToneId }> = {
  connect: { tones: ["rise", "chime", "marimba", "bell", "soft"], def: "rise" },
  hangup: { tones: ["fall", "soft", "low", "beep"], def: "fall" },
  dropped: { tones: ["drop", "low", "beep", "fall"], def: "drop" },
  sent: { tones: ["pop", "soft", "ding", "marimba"], def: "pop" },
  received: { tones: ["ding", "chime", "bell", "marimba"], def: "ding" },
};

/** Incoming-call ring: [start, end, frequency] per burst, repeated every `every` ms. */
export const RING_STYLES: Record<RingId, { tones: [number, number, number][]; every: number }> = {
  classic: { tones: [[0, 0.4, 440], [0.5, 0.9, 480]], every: 2400 },
  soft: { tones: [[0, 0.7, 523]], every: 3000 },
  chime: { tones: [[0, 0.22, 784], [0.24, 0.46, 988], [0.48, 0.9, 1175]], every: 2600 },
};

export const SFX_ENABLED_KEY = "allyza.sfx.enabled";
export const sfxKey = (c: Sfx) => `allyza.sfx.${c}`;
export const RING_KEY = "allyza.sfx.ringtone";

export const sfxEnabled = () => readLocalPref(SFX_ENABLED_KEY) !== "0";
export function chosenTone(c: Sfx): ToneId | "off" {
  const v = readLocalPref(sfxKey(c));
  return v === "off" ? "off" : v && SFX_CATEGORIES[c].tones.includes(v as ToneId) ? (v as ToneId) : SFX_CATEGORIES[c].def;
}
export function chosenRing(): RingId {
  const v = readLocalPref(RING_KEY);
  return v && v in RING_STYLES ? (v as RingId) : "classic";
}

let ctx: AudioContext | null = null;

export const audioContext = () => {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  } catch { ctx = null; }
  return ctx;
};

if (typeof window !== "undefined") {
  // iOS only truly unlocks audio once something (even silence) has been played inside a tap.
  const unlock = () => {
    const c = audioContext();
    if (!c) return;
    void c.resume().then(() => {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    }).catch(() => {});
  };
  for (const ev of ["pointerdown", "click", "keydown", "touchend"]) window.addEventListener(ev, unlock, { passive: true });
}

/**
 * The audio context, once it is actually running. `resume()` is asynchronous: checking the state right after
 * calling it (as this used to) meant a context that iOS had suspended, or interrupted when the microphone
 * opened for a call, never played anything. Resolves null when the browser still refuses (no tap yet).
 */
export async function runningContext(): Promise<AudioContext | null> {
  const c = audioContext();
  if (!c || c.state === "closed") return null;
  if (c.state !== "running") {
    try { await Promise.race([c.resume(), new Promise((r) => setTimeout(r, 500))]); } catch { /* still locked */ }
  }
  return c.state === "running" ? c : null;
}

/** iOS mutes Web Audio on the silent switch unless the page declares it is playing audio: do so while a ring plays. */
export function setAudioSession(type: "playback" | "auto") {
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (s) s.type = type;
  } catch { /* unsupported */ }
}

/** Plays a tone regardless of the switches (used for previews in Settings). */
export async function previewTone(id: ToneId) {
  const c = await runningContext();
  if (!c) return;
  const now = c.currentTime;
  const { wave, notes } = TONES[id];
  for (const [at, dur, freq, peak] of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(peak, now + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(now + at);
    osc.stop(now + at + dur + 0.02);
  }
}

export function playSfx(name: Sfx) {
  if (!sfxEnabled()) return;
  const tone = chosenTone(name);
  if (tone !== "off") void previewTone(tone);
}
