"use client";
import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/** Renders children only in the browser. Used where "today" must be her local date, not the server's. */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  return <>{isClient ? children : fallback}</>;
}
