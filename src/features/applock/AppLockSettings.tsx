"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  beginBiometricRegistrationAction, disableAppLockAction, finishBiometricRegistrationAction, lockAppNowAction, setAppLockAction, setIdleSecondsAction,
} from "@/actions/applock";
import { AppIcon } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { biometricAvailable, createPasskey, markSessionAlive } from "@/lib/webauthn";
import { useI18n } from "@/lib/i18n/provider";
import type { ErrCode } from "@/lib/action-utils";

type Method = "pin" | "password" | "biometric";
type Choice = "none" | Method;
const IDLE = [0, 60, 300, 900] as const;

export function AppLockSettings({ method, idleSeconds }: { method: Method | null; idleSeconds: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [current, setCurrent] = useState("");
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<ErrCode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bio, setBio] = useState<boolean | null>(null);
  const [pending, start] = useTransition();
  const enabled = method !== null;

  useEffect(() => { void biometricAvailable().then(setBio); }, []);

  const reset = () => { setChoice(null); setCurrent(""); setSecret(""); setConfirm(""); setError(null); };
  const finish = (msg: string) => { reset(); setMessage(msg); router.refresh(); };
  const open = (c: Choice) => { setChoice(c === choice ? null : c); setCurrent(""); setSecret(""); setConfirm(""); setError(null); setMessage(null); };

  const submit = () => start(async () => {
    setError(null); setMessage(null);
    if (choice === "none") {
      if (!window.confirm(t("applock.confirmDisable"))) return;
      const r = await disableAppLockAction({ current });
      if (r.ok) finish(t("applock.disabledDone")); else setError(r.error);
    } else if (choice === "pin" || choice === "password") {
      const r = await setAppLockAction({ method: choice, secret, confirm, current: enabled ? current : undefined });
      if (r.ok) { markSessionAlive(); finish(t(enabled ? "applock.changedDone" : "applock.enabledDone")); } else setError(r.error);
    } else if (choice === "biometric") {
      try {
        const begin = await beginBiometricRegistrationAction();
        if (!begin.ok) { setError(begin.error); return; }
        const pk = await createPasskey(begin.data as { challenge: string; userId: string; name: string; rpId: string });
        const r = await finishBiometricRegistrationAction({ ...pk, backupPin: secret, confirm, current: enabled ? current : undefined });
        if (r.ok) { markSessionAlive(); finish(t("applock.enabledDone")); } else setError(r.error);
      } catch (e) {
        setMessage(t((e as DOMException)?.name === "NotAllowedError" ? "applock.biometricCancelled" : "applock.biometricFailed"));
      }
    }
  });

  const options: { id: Choice; label: string; icon: "lock" | "key" | "shield" | "unlock"; disabled?: boolean }[] = [
    { id: "none", label: t("applock.none"), icon: "unlock" },
    { id: "pin", label: t("applock.pin"), icon: "lock" },
    { id: "password", label: t("applock.password"), icon: "key" },
    { id: "biometric", label: t("applock.biometric"), icon: "shield", disabled: bio === false },
  ];

  const needsNew = choice === "pin" || choice === "password" || choice === "biometric";
  const secretIsPin = choice === "pin" || choice === "biometric";

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <span className={`grid place-items-center size-11 rounded-2xl ${enabled ? "bg-good/20 text-good" : "bg-surface2 text-muted"}`}><AppIcon name={enabled ? "lock" : "unlock"} size={22} /></span>
        <div>
          <p className="font-display text-xl leading-tight">{t("applock.title")}</p>
          <p role="status" className={`text-sm ${enabled ? "text-good" : "text-muted"}`}>{enabled ? t("applock.statusOn") : t("applock.statusOff")}</p>
        </div>
      </div>
      <p className="text-sm text-muted">{t("applock.lead")}</p>

      <div className="grid gap-2" role="radiogroup" aria-label={t("applock.title")}>
        {options.map((o) => {
          const selected = (method ?? "none") === o.id;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={choice ? choice === o.id : selected} disabled={o.disabled || (o.id === "none" && !enabled)}
              onClick={() => open(o.id)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-45 ${(choice ?? (method ?? "none")) === o.id ? "border-accent bg-accent/10" : "border-line"}`}>
              <AppIcon name={o.icon} size={19} />
              <span className="flex-1">{o.label}</span>
              {selected && <span className="text-xs text-good inline-flex items-center gap-1"><AppIcon name="check" size={14} /> {t("applock.active")}</span>}
            </button>
          );
        })}
        {bio === false && <p className="text-xs text-muted">{t("applock.biometricUnavailable")}</p>}
      </div>

      {choice && (
        <form className="grid gap-3 rounded-2xl border border-line p-4 page-enter" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {enabled && (
            <label><span className="label">{t("applock.currentSecret")}</span>
              <input className="field" type="password" autoComplete="off" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
          )}
          {needsNew && (
            <>
              <label><span className="label">{choice === "password" ? t("applock.passwordLabel") : choice === "biometric" ? t("applock.backupPin") : t("applock.pinLabel")}</span>
                <input className="field" type="password" autoComplete="new-password" inputMode={secretIsPin ? "numeric" : "text"} pattern={secretIsPin ? "\\d{4,8}" : undefined} minLength={secretIsPin ? 4 : 6} maxLength={secretIsPin ? 8 : 72}
                  value={secret} onChange={(e) => setSecret(e.target.value)} required /></label>
              <label><span className="label">{choice === "password" ? t("applock.confirmPassword") : t("applock.confirmPin")}</span>
                <input className="field" type="password" autoComplete="new-password" inputMode={secretIsPin ? "numeric" : "text"} maxLength={secretIsPin ? 8 : 72} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label>
            </>
          )}
          {choice === "biometric" && <p className="text-xs text-muted">{t("applock.biometricNote")}</p>}
          <ErrorNote code={error} />
          <div className="flex gap-2">
            <button className={`btn flex-1 ${choice === "none" ? "" : "btn-primary"}`} disabled={pending || (needsNew && secret !== confirm)}>
              {choice === "none" ? t("applock.disable") : enabled ? t("applock.change") : t("applock.activate")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>{t("common.cancel")}</button>
          </div>
        </form>
      )}
      {message && <p role="status" className="text-sm text-good">{message}</p>}

      {enabled && !choice && (
        <>
          <label className="grid gap-1.5"><span className="label !mb-0">{t("applock.lockAfter")}</span>
            <select className="field" value={idleSeconds} onChange={(e) => start(async () => { const r = await setIdleSecondsAction({ seconds: Number(e.target.value) }); if (r.ok) router.refresh(); else setError(r.error); })}>
              {IDLE.map((s) => <option key={s} value={s}>{t(`applock.idle.${s}` as "applock.idle.0")}</option>)}
            </select>
          </label>
          <button type="button" className="btn" onClick={() => start(async () => { await lockAppNowAction(); router.refresh(); })}><AppIcon name="lock" size={18} /> {t("applock.lockNow")}</button>
          <p className="text-xs text-muted">{t("applock.separate")}</p>
        </>
      )}
    </div>
  );
}
