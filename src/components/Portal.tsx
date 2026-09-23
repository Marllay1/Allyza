"use client";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/local-pref";

/**
 * Renders children directly under <body>, outside the page's own tree. Full-screen overlays
 * (photo viewer, surprise reveal, good-night mode, call screen…) need this: the page's entrance
 * animations leave a resolved (if identity) transform on an ancestor, which — per spec — turns
 * that ancestor into the containing block for any `position: fixed` descendant, breaking
 * `inset-0` full-viewport coverage. A portal sidesteps the whole ancestor chain.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useIsClient();
  if (!mounted) return null;
  return createPortal(children, document.body);
}
