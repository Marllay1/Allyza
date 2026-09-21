"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/actions/prefs";
import { useI18n } from "@/lib/i18n/provider";
import { LOCALES } from "@/lib/i18n/config";

/** FR | EN — persists in a cookie (and in the profile when signed in). */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("settings.language")}
      className={`inline-flex items-center rounded-full border border-line p-0.5 text-sm ${className}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          disabled={pending}
          onClick={() => start(async () => { await setLocaleAction(l); router.refresh(); })}
          className={`min-w-11 min-h-9 rounded-full px-3 uppercase tracking-wider transition ${
            locale === l ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
