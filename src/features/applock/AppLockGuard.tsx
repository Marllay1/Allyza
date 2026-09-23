"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { lockAppNowAction } from "@/actions/applock";
import { SESSION_KEY } from "@/lib/webauthn";

const noop = () => () => {};
const isFreshLaunch = () => { try { return sessionStorage.getItem(SESSION_KEY) !== "1"; } catch { return false; } };

/**
 * Wraps the app while protection is on and unlocked. It re-locks when:
 *  - Allyza was closed and reopened (a fresh launch, not a reload or a navigation);
 *  - the app sat in the background longer than the chosen delay;
 * and it blanks the screen the instant the app is backgrounded, so the phone's app-switcher
 * preview never shows private content.
 */
export function AppLockGuard({ idleSeconds, children }: { idleSeconds: number; children: React.ReactNode }) {
  const router = useRouter();
  const fresh = useSyncExternalStore(noop, isFreshLaunch, () => true);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    if (!fresh) return;
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* private mode */ }
    void lockAppNowAction().then(() => router.refresh());
  }, [fresh, router]);

  useEffect(() => {
    const root = document.documentElement;
    const hide = () => { root.classList.add("app-privacy"); hiddenAt.current = hiddenAt.current ?? Date.now(); };
    const show = () => {
      root.classList.remove("app-privacy");
      const at = hiddenAt.current;
      hiddenAt.current = null;
      if (at !== null && Date.now() - at >= idleSeconds * 1000) void lockAppNowAction().then(() => router.refresh());
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? hide() : show());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      root.classList.remove("app-privacy");
    };
  }, [idleSeconds, router]);

  // Until the first check has run the content stays covered, so a cold start can't flash private pages.
  return <div style={fresh ? { visibility: "hidden" } : undefined}>{children}</div>;
}
