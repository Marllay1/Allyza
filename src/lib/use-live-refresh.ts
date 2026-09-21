"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-fetches the current server page when a shared table changes (RLS decides what each person receives). */
export function useLiveRefresh(table: string, coupleId: string) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase
      .channel(`live:${table}:${coupleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `couple_id=eq.${coupleId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 350);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(ch); };
  }, [table, coupleId, router]);
}
