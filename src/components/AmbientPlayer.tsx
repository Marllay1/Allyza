"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { AppIcon } from "@/components/icons";
import { readLocalPref, setLocalPref } from "@/lib/local-pref";

/**
 * Ambient sounds are synthesised live with the Web Audio API: no audio files to
 * download, nothing to cache, works offline and never leaves the device.
 *
 * One atmosphere at a time: choosing another cross-fades the previous one out.
 * Every atmosphere is levelled to a similar loudness and runs through a soft limiter,
 * so the volume slider means the same thing for rain and for piano.
 */
export const SOUNDS = ["rain", "ocean", "forest", "fire", "piano", "white"] as const;
type Sound = (typeof SOUNDS)[number];

type Stop = () => void;
type Voice = { bus: GainNode; stop: Stop };

const FADE_IN = 1.4; // seconds
const FADE_OUT = 0.7;

function noiseBuffer(ctx: AudioContext, kind: "white" | "pink" | "brown") {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w;
    else if (kind === "pink") {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return buf;
}

function loop(ctx: AudioContext, kind: "white" | "pink" | "brown") {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, kind);
  s.loop = true;
  s.start();
  return s;
}

/** Builds one atmosphere into `out` (its own bus). Returns a function that tears everything down. */
function build(sound: Sound, ctx: AudioContext, out: AudioNode): Stop {
  const nodes: AudioNode[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  let alive = true;
  const g = (v: number) => { const n = ctx.createGain(); n.gain.value = v; n.connect(out); nodes.push(n); return n; };
  const f = (type: BiquadFilterType, freq: number, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = freq; n.Q.value = q; nodes.push(n); return n; };
  const src = (k: "white" | "pink" | "brown") => { const s = loop(ctx, k); nodes.push(s); return s; };
  const later = (fn: () => void, ms: number) => { timers.push(setTimeout(() => alive && fn(), ms)); };

  if (sound === "rain") {
    src("white").connect(f("highpass", 700)).connect(f("lowpass", 9000)).connect(g(0.42));
    src("pink").connect(f("lowpass", 1200)).connect(g(0.6));
  } else if (sound === "white") {
    src("white").connect(f("lowpass", 12000)).connect(g(0.5));
  } else if (sound === "ocean") {
    const wave = g(0.0);
    src("pink").connect(f("lowpass", 900)).connect(wave);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; nodes.push(lfo);
    const depth = ctx.createGain(); depth.gain.value = 0.55; nodes.push(depth);
    lfo.connect(depth).connect(wave.gain); wave.gain.value = 0.75; lfo.start();
  } else if (sound === "forest") {
    // a low, airy bed of wind and leaves, with birds on top (the bed used to be almost silent)
    src("pink").connect(f("lowpass", 1400)).connect(g(0.5));
    src("pink").connect(f("bandpass", 3200, 0.6)).connect(g(0.18));
    const chirp = () => {
      const bursts = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < bursts; k++) {
        const o = ctx.createOscillator(); const e = ctx.createGain(); o.type = "sine";
        const t0 = ctx.currentTime + k * 0.16; const base = 2400 + Math.random() * 1800;
        o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t0 + 0.12);
        e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.16, t0 + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        o.connect(e).connect(out); o.start(t0); o.stop(t0 + 0.25);
      }
      later(chirp, 1600 + Math.random() * 5000);
    };
    later(chirp, 900);
  } else if (sound === "fire") {
    src("brown").connect(f("lowpass", 520)).connect(g(0.8));
    const crackle = () => {
      const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, "white"); const e = ctx.createGain();
      const hp = f("highpass", 1500 + Math.random() * 2500); const t0 = ctx.currentTime;
      e.gain.setValueAtTime(0.4 * Math.random(), t0); e.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05 + Math.random() * 0.06);
      s.connect(hp).connect(e).connect(out); s.start(t0, Math.random() * 3, 0.15);
      later(crackle, 90 + Math.random() * 700);
    };
    later(crackle, 300);
  } else if (sound === "piano") {
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.42; nodes.push(delay);
    const fb = ctx.createGain(); fb.gain.value = 0.38; nodes.push(fb);
    const damp = f("lowpass", 2600);
    delay.connect(damp).connect(fb).connect(delay); damp.connect(out);
    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25]; // C major pentatonic-ish
    let prev = 3;
    const note = () => {
      prev = Math.max(0, Math.min(scale.length - 1, prev + Math.round((Math.random() - 0.5) * 4)));
      const t0 = ctx.currentTime; const e = ctx.createGain();
      e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.28, t0 + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, t0 + 4);
      for (const [mult, vol, type] of [[1, 1, "sine"], [2, 0.3, "sine"], [3, 0.1, "triangle"]] as const) {
        const o = ctx.createOscillator(); const og = ctx.createGain(); o.type = type; o.frequency.value = scale[prev] * mult; og.gain.value = vol;
        o.connect(og).connect(e); o.start(t0); o.stop(t0 + 4.2);
      }
      e.connect(out); e.connect(delay);
      later(note, 1300 + Math.random() * 2400);
    };
    later(note, 300);
  }

  return () => {
    alive = false;
    timers.forEach(clearTimeout);
    nodes.forEach((n) => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} try { n.disconnect(); } catch {} });
  };
}

/**
 * iPhones mute Web Audio when the ring/silent switch is on, and stop it when the app is locked, unless the page
 * is playing "media". A looping silent <audio> element (plus the Audio Session API where it exists) makes the
 * page count as media, so the atmospheres are audible and keep going with the screen off.
 */
