"use client";
import { useEffect } from "react";
import { haptic } from "@/lib/local-pref";
import { RING_STYLES, chosenRing, type RingId } from "@/lib/sfx";

/** One burst of the incoming ring in the given style, on an existing audio context. */
export function playRingBurst(ctx: AudioContext, style: RingId, level = 0.14) {
  const now = ctx.currentTime;
  for (const [from, to, freq] of RING_STYLES[style].tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + from);
    gain.gain.linearRampToValueAtTime(level, now + from + 0.03);
    gain.gain.setValueAtTime(level, now + to - 0.05);
    gain.gain.linearRampToValueAtTime(0, now + to);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + from);
    osc.stop(now + to + 0.05);
  }
}

/**
 * The sound of a phone actually ringing on this device: the chosen ring for an incoming call,
 * a softer single-tone ringback for the caller once the other phone has confirmed it is ringing.
 * Browsers may hold audio until the page has had a tap; when they do, vibration still fires.
 */
export function useRing(mode: "incoming" | "ringback" | null) {
  useEffect(() => {
    if (!mode) return;
    let ctx: AudioContext | null = null;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) { ctx = new AC(); void ctx.resume().catch(() => {}); }
    } catch { ctx = null; }

    const style = chosenRing();
    const burst = () => {
      if (mode === "incoming") haptic([300, 150, 300]);
      if (!ctx || ctx.state === "closed") return;
      if (mode === "incoming") { playRingBurst(ctx, style); return; }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 425;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.03);
      gain.gain.setValueAtTime(0.07, now + 0.95);
      gain.gain.linearRampToValueAtTime(0, now + 1.0);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.05);
    };
    burst();
    const id = setInterval(burst, mode === "incoming" ? RING_STYLES[style].every : 3200);
    return () => { clearInterval(id); ctx?.close().catch(() => {}); };
  }, [mode]);
}
