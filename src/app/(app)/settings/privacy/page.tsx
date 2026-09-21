import { PageHeader, Section } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";

export default async function PrivacyPage() {
  const v = await requireViewer();
  const { t } = await getT();
  const points = v.role === "her" ? t.arr("privacy.pointsHer") : t.arr("privacy.pointsPartner");
  return (
    <>
      <PageHeader title={t("settings.privacy")} subtitle={t("privacy.philosophy")} back="/settings" backLabel={t("common.back")} />
      <Section title={t("privacy.threeWorlds")}>
        <ul className="grid gap-3">
          <li><span aria-hidden>🌷</span> <strong>{t("nav.her")}</strong> — {t("privacy.her")}</li>
          <li><span aria-hidden>🌙</span> <strong>{t("nav.refuge")}</strong> — {t("privacy.refuge")}</li>
          <li><span aria-hidden>💕</span> <strong>{t("nav.us")}</strong> — {t("privacy.us")}</li>
        </ul>
      </Section>
      <Section title={t("privacy.howTitle")}>
        <ul className="grid gap-2 list-disc pl-5 text-sm text-muted">
          {points.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </Section>
      <p className="text-xs text-muted text-center text-balance">{t("care.notMedical")}</p>
    </>
  );
}
