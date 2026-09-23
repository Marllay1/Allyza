"use client";
import { useState, useTransition } from "react";
import { setNicknameAction } from "@/actions/nickname";
import { AppIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/provider";

export function NicknameForm({ initial, partnerDefaultName }: { initial: string; partnerDefaultName: string }) {
  const t = useT();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setNicknameAction(v); if (r.ok) setSaved(true); }); }}>
      <p className="text-sm text-muted">{t("nicknameSettings.help", { name: partnerDefaultName })}</p>
      <div className="flex gap-2">
        <input className="field" value={v} maxLength={40} placeholder={partnerDefaultName} onChange={(e) => { setV(e.target.value); setSaved(false); }} aria-label={t("nicknameSettings.label")} />
        <button className="btn" disabled={pending || !v.trim() || v === initial}>{saved ? <AppIcon name="check" size={18} /> : t("common.save")}</button>
      </div>
    </form>
  );
}
