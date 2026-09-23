"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Short-lived signed URLs for private storage paths. Nothing here is public: URLs expire in an
 * hour and are only issued when RLS says the caller may read the object.
 *
 * Shared across every component in the tab (not just per-hook-instance): a photo message
 * reused by many list rows (e.g. one avatar per chat bubble) used to fire one signing request
 * per row for the exact same path. This module-level cache + in-flight de-dupe means each path
 * is ever signed once, and stays cached for its TTL across remounts/navigations in the tab.
 */
type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const TTL_MS = 55 * 60 * 1000; // signed for 1h server-side; treat as stale a little early

function fetchMissing(paths: string[]) {
  const now = Date.now();
  const missing = paths.filter((p) => {
    const e = cache.get(p);
    return (!e || e.expiresAt < now) && !inflight.has(p);
  });
  if (!missing.length) return;
  const promise = createClient()
    .storage.from("couple-media")
    .createSignedUrls(missing, 3600)
    .then(({ data }) => {
      if (data) for (const d of data) if (d.path && d.signedUrl) cache.set(d.path, { url: d.signedUrl, expiresAt: Date.now() + TTL_MS });
    })
    .finally(() => missing.forEach((p) => inflight.delete(p)));
  missing.forEach((p) => inflight.set(p, promise));
}

export function useSignedUrls(paths: string[]): Record<string, string> {
  const key = paths.join("|");
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMissing(paths);
    const relevant = paths.map((p) => inflight.get(p)).filter((p): p is Promise<void> => !!p);
    if (relevant.length) Promise.all(relevant).then(() => { if (!cancelled) setTick((t) => t + 1); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Expiry is only ever checked inside the effect above (which re-signs proactively before the
  // underlying URL's real signature lapses); reading the cache here stays a pure lookup.
  const urls: Record<string, string> = {};
  for (const p of paths) { const e = cache.get(p); if (e) urls[p] = e.url; }
  return urls;
}
