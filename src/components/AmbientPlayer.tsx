"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { AppIcon } from "@/components/icons";
import { readLocalPref, setLocalPref } from "@/lib/local-pref";

/**
 * Ambient sounds are synthesised live with the Web Audio API: no audio files to
 * download, nothing to cache, works offline and never leaves the device.
 */
export const SOUNDS = ["rain", "ocean", "forest", "fire", "piano", "white"] as const;
type Sound = (typeof SOUNDS)[number];

type Stop = () => void;

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

function build(sound: Sound, ctx: AudioContext, out: AudioNode): Stop {
  const nodes: AudioNode[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  let alive = true;
  const g = (v: number) => { const n = ctx.createGain(); n.gain.value = v; n.connect(out); nodes.push(n); return n; };
  const f = (type: BiquadFilterType, freq: number, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = freq; n.Q.value = q; nodes.push(n); return n; };
  const src = (k: "white" | "pink" | "brown") => { const s = loop(ctx, k); nodes.push(s); return s; };
  const later = (fn: () => void, ms: number) => { timers.push(setTimeout(() => alive && fn(), ms)); };

  if (sound === "rain") {
    src("white").connect(f("highpass", 700)).connect(f("lowpass", 9000)).connect(g(0.16));
    src("pink").connect(f("lowpass", 1200)).connect(g(0.22));
  } else if (sound === "white") {
    src("white").connect(f("lowpass", 12000)).connect(g(0.12));
  } else if (sound === "ocean") {
    const wave = g(0.0);
    src("pink").connect(f("lowpass", 900)).connect(wave);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; nodes.push(lfo);
    const depth = ctx.createGain(); depth.gain.value = 0.22; nodes.push(depth);
    lfo.connect(depth).connect(wave.gain); wave.gain.value = 0.28; lfo.start();
  } else if (sound === "forest") {
    src("pink").connect(f("bandpass", 420, 0.5)).connect(g(0.14));
    const chirp = () => {
      const o = ctx.createOscillator(); const e = ctx.createGain(); o.type = "sine";
      const t0 = ctx.currentTime; const base = 2400 + Math.random() * 1800;
      o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t0 + 0.12);
      e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.05, t0 + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(e).connect(out); o.start(t0); o.stop(t0 + 0.25);
      later(chirp, 1800 + Math.random() * 6000);
    };
    later(chirp, 1500);
  } else if (sound === "fire") {
    src("brown").connect(f("lowpass", 520)).connect(g(0.5));
    const crackle = () => {
      const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, "white"); const e = ctx.createGain();
      const hp = f("highpass", 1500 + Math.random() * 2500); const t0 = ctx.currentTime;
      e.gain.setValueAtTime(0.18 * Math.random(), t0); e.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05 + Math.random() * 0.06);
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
      e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.13, t0 + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, t0 + 4);
      for (const [mult, vol, type] of [[1, 1, "sine"], [2, 0.3, "sine"], [3, 0.1, "triangle"]] as const) {
        const o = ctx.createOscillator(); const og = ctx.createGain(); o.type = type; o.frequency.value = scale[prev] * mult; og.gain.value = vol;
        o.connect(og).connect(e); o.start(t0); o.stop(t0 + 4.2);
      }
      e.connect(out); e.connect(delay);
      later(note, 1400 + Math.random() * 2800);
    };
    later(note, 300);
  }

  return () => {
    alive = false;
    timers.forEach(clearTimeout);
    nodes.forEach((n) => { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} try { n.disconnect(); } catch {} });
  };
}

export function AmbientPlayer() {
  const t = useT();
  const ctxRef = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const active = useRef<Map<Sound, Stop>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [on, setOn] = useState<Sound[]>([]);
  // Remembered on this device only. Nothing ever starts by itself: browsers forbid it and it would be rude.
  const [vol, setVol] = useState(() => { const v = Number(readLocalPref("allyza.sound.vol")); return v >= 0 && v <= 1 && readLocalPref("allyza.sound.vol") ? v : 0.6; });
  const [sleep, setSleep] = useState<number>(() => Number(readLocalPref("allyza.sound.sleep")) || 0);
  const [last] = useState<string | null>(() => readLocalPref("allyza.sound.last"));

  const ensure = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC(); const m = ctx.createGain(); m.gain.value = vol; m.connect(ctx.destination);
      ctxRef.current = ctx; master.current = m;
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };

  const stopAll = useCallback(() => {
    active.current.forEach((s) => s());
    active.current.clear();
    setOn([]);
  }, []);

  const toggle = (s: Sound) => {
    if (active.current.has(s)) { active.current.get(s)!(); active.current.delete(s); }
    else { const ctx = ensure(); active.current.set(s, build(s, ctx, master.current!)); setLocalPref("allyza.sound.last", s); }
    setOn([...active.current.keys()]);
  };

  useEffect(() => { if (master.current) master.current.gain.value = vol; }, [vol]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (sleep > 0 && on.length) timer.current = setTimeout(stopAll, sleep * 60_000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [sleep, on.length, stopAll]);

  useEffect(() => () => { active.current.forEach((s) => s()); ctxRef.current?.close(); }, []);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3">
        {SOUNDS.map((s) => (
          <button key={s} aria-pressed={on.includes(s)} onClick={() => toggle(s)}
            className={`card p-5 flex flex-col items-center gap-2 transition ${on.includes(s) ? "!border-accent ring-2 ring-accent/40" : ""}`}>
            <AppIcon name={s} size={34} className="text-accent" />
            <span className="font-display text-xl">{t(`atmosphere.sounds.${s}`)}</span>
            <span className="text-xs text-muted">{on.includes(s) ? t("atmosphere.playing") : s === last ? t("atmosphere.lastTime") : t("atmosphere.tapToPlay")}</span>
          </button>
        ))}
      </div>
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
