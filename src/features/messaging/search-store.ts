"use client";
import { useSyncExternalStore } from "react";

/** Whether the in-conversation search bar is open: the header menu opens it, the conversation shows it. */
let open = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => { open = v; listeners.forEach((l) => l()); };

export const openSearch = () => set(true);
export const closeSearch = () => set(false);
export const useSearchOpen = () =>
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => open, () => false);
