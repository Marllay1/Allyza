"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/actions/auth";
import { useT } from "@/lib/i18n/provider";
import { ErrorNote, Notice } from "@/components/Feedback";
import type { ErrCode } from "@/lib/action-utils";

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" {...props} />
    </label>
  );
}

export function LoginForm({ notice }: { notice?: "deleted" | "link" | null }) {
  const t = useT();
  const [error, setError] = useState<ErrCode | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await signInAction({ email: String(f.get("email")), password: String(f.get("password")) });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <h1 className="text-3xl">{t("auth.signIn")}</h1>
      {notice === "deleted" && <Notice tone="good">{t("auth.accountDeleted")}</Notice>}
      {notice === "link" && <Notice tone="care">{t("auth.linkExpired")}</Notice>}
      <Field label={t("auth.email")} name="email" type="email" autoComplete="email" required />
      <Field label={t("auth.password")} name="password" type="password" autoComplete="current-password" required />
      <ErrorNote code={error} />
      <button className="btn btn-primary" disabled={pending}>{pending ? t("common.loading") : t("auth.signIn")}</button>
      <div className="flex justify-between text-sm text-muted">
        <Link href="/forgot" className="underline underline-offset-4">{t("auth.forgot")}</Link>
        <Link href="/signup" className="underline underline-offset-4">{t("auth.createAccount")}</Link>
      </div>
    </form>
  );
}

export function SignupForm() {
  const t = useT();
  const [role, setRole] = useState<"her" | "partner">("her");
  const [error, setError] = useState<ErrCode | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <div className="grid gap-4 text-center">
        <h1 className="text-3xl">{t("auth.checkEmailTitle")}</h1>
        <p className="text-muted">{t("auth.checkEmailBody")}</p>
        <Link href="/login" className="btn">{t("auth.signIn")}</Link>
      </div>
    );
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await signUpAction({
            email: String(f.get("email")),
            password: String(f.get("password")),
            displayName: String(f.get("name")),
            role,
          });
          if (r && !r.ok) setError(r.error);
          else if (r?.ok) setSent(true);
        });
      }}
    >
      <h1 className="text-3xl">{t("auth.createAccount")}</h1>
      <fieldset>
        <legend className="label">{t("auth.iAm")}</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(["her", "partner"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className="chip !min-h-16 flex-col !rounded-2xl !justify-center text-center"
            >
              <span className="text-ink font-medium">{t(`auth.role.${r}`)}</span>
              <span className="text-xs">{t(`auth.role.${r}Hint`)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Field label={t("auth.displayName")} name="name" autoComplete="nickname" maxLength={40} required />
      <Field label={t("auth.email")} name="email" type="email" autoComplete="email" required />
      <Field label={t("auth.password")} name="password" type="password" autoComplete="new-password" minLength={8} required />
      <p className="text-xs text-muted -mt-2">{t("auth.passwordHint")}</p>
      <ErrorNote code={error} />
      <button className="btn btn-primary" disabled={pending}>{pending ? t("common.loading") : t("auth.createAccount")}</button>
      <p className="text-sm text-muted text-center">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="underline underline-offset-4">{t("auth.signIn")}</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const t = useT();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <div className="grid gap-4 text-center">
        <h1 className="text-3xl">{t("auth.checkEmailTitle")}</h1>
        <p className="text-muted">{t("auth.resetSent")}</p>
        <Link href="/login" className="btn">{t("auth.signIn")}</Link>
      </div>
    );
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await forgotPasswordAction({ email: String(f.get("email")) });
          if (r.ok) setDone(true);
          else setError(r.error);
        });
      }}
    >
      <h1 className="text-3xl">{t("auth.forgot")}</h1>
      <Field label={t("auth.email")} name="email" type="email" autoComplete="email" required />
      <ErrorNote code={error} />
      <button className="btn btn-primary" disabled={pending}>{t("auth.sendReset")}</button>
      <Link href="/login" className="text-sm text-muted text-center underline underline-offset-4">{t("auth.signIn")}</Link>
    </form>
  );
}

export function ResetForm() {
  const t = useT();
  const [error, setError] = useState<ErrCode | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await resetPasswordAction({ password: String(f.get("password")) });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <h1 className="text-3xl">{t("auth.newPassword")}</h1>
      <Field label={t("auth.password")} name="password" type="password" autoComplete="new-password" minLength={8} required />
      <p className="text-xs text-muted -mt-2">{t("auth.passwordHint")}</p>
      <ErrorNote code={error} />
      <button className="btn btn-primary" disabled={pending}>{t("common.save")}</button>
    </form>
  );
}
