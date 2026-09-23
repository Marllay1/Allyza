"use client";
import { useCallback, useRef, useState } from "react";
import { useIsClient } from "@/lib/local-pref";

// MP4/AAC first: it plays on every iPhone, whereas WebM is not readable by older Safari (a voice note that arrives "empty").
const CANDIDATE_TYPES = ["audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm"];
const pickMimeType = () => (typeof MediaRecorder === "undefined" ? null : CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null);

export type RecorderState = "idle" | "recording" | "ready" | "denied";

/** Real microphone recording (MediaRecorder), with a live level meter for a waveform-style visual. */
export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [ms, setMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [blob, setBlob] = useState<{ blob: Blob; mime: string; ms: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef(0);

  const cleanup = () => {
    if (timer.current) clearInterval(timer.current);
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  };

  const isClient = useIsClient();
  const supported = isClient && !!navigator.mediaDevices?.getUserMedia && !!pickMimeType();

  const start = useCallback(async () => {
    if (!supported) return;
    setBlob(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = pickMimeType()!;
      const mr = new MediaRecorder(s, { mimeType: mime, audioBitsPerSecond: 32000 });
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.start(100);
      rec.current = mr;
      startedAt.current = Date.now();
      setMs(0);
      setState("recording");
      timer.current = setInterval(() => setMs(Date.now() - startedAt.current), 100);

      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC(); audioCtx.current = ctx;
      const src = ctx.createMediaStreamSource(s);
      const an = ctx.createAnalyser(); an.fftSize = 256; analyser.current = an;
      src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        setLevels((l) => [...l.slice(-38), Math.max(0.06, avg)]);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setState("denied");
    }
  }, [supported]);

  const stop = useCallback((discard = false) => {
    const mr = rec.current;
    if (!mr) return;
    const finalMs = Date.now() - startedAt.current;
    mr.onstop = () => {
      cleanup();
      if (!discard && chunks.current.length) {
        const type = mr.mimeType || chunks.current[0]?.type || pickMimeType() || "audio/mp4";
        const b = new Blob(chunks.current, { type });
        setBlob({ blob: b, mime: type, ms: finalMs });
        setPreviewUrl(URL.createObjectURL(b));
      }
      setState(discard ? "idle" : "ready");
      setLevels([]);
    };
    mr.stop();
  }, []);

  const reset = useCallback(() => {
    setBlob(null); setState("idle"); setMs(0); setLevels([]);
    setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
  }, []);

  return { supported, state, ms, levels, blob, previewUrl, start, stop, reset };
}
