"use client";
import { useEffect, useState } from "react";
import { AppIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/provider";
import { useNightMode } from "@/lib/local-pref";

/**
 * "Bonne nuit, vous deux." — a slow curtain of three lines. It is only ever started by hand and
 * afterwards leaves the whole app a little dimmer and calmer until morning (or until she taps the sun).
 */
export function GoodNightCurtain() {
  const t = useT();
  const night = useNightMode();
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0); // 0 hidden · 1 good night · 2 see you tomorrow · 3 fading out
  const [seen, setSeen] = useState(false);

  // Play the curtain once each time night mode is switched on.
  useEffect(() => {
    if (!night) { const id = setTimeout(() => setSeen(false), 0); return () => clearTimeout(id); }
    if (seen) return;
    const ids = [
      setTimeout(() => { setSeen(true); setStage(1); }, 0),
      setTimeout(() => setStage(2), 3600),
      setTimeout(() => setStage(3), 7000),
      setTimeout(() => setStage(0), 8800),
    ];
    return () => ids.forEach(clearTimeout);
  }, [night, seen]);

  if (!night) return null;
  return (
    <>
      <div className="night-dim" aria-hidden />
      {stage > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("night.title")}
          onClick={() => setStage(3)}
          className="fixed inset-0 z-[60] grid place-items-center text-center px-8"
          style={{ background: "radial-gradient(120% 100% at 50% 30%, #241344, #07030f)", opacity: stage === 3 ? 0 : 1, transition: "opacity 1.6s var(--ease-soft)", animation: "curtain 1.6s var(--ease-soft) both" }}
        >
          <div className="text-[#f8ece6]">
            <div className="mx-auto mb-6 grid place-items-center size-16 rounded-full border border-white/15 bg-white/5">
              <AppIcon name="moon" size={28} className="text-[#f7d3bc]" />
            </div>
            <p key={stage} className="font-display text-4xl sm:text-5xl leading-tight rise">{stage === 2 ? t("night.tomorrow") : t("night.title")}</p>
            {stage === 1 && <p className="mt-3 text-[#b7a6c9] rise" style={{ animationDelay: "0.8s" }}>{t("night.sub")}</p>}
          </div>
        </div>
      )}
    </>
  );
}
