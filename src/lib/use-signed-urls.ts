"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Short-lived signed URLs for private storage paths. Nothing here is public:
 * URLs expire in an hour and are only issued when RLS says the caller may read the object.
 */
export function useSignedUrls(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  const key = paths.join("|");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const missing = paths.filter((p) => !requested.current.has(p));
    if (!missing.length) return;
    missing.forEach((p) => requested.current.add(p));
    createClient()
      .storage.from("couple-media")
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        if (!mounted.current || !data) return;
        setUrls((prev) => {
          const next = { ...prev };
          for (const d of data) if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
