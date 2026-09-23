"use client";
import { useEffect } from "react";
import { haptic } from "@/lib/local-pref";

/**
 * The sound of a phone actually ringing on this device: a two-tone ring for an incoming call,
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

    const burst = () => {
      if (mode === "incoming") haptic([300, 150, 300]);
      if (!ctx || ctx.state === "closed") return;
      const now = ctx.currentTime;
      const tones = mode === "incoming" ? [[0, 0.4, 440], [0.5, 0.9, 480]] : [[0, 1.0, 425]];
      for (const [from, to, freq] of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + from);
        gain.gain.linearRampToValueAtTime(mode === "incoming" ? 0.14 : 0.07, now + from + 0.03);
        gain.gain.setValueAtTime(mode === "incoming" ? 0.14 : 0.07, now + to - 0.05);
        gain.gain.linearRampToValueAtTime(0, now + to);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + from);
        osc.stop(now + to + 0.05);
      }
    };
    burst();
    const id = setInterval(burst, mode === "incoming" ? 2400 : 3200);
    return () => { clearInterval(id); ctx?.close().catch(() => {}); };
  }, [mode]);
}
