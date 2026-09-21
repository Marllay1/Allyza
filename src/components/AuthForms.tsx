"use client";
import { useState, useTransition } from "react";
import { signInAction } from "@/actions/auth";
import { AppIcon } from "@/components/icons";
import { ErrorNote } from "@/components/Feedback";
import { useT } from "@/lib/i18n/provider";
import type { ErrCode } from "@/lib/action-utils";

/** Username + password, once per device. The session then persists (secure cookie) until an explicit logout. */
export function LoginForm() {
  const t = useT();
  const [error, setError] = useState<ErrCode | null>(null);
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await signInAction({ username: String(f.get("username")), password: String(f.get("password")) });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <div>
        <h1 className="text-4xl">{t("auth.welcomeBack")}</h1>
        <p className="mt-2 text-muted">{t("auth.loginSub")}</p>
      </div>
      <label className="block">
        <span className="label">{t("auth.username")}</span>
        <input className="field" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
      </label>
      <label className="block">
        <span className="label">{t("auth.password")}</span>
        <span className="relative block">
          <input className="field !pr-14" name="password" type={show ? "text" : "password"} autoComplete="current-password" required />
          <button type="button" className="icon-btn absolute right-1 top-1/2 -translate-y-1/2 text-muted" aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")} aria-pressed={show} onClick={() => setShow((s) => !s)}>
            <AppIcon name={show ? "eyeOff" : "eye"} size={20} />
          </button>
        </span>
      </label>
      <ErrorNote code={error} />
      <button className="btn btn-primary !min-h-14 text-lg" disabled={pending}>
        {pending ? t("common.loading") : t("auth.enter")}
      </button>
      <p className="text-xs text-muted text-center inline-flex items-center justify-center gap-1.5">
        <AppIcon name="lock" size={13} /> {t("auth.privateNote")}
      </p>
    </form>
  );
}
