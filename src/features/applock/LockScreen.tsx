"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { beginBiometricUnlockAction, finishBiometricUnlockAction, unlockAppAction } from "@/actions/applock";
import { AllyzaMark, AppIcon } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { SignOutButton } from "@/components/SettingsForms";
import { getPasskeyAssertion, markSessionAlive } from "@/lib/webauthn";
import { useI18n } from "@/lib/i18n/provider";
import type { ErrCode } from "@/lib/action-utils";

type Props = { method: "pin" | "password" | "biometric"; locked: boolean };

/**
 * Shown INSTEAD of the app while protection is on and the session is locked: the pages behind it
 * are never rendered to the browser, so there is nothing underneath to peek at.
 */
export function LockScreen({ method, locked }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"biometric" | "pin" | "password">(method === "biometric" ? "biometric" : method);
  const [pinValue, setPinValue] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<ErrCode | null>(locked ? "app_locked" : null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [shake, setShake] = useState(false);

  const done = () => { markSessionAlive(); router.refresh(); };
  const fail = (e: ErrCode) => { setError(e); setShake(true); setTimeout(() => setShake(false), 400); };

  const submitSecret = (secret: string) => start(async () => {
    setError(null); setNote(null);
    const r = await unlockAppAction({ secret });
    if (r.ok) done(); else { setPinValue(""); setPw(""); fail(r.error); }
  });

  const biometric = () => start(async () => {
    setError(null); setNote(null);
    try {
      const begin = await beginBiometricUnlockAction();
      if (!begin.ok) { fail(begin.error); return; }
      const opts = begin.data as { challenge: string; credentialIds: string[]; rpId: string };
      const assertion = await getPasskeyAssertion(opts);
      const r = await finishBiometricUnlockAction(assertion);
      if (r.ok) done(); else fail(r.error);
    } catch (e) {
      // The system refused or the person cancelled: say so, and leave the backup PIN one tap away.
      setNote(t((e as DOMException)?.name === "NotAllowedError" ? "applock.biometricCancelled" : "applock.biometricFailed"));
    }
  });

  const press = (d: string) => { if (pending) return; setPinValue((v) => (v.length < 8 ? v + d : v)); setError(null); };

  return (
    <div className="min-h-dvh grid place-items-center px-6 py-10 text-center" style={{ background: "radial-gradient(120% 90% at 30% 10%, #4a2a66 0%, #24123f 45%, #120a2a 100%)", color: "#fff" }}>
      <div className="w-full max-w-xs grid gap-6 justify-items-center">
        <AllyzaMark height={44} />
        <div>
          <h1 className="font-display text-3xl">{t("applock.lockedTitle")}</h1>
          <p className="text-sm opacity-75 mt-1">{t(mode === "password" ? "applock.enterPassword" : mode === "pin" ? "applock.enterPin" : "applock.biometricPrompt")}</p>
        </div>

        {mode === "biometric" && (
          <div className="grid gap-3 w-full">
            <button type="button" onClick={biometric} disabled={pending || locked}
              className="mx-auto size-24 rounded-full grid place-items-center bg-white/15 border border-white/20 backdrop-blur-xl transition active:scale-95 disabled:opacity-50">
              <AppIcon name="shield" size={40} label={t("applock.useBiometric")} />
            </button>
            <p className="text-sm opacity-85">{t("applock.useBiometric")}</p>
            <button type="button" className="text-sm underline underline-offset-4 opacity-80" onClick={() => { setMode("pin"); setError(null); setNote(null); }}>{t("applock.usePin")}</button>
          </div>
        )}

        {mode === "pin" && (
          <div className={`grid gap-5 w-full ${shake ? "animate-pulse" : ""}`}>
            <div className="flex justify-center gap-3 h-4" aria-label={`${pinValue.length}`}>
              {Array.from({ length: Math.max(4, pinValue.length) }, (_, i) => (
                <span key={i} className={`size-3.5 rounded-full border border-white/50 transition ${i < pinValue.length ? "bg-white scale-110" : ""}`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 justify-items-center">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} type="button" onClick={() => press(d)} disabled={locked}
                  className="size-[4.25rem] rounded-full bg-white/12 border border-white/15 text-2xl font-display backdrop-blur-xl transition active:scale-90 active:bg-white/25 disabled:opacity-40">{d}</button>
              ))}
              <button type="button" aria-label={t("common.delete")} onClick={() => setPinValue((v) => v.slice(0, -1))} className="size-[4.25rem] rounded-full grid place-items-center opacity-80 active:scale-90"><AppIcon name="back" size={24} /></button>
              <button type="button" onClick={() => press("0")} disabled={locked} className="size-[4.25rem] rounded-full bg-white/12 border border-white/15 text-2xl font-display backdrop-blur-xl transition active:scale-90 active:bg-white/25 disabled:opacity-40">0</button>
              <button type="button" aria-label={t("applock.unlock")} disabled={pinValue.length < 4 || pending || locked} onClick={() => submitSecret(pinValue)}
                className="size-[4.25rem] rounded-full grid place-items-center bg-white text-[#3b1f52] transition active:scale-90 disabled:opacity-30"><AppIcon name="check" size={26} /></button>
            </div>
            {method === "biometric" && <button type="button" className="text-sm underline underline-offset-4 opacity-80" onClick={() => { setMode("biometric"); setError(null); setPinValue(""); }}>{t("applock.useBiometric")}</button>}
          </div>
        )}

        {mode === "password" && (
          <form className="grid gap-3 w-full" onSubmit={(e) => { e.preventDefault(); if (pw) submitSecret(pw); }}>
            <input type="password" autoComplete="off" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setError(null); }} aria-label={t("applock.enterPassword")}
              className="w-full rounded-2xl bg-white/12 border border-white/20 px-4 py-3.5 text-center text-lg text-white placeholder-white/40 outline-none focus:border-white/60" />
            <button className="btn btn-primary w-full" disabled={!pw || pending || locked}>{t("applock.unlock")}</button>
          </form>
        )}

        <div className="w-full text-left text-[#ffb4c1]"><ErrorNote code={error} /></div>
        {note && <p role="status" className="text-sm opacity-85">{note}</p>}

        <div className="opacity-70 pt-2"><SignOutButton /></div>
      </div>
    </div>
  );
}
