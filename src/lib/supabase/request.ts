import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Per-request singletons. Layout, page and helpers all ask for "the client" and "the user":
 * React's cache() makes that ONE client and ONE auth round-trip per request instead of one each.
 */
export const getSupabase = cache(createClient);

export const getAuthUser = cache(async () => {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
