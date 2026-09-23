"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction, signOutAction } from "@/actions/auth";
import { AppIcon } from "@/components/icons";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/actions/notifications";
import { setThemeAction, updateDisplayNameAction, updatePrefsAction } from "@/actions/prefs";
import { updateSharingAction } from "@/actions/cycle";
import { useT } from "@/lib/i18n/provider";
import { SHARING_KEYS, type Sharing } from "@/lib/constants";
import { ErrorNote, Notice } from "@/components/Feedback";
import type { ErrCode } from "@/lib/action-utils";

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-4 py-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="sr-only peer" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className="relative w-12 h-7 rounded-full border border-line bg-surface2 transition peer-checked:bg-accent peer-focus-visible:ring-2 ring-accent shrink-0
        after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-ink/70 after:transition peer-checked:after:translate-x-5 peer-checked:after:bg-accent-ink" />
    </label>
  );
}

export function ThemePicker({ value }: { value: "system" | "light" | "dark" }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={t("settings.theme")}>
      {(["system", "light", "dark"] as const).map((v) => (
        <button key={v} role="radio" aria-checked={value === v} disabled={pending} className="chip flex-1 justify-center"
          onClick={() => start(async () => { await setThemeAction(v); router.refresh(); })}>
          {t(`settings.themes.${v}`)}
        </button>
      ))}
    </div>
  );
}

export function NameForm({ name }: { name: string }) {
  const t = useT();
  const router = useRouter();
  const [v, setV] = useState(name);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateDisplayNameAction(v); if (r.ok) { setSaved(true); router.refresh(); } }); }}>
      <input className="field" value={v} maxLength={40} onChange={(e) => { setV(e.target.value); setSaved(false); }} aria-label={t("auth.displayName")} />
      <button className="btn" disabled={pending || !v.trim() || v === name}>{saved ? <AppIcon name="check" size={18} /> : t("common.save")}</button>
    </form>
  );
}

export function SharingForm({ initial, herPartnerLinked, partnerName }: { initial: Sharing; herPartnerLinked: boolean; partnerName: string }) {
  const t = useT();
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [error, setError] = useState<ErrCode | null>(null);
  const [pending, start] = useTransition();
  const count = SHARING_KEYS.filter((k) => s[k]).length;

  const save = (patch: Partial<Sharing>) => {
    const prev = s;
    setS({ ...s, ...patch });
    setError(null);
    start(async () => {
      const r = await updateSharingAction(patch);
      if (!r.ok) { setS(prev); setError(r.error); } else router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      {!herPartnerLinked && <Notice>{t("sharing.noPartner", { name: partnerName })}</Notice>}
      <div className="card px-5 divide-y divide-line">
        {SHARING_KEYS.map((k) => (
          <Switch key={k} checked={s[k]} onChange={(v) => save({ [k]: v })} label={t(`sharing.items.${k}`)} hint={t(`sharing.hints.${k}`)} />
        ))}
      </div>
      <ErrorNote code={error} />
      <p className="text-sm text-muted text-center" role="status">{count === 0 ? t("sharing.nothing", { name: partnerName }) : t("sharing.count", { n: count })}</p>
      {count > 0 && (
        <button className="btn btn-danger" disabled={pending} onClick={() => save(Object.fromEntries(SHARING_KEYS.map((k) => [k, false])) as Partial<Sharing>)}>
          {t("sharing.revokeAll")}
        </button>
      )}
    </div>
  );
}

export function PrefSwitches({ prefs, showRefuge }: { prefs: { notify_journal: boolean; notify_media: boolean; notify_refuge: boolean; notify_little: boolean; notify_surprise: boolean; notify_message: boolean }; showRefuge: boolean }) {
  const t = useT();
  const router = useRouter();
  const [p, setP] = useState(prefs);
  const [, start] = useTransition();
  const set = (k: keyof typeof p, v: boolean) => { setP({ ...p, [k]: v }); start(async () => { await updatePrefsAction({ [k]: v }); router.refresh(); }); };
  return (
    <div className="card px-5 divide-y divide-line">
      <Switch checked={p.notify_message} onChange={(v) => set("notify_message", v)} label={t("notifications.message")} />
      <Switch checked={p.notify_journal} onChange={(v) => set("notify_journal", v)} label={t("notifications.journal")} />
      <Switch checked={p.notify_media} onChange={(v) => set("notify_media", v)} label={t("notifications.media")} />
      {showRefuge && <Switch checked={p.notify_refuge} onChange={(v) => set("notify_refuge", v)} label={t("notifications.refuge")} />}
      <Switch checked={p.notify_little} onChange={(v) => set("notify_little", v)} label={t("notifications.little")} />
      <Switch checked={p.notify_surprise} onChange={(v) => set("notify_surprise", v)} label={t("notifications.surprise")} />
    </div>
  );
}

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const t = useT();
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "off" | "on">("loading");
  const [error, setError] = useState<ErrCode | null>(null);

  useEffect(() => {
    (async () => {
      if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : reg ? "off" : "unsupported");
    })().catch(() => setState("unsupported"));
  }, [vapidKey]);

  const enable = async () => {
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapidKey) });
      const r = await savePushSubscriptionAction(sub.toJSON());
      if (r.ok) setState("on"); else { setError(r.error); await sub.unsubscribe(); }
    } catch { setError("generic"); }
  };
  const disable = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await removePushSubscriptionAction(sub.endpoint); await sub.unsubscribe(); }
    setState("off");
  };

  return (
    <div className="card p-5 grid gap-3">
      <h2 className="text-xl">{t("notifications.pushTitle")}</h2>
      <p className="text-sm text-muted">{t("notifications.pushBody")}</p>
      {state === "unsupported" && <Notice>{t("notifications.unsupported")}</Notice>}
      {state === "denied" && <Notice tone="care">{t("notifications.denied")}</Notice>}
      <ErrorNote code={error} />
      {state === "off" && <button className="btn btn-primary" onClick={enable}><AppIcon name="bell" size={18} /> {t("notifications.enable")}</button>}
      {state === "on" && <button className="btn" onClick={disable}>{t("notifications.disable")}</button>}
    </div>
  );
}

export function PasswordForm() {
  const t = useT();
  const [error, setError] = useState<ErrCode | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget; const f = new FormData(form);
      setError(null); setOk(false);
      start(async () => { const r = await changePasswordAction({ current: String(f.get("current")), next: String(f.get("next")) }); if (r.ok) { setOk(true); form.reset(); } else setError(r.error); });
    }}>
      <label><span className="label">{t("account.currentPassword")}</span><input className="field" name="current" type="password" autoComplete="current-password" required /></label>
      <label><span className="label">{t("account.newPassword")}</span><input className="field" name="next" type="password" autoComplete="new-password" minLength={8} required /></label>
      <ErrorNote code={error} />
      {ok && <Notice tone="good">{t("account.passwordChanged")}</Notice>}
      <button className="btn" disabled={pending}>{t("account.changePassword")}</button>
    </form>
  );
}

export function SignOutButton() {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button className="btn w-full" disabled={pending} onClick={() => start(() => signOutAction())}>
      <AppIcon name="logout" size={18} /> {t("account.signOut")}
    </button>
  );
}
