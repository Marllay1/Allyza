"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Days since epoch in the browser's own time zone (0 on the server, so hydration never mismatches). */
export function useDayNumber(): number {
  return useSyncExternalStore(
    subscribe,
    () => {
      const d = new Date();
      return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
    },
    () => 0,
  );
}