function silentWavUrl() {
  const rate = 8000, samples = 800; // 0.1 s of digital silence
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + samples * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** Best-effort hint (Safari) that this tab is doing audio playback, not a background timer. */
function markAudioSessionPlayback() {
  try {
    (navigator as unknown as { audioSession?: { type: string } }).audioSession!.type = "playback";
  } catch {
    /* not supported */
  }
}

export function AmbientPlayer() {
  const t = useT();
  const ctxRef = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const keepAlive = useRef<HTMLAudioElement | null>(null);
  const voices = useRef<Map<Sound, Voice>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [on, setOn] = useState<Sound[]>([]);
  const [muted, setMuted] = useState(false);
  // Remembered on this device only. Nothing ever starts by itself: browsers forbid it and it would be rude.
  const [vol, setVol] = useState(() => { const raw = readLocalPref("allyza.sound.vol"); const v = Number(raw); return raw !== null && v >= 0 && v <= 1 ? v : 0.6; });
  const [sleep, setSleep] = useState<number>(() => Number(readLocalPref("allyza.sound.sleep")) || 0);
  const [last] = useState<string | null>(() => readLocalPref("allyza.sound.last"));

  const gainFor = (v: number) => v; // 0..1 slider; levels are already balanced per atmosphere and limited

  const ensure = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const m = ctx.createGain(); m.gain.value = gainFor(vol);
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16; limiter.knee.value = 14; limiter.ratio.value = 8; limiter.attack.value = 0.005; limiter.release.value = 0.3;
      m.connect(limiter); limiter.connect(ctx.destination);
      ctx.onstatechange = () => setMuted(ctx.state !== "running" && voices.current.size > 0);
      ctxRef.current = ctx; master.current = m;
    }
    const ctx = ctxRef.current;
    // Must happen inside the tap: it is what lets iOS / Safari start audio at all.
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    markAudioSessionPlayback();
    if (!keepAlive.current) {
      const a = new Audio(silentWavUrl());
      a.loop = true; a.setAttribute("playsinline", ""); keepAlive.current = a;
    }
    keepAlive.current.play().catch(() => {});
    return ctx;
  };

  const fadeOut = (v: Voice) => {
    const ctx = ctxRef.current;
    if (!ctx) { v.stop(); return; }
    const now = ctx.currentTime;
    v.bus.gain.cancelScheduledValues(now);
    v.bus.gain.setValueAtTime(v.bus.gain.value, now);
    v.bus.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    setTimeout(() => { v.stop(); try { v.bus.disconnect(); } catch {} }, FADE_OUT * 1000 + 80);
  };

  const stopAll = useCallback(() => {
    voices.current.forEach((v) => fadeOut(v));
    voices.current.clear();
    setOn([]);
    setMuted(false);
    keepAlive.current?.pause();
  }, []);

  /** One atmosphere at a time: tapping the playing one stops it; tapping another cross-fades to it. */
  const select = (s: Sound) => {
    const playing = voices.current.get(s);
    if (playing) {
      fadeOut(playing);
      voices.current.delete(s);
      if (voices.current.size === 0) keepAlive.current?.pause();
    } else {
      const ctx = ensure();
      voices.current.forEach((v) => fadeOut(v));
      voices.current.clear();
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(0, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN);
      bus.connect(master.current!);
      voices.current.set(s, { bus, stop: build(s, ctx, bus) });
      setLocalPref("allyza.sound.last", s);
    }
    setOn([...voices.current.keys()]);
    setMuted(false);
  };

  useEffect(() => {
    if (master.current && ctxRef.current) master.current.gain.setTargetAtTime(gainFor(vol), ctxRef.current.currentTime, 0.05);
  }, [vol]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (sleep > 0 && on.length) timer.current = setTimeout(stopAll, sleep * 60_000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [sleep, on.length, stopAll]);

  // Leaving the page ends the sound for good.
  useEffect(() => () => {
    voices.current.forEach((v) => v.stop());
    voices.current.clear();
    keepAlive.current?.pause();
    ctxRef.current?.close().catch(() => {});
  }, []);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3">
        {SOUNDS.map((s) => (
          <button key={s} aria-pressed={on.includes(s)} onClick={() => select(s)}
            className={`card p-5 flex flex-col items-center gap-2 transition ${on.includes(s) ? "!border-accent ring-2 ring-accent/40" : ""}`}>
            <AppIcon name={s} size={34} className="text-accent" />
            <span className="font-display text-xl">{t(`atmosphere.sounds.${s}`)}</span>
            <span className="text-xs text-muted">{on.includes(s) ? t("atmosphere.playing") : s === last ? t("atmosphere.lastTime") : t("atmosphere.tapToPlay")}</span>
          </button>
        ))}
      </div>
      {muted && <p role="status" className="card p-4 text-sm text-center">{t("atmosphere.silentHint")}</p>}
      <div className="card p-5 grid gap-4">
        <label className="grid gap-1">
          <span className="label !mb-0">{t("atmosphere.volume")}</span>
          <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => { setVol(Number(e.target.value)); setLocalPref("allyza.sound.vol", e.target.value); }} className="w-full accent-[var(--accent)] h-8" />
        </label>
        <div>
          <span className="label">{t("atmosphere.sleepTimer")}</span>
          <div className="flex flex-wrap gap-2">
            {[0, 15, 30, 60].map((m) => (
              <button key={m} className="chip" aria-pressed={sleep === m} onClick={() => { setSleep(m); setLocalPref("allyza.sound.sleep", String(m)); }}>{m === 0 ? t("atmosphere.noTimer") : `${m} min`}</button>
            ))}
          </div>
        </div>
        {on.length > 0 && <button className="btn" onClick={stopAll}><AppIcon name="stop" size={16} /> {t("atmosphere.stop")}</button>}
      </div>
      <p className="text-xs text-muted text-center text-balance">{t("atmosphere.note")}</p>
    </div>
  );
}
