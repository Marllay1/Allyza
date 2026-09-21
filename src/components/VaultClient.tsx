"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addVaultItemAction, deleteVaultItemAction, vaultLockAction, vaultSetPinAction, vaultUnlockAction } from "@/actions/us";
import { useI18n } from "@/lib/i18n/provider";
import { formatDateTime } from "@/lib/format";
import { prepareImage, isAcceptedImage } from "@/lib/image";
import { useSignedUrls } from "@/lib/use-signed-urls";
import { ErrorNote, Notice } from "@/components/Feedback";
import { AppIcon } from "@/components/icons";
import type { ErrCode } from "@/lib/action-utils";

export type VaultItem = { id: string; author_id: string; kind: "letter" | "note" | "photo"; title: string; body: string | null; storage_path: string | null; created_at: string };
export type VaultState = { has_pin: boolean; unlocked: boolean; locked_until: string | null };

function PinField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field text-center text-2xl tracking-[0.6em] font-mono" type="password" inputMode="numeric" autoComplete="off" maxLength={8} pattern="\d{4,8}"
        value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} />
    </label>
  );
}

export function VaultClient({ state, items, coupleId, myId, names }: { state: VaultState; items: VaultItem[]; coupleId: string; myId: string; names: { me: string; other: string } }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [error, setError] = useState<ErrCode | null>(null);
  const [pending, start] = useTransition();
  const [changing, setChanging] = useState(false);
  const [kind, setKind] = useState<"letter" | "note" | "photo">("letter");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const urls = useSignedUrls(items.map((i) => i.storage_path).filter(Boolean) as string[]);

  // Auto-lock: leaving the app for over a minute closes the vault.
  useEffect(() => {
    if (!state.unlocked) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 60_000) {
        vaultLockAction().then(() => router.refresh());
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [state.unlocked, router]);

  const run = (fn: () => Promise<{ ok: boolean; error?: ErrCode }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) { after?.(); router.refresh(); } else setError(r.error ?? "generic");
    });

  const lockedUntil = state.locked_until ? new Date(state.locked_until) : null;

  if (!state.has_pin) {
    return (
      <form className="card p-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); run(() => vaultSetPinAction({ pin }), () => setPin("")); }}>
        <h2 className="text-2xl">{t("vault.createTitle")}</h2>
        <p className="text-sm text-muted">{t("vault.createBody")}</p>
        <PinField label={t("vault.newPin")} value={pin} onChange={setPin} />
        <ErrorNote code={error} />
        <button className="btn btn-primary" disabled={pending || pin.length < 4}>{t("vault.create")}</button>
      </form>
    );
  }

  if (!state.unlocked) {
    return (
      <form className="card p-6 grid gap-4 text-center" onSubmit={(e) => { e.preventDefault(); run(() => vaultUnlockAction(pin), () => setPin("")); }}>
        <div className="mx-auto grid place-items-center size-16 rounded-full bg-accent/15 text-accent"><AppIcon name="key" size={30} /></div>
        <h2 className="text-2xl">{t("vault.lockedTitle")}</h2>
        {lockedUntil && <Notice tone="care">{t("vault.lockedOut", { time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(lockedUntil) })}</Notice>}
        <PinField label={t("vault.enterPin")} value={pin} onChange={setPin} />
        <ErrorNote code={error} />
        <button className="btn btn-primary" disabled={pending || pin.length < 4}>{t("vault.unlock")}</button>
      </form>
    );
  }

  const submit = () =>
    run(async () => {
      if (kind === "photo") {
        if (!file) return { ok: false, error: "invalid" as ErrCode };
        try {
          const img = await prepareImage(file);
          const path = `${coupleId}/vault/${crypto.randomUUID()}.${img.ext}`;
          const up = await createClient().storage.from("couple-media").upload(path, img.blob, { contentType: img.type });
          if (up.error) return { ok: false, error: "locked" as ErrCode };
          return addVaultItemAction({ kind, title, path });
        } catch { return { ok: false, error: "generic" as ErrCode }; }
      }
      return addVaultItemAction({ kind, title, body });
    }, () => { setTitle(""); setBody(""); setFile(null); });

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-good inline-flex items-center gap-1.5"><AppIcon name="unlock" size={16} /> {t("vault.open")}</span>
        <div className="flex gap-2">
          <button className="btn !min-h-10 text-sm" onClick={() => setChanging((c) => !c)}>{t("vault.changePin")}</button>
          <button className="btn !min-h-10 text-sm" disabled={pending} onClick={() => run(() => vaultLockAction())}><AppIcon name="lock" size={15} /> {t("vault.lockNow")}</button>
        </div>
      </div>

      {changing && (
        <form className="card p-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); run(() => vaultSetPinAction({ pin, old: oldPin }), () => { setChanging(false); setPin(""); setOldPin(""); }); }}>
          <PinField label={t("vault.oldPin")} value={oldPin} onChange={setOldPin} />
          <PinField label={t("vault.newPin")} value={pin} onChange={setPin} />
          <button className="btn btn-primary" disabled={pending || pin.length < 4 || oldPin.length < 4}>{t("common.save")}</button>
        </form>
      )}

      <section className="card p-4 grid gap-3">
        <div className="flex gap-2" role="radiogroup">
          {(["letter", "note", "photo"] as const).map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} className="chip" onClick={() => setKind(k)}>{t(`vault.kinds.${k}`)}</button>
          ))}
        </div>
        <input className="field" maxLength={120} placeholder={t("vault.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
        {kind === "photo" ? (
          <label className="btn cursor-pointer">
            {file ? file.name : <><AppIcon name="camera" size={18} /> {t("memories.add")}</>}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] && isAcceptedImage(e.target.files[0]) ? e.target.files[0] : null)} />
          </label>
        ) : (
          <textarea className="field !min-h-32" maxLength={8000} placeholder={t(`vault.placeholder.${kind}`)} value={body} onChange={(e) => setBody(e.target.value)} />
        )}
        <ErrorNote code={error} />
        <button className="btn btn-primary" disabled={pending || (kind === "photo" ? !file : !body.trim())} onClick={submit}>{t("vault.add")}</button>
      </section>

      {items.length === 0 && <p className="text-center text-muted py-6">{t("vault.empty")}</p>}
      <ul className="grid gap-3">
        {items.map((i) => (
          <li key={i.id} className="card p-4">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>{t(`vault.kinds.${i.kind}`)} · {i.author_id === myId ? names.me : names.other}</span>
              <span>{formatDateTime(i.created_at, locale)}</span>
            </div>
            {i.title && <h3 className="text-xl">{i.title}</h3>}
            {i.body && <p className={`whitespace-pre-wrap break-words mt-1 ${i.kind === "letter" ? "font-display text-lg leading-relaxed" : ""}`}>{i.body}</p>}
            {i.storage_path && (urls[i.storage_path]
              ?   <img src={urls[i.storage_path]} alt={i.title} className="rounded-2xl mt-2 w-full max-h-96 object-cover" />
              : <div className="rounded-2xl mt-2 h-40 bg-surface2 animate-pulse" />)}
            {i.author_id === myId && (
              <button className="text-xs text-muted underline underline-offset-4 mt-2" onClick={() => confirm(t("common.confirmDelete")) && run(() => deleteVaultItemAction(i.id))}>{t("common.delete")}</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
