"use client";
import { useEffect, useRef } from "react";

/**
 * The open conversation's frame: pinned to the *visual* viewport, so the keyboard shrinks the
 * message area instead of pushing the header off-screen or the composer underneath.
 * iOS keeps the layout viewport still and instead pans it when the keyboard opens, so the
 * height and offset come from visualViewport rather than dvh/vh (which ignore the keyboard).
 */
export function ChatShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vv = window.visualViewport;
    const root = document.documentElement;
    const prevOverscroll = root.style.overscrollBehavior;
    root.style.overscrollBehavior = "none";

    const apply = () => {
      const h = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      el.style.height = `${h}px`;
      el.style.transform = `translateY(${top}px)`;
      // With the keyboard up the home-indicator inset is no longer at the bottom of the visible area.
      const keyboardOpen = window.innerHeight - h > 120;
      el.style.setProperty("--sab", keyboardOpen ? "0px" : "env(safe-area-inset-bottom)");
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    // iOS may still scroll the page itself when an input is focused; pin it back.
    const pin = () => { if (window.scrollY !== 0) window.scrollTo(0, 0); };
    window.addEventListener("scroll", pin, { passive: true });

    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("scroll", pin);
      root.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  return (
    <div ref={ref} className="fixed inset-x-0 top-0 z-30 mx-auto w-full max-w-2xl flex flex-col overflow-hidden"
      style={{ height: "100dvh", background: "var(--bg)" }}>
      {children}
    </div>
  );
}
