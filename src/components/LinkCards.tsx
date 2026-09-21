"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinCoupleAction, regenerateInviteAction, unlinkPartnerAction } from "@/actions/couple";
import { useT } from "@/lib/i18n/provider";
import { ErrorNote } from "@/components/Feedback";
import type { ErrCode } from "@/lib/action-utils";

/** Partner side: enter her invite code to join. */
export function JoinCard() {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<ErrCode | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get("code"));
        setError(null);
        start(async () => {
          const r = await joinCoupleAction(code);
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      <h2 className="text-2xl">{t("link.joinTitle")}</h2>
      <p className="text-sm text-muted">{t("link.joinBody")}</p>
      <input name="code" className="field text-center tracking-[0.3em] uppercase font-mono" placeholder="XXXXXXXXXXXX" maxLength={24} autoCapitalize="characters" autoComplete="off" required />
      <ErrorNote code={error} />
      <button className="btn btn-primary" disabled={pending}>{t("link.join")}</button>
    </form>
  );
}

/** Her side: share the invite code, or unlink. */
export function InviteCard({ code, linked, partnerName }: { code: string; linked: boolean; partnerName?: string }) {
  const t = useT();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);
  const [pending, start] = useTransition();

  if (linked) {
    return (
      <div className="grid gap-3">
        <p>{t("link.linkedWith", { name: partnerName ?? "" })}</p>
        <ErrorNote code={error} />
        <button
          className="btn btn-danger" disabled={pending}
          onClick={() => confirm(t("link.confirmUnlink")) && start(async () => { const r = await unlinkPartnerAction(); if (r.ok) router.refresh(); else setError(r.error); })}
        >
          {t("link.unlink")}
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">{t("link.inviteBody")}</p>
      <div className="flex items-center gap-2">
        <code className="field flex items-center justify-center font-mono tracking-[0.25em] text-lg select-all">{code}</code>
        <button
          className="btn" aria-label={t("common.copy")}
          onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} }}
        >
          {copied ? "✓" : t("common.copy")}
        </button>
      </div>
      <ErrorNote code={error} />
      <button className="btn btn-ghost text-sm" disabled={pending} onClick={() => start(async () => { const r = await regenerateInviteAction(); if (r.ok) router.refresh(); else setError(r.error); })}>
        {t("link.regenerate")}
      </button>
    </div>
  );
}
