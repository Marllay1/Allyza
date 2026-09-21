"use client";
import { useT } from "@/lib/i18n/provider";
import type { ErrCode } from "@/lib/action-utils";

export function ErrorNote({ code }: { code?: ErrCode | null }) {
  const t = useT();
  if (!code) return null;
  return (
    <p role="alert" className="text-sm text-[#d0566a] rounded-xl border border-[#d0566a]/30 px-3 py-2">
      {t(`errors.${code}`)}
    </p>
  );
}

export function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "good" | "care" }) {
  const tones = {
    info: "border-line text-muted",
    good: "border-good/40 text-ink",
    care: "border-warn/40 text-ink",
  };
  return <div role="status" className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}
