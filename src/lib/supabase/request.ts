import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Per-request singletons. Layout, page and helpers all ask for "the client" and "the user".
 * React's cache() makes that ONE client per request; the user id itself is never re-verified
 * here at all — proxy.ts already validated the session once for this request and forwards the
 * result via a header it controls end-to-end, so this just reads that instead of a second
 * network round-trip to Supabase Auth on every single page.
 */
export const getSupabase = cache(createClient);

export const getAuthUser = cache(async (): Promise<{ id: string } | null> => {
  const h = await headers();
  const id = h.get("x-verified-user-id");
  return id ? { id } : null;
});
