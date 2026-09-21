"use client";
import { useSyncExternalStore } from "react";

/**
 * Tiny device-local preference store (last atmosphere, sound volume, good-night mode…).
 * Only lightweight, non-sensitive settings live here; nothing about health or content.
 * Falls back to memory when storage is blocked (private windows) and never throws.
 */
const listeners = new Set<() => void>();
const mem = new Map<string, string | null>();

export function readLocalPref(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return mem.get(key) ?? null; }
}
export function setLocalPref(key: string, value: string | null) {
  mem.set(key, value);
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.storageArea === window.localStorage && cb();
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
};

export function useLocalPref(key: string, fallback: string | null = null): string | null {
  return useSyncExternalStore(subscribe, () => readLocalPref(key) ?? fallback, () => fallback);
}

/** Good-night mode is set by hand and lapses by itself after 12 hours (never clock-triggered). */
const NIGHT_KEY = "allyza.night";
const NIGHT_MS = 12 * 3600_000;
export const startNight = () => setLocalPref(NIGHT_KEY, String(Date.now()));
export const endNight = () => setLocalPref(NIGHT_KEY, null);
export function useNightMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => { const v = Number(readLocalPref(NIGHT_KEY)); return v > 0 && Date.now() - v < NIGHT_MS; },
    () => false,
  );
}

/** Very light haptics on devices that support them; silent everywhere else and with reduced motion. */
export function haptic(pattern: number | number[] = 12) {
  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(pattern);
  } catch { /* unsupported */ }
}
