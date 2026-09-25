"use client";
import { useState } from "react";
import { AppIcon } from "@/components/icons";
import { Portal } from "@/components/Portal";
import { useCall } from "@/features/calls/CallProvider";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";

type CallRow = {
  id: string; caller_id: string; kind: "audio" | "video"; status: string;
  started_at: string; answered_at: string | null; ended_at: string | null;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** The list of past calls (from the `calls` table, which RLS already limits to this couple), each with a call-back button. */
export function CallHistoryButton({ myId }: { myId: string }) {
  const { t, locale } = useI18n();
  const { startCall, inCall } = useCall();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CallRow[] | null>(null);

  const load = async () => {
    setOpen(true);
    setRows(null);
    const { data } = await createClient().from("calls")
      .select("id, caller_id, kind, status, started_at, answered_at, ended_at")
      .order("started_at", { ascending: false }).limit(40);
    setRows((data ?? []) as CallRow[]);
  };

  const label = (c: CallRow) => {
    const mine = c.caller_id === myId;
    if (c.answered_at && c.ended_at) return t("call.hist.done", { duration: clock((Date.parse(c.ended_at) - Date.parse(c.answered_at)) / 1000) });
    switch (c.status) {
      case "missed": return t(mine ? "call.hist.noAnswer" : "call.hist.missed");
      case "cancelled": return t(mine ? "call.hist.cancelled" : "call.hist.missed");
      case "rejected": return t("call.hist.declined");
      case "failed": return t("call.hist.failed");
      case "ringing": case "accepted": return t("call.hist.ongoing");
      default: return t("call.hist.done", { duration: "0:00" });
    }
  };
  const bad = (c: CallRow) => !c.answered_at && ["missed", "cancelled"].includes(c.status) && c.caller_id !== myId;

  return (
    <>
      <button type="button" className="icon-btn" aria-label={t("call.history")} onClick={load}><AppIcon name="clock" size={18} /></button>
      {open && (
        <Portal>
          <div role="dialog" aria-modal="true" aria-label={t("call.history")} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
            <div className="card w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-b-none sm:rounded-3xl p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl">{t("call.history")}</h2>
                <button type="button" className="icon-btn !size-11" aria-label={t("common.close")} onClick={() => setOpen(false)}><AppIcon name="close" size={18} /></button>
              </div>
              {rows === null ? (
                <div className="grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-surface2 animate-pulse" />)}</div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">{t("call.historyEmpty")}</p>
              ) : (
                <ul className="grid gap-1.5">
                  {rows.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface2 px-3.5 py-2.5">
                      <span className={`grid place-items-center size-10 rounded-full shrink-0 ${bad(c) ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent"}`}>
                        <AppIcon name={c.kind === "video" ? "video" : "call"} size={18} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block ${bad(c) ? "text-danger" : ""}`}>{label(c)}</span>
                        <span className="block text-xs text-muted">
                          {t(c.caller_id === myId ? "call.hist.outgoing" : "call.hist.incoming")} · {new Date(c.started_at).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                      <button type="button" className="icon-btn shrink-0" disabled={inCall} aria-label={t("call.redial")} onClick={() => { setOpen(false); startCall(c.kind); }}>
                        <AppIcon name={c.kind === "video" ? "video" : "call"} size={17} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
