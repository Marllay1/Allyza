"use client";
import { useEffect, useState } from "react";

/** True while the given stream carries audible speech — drives the soft "they're talking" glow. */
export function useSpeaking(stream: MediaStream | null): boolean {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    let ctx: AudioContext;
    try { ctx = new AudioContext(); } catch { return; }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const id = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
      setSpeaking(Math.sqrt(sum / buf.length) > 0.04);
    }, 160);
    return () => { clearInterval(id); void ctx.close().catch(() => {}); setSpeaking(false); };
  }, [stream]);
  return speaking;
}
