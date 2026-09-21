import { IconBadge, PageHeader, Section } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";

export default async function PrivacyPage() {
  const v = await requireViewer();
  const { t } = await getT();
  const points = v.role === "her" ? t.arr("privacy.pointsHer") : t.arr("privacy.pointsPartner");
  const rooms = [
    { icon: "her", tone: "rose", name: t("nav.her"), text: t("privacy.her") },
    { icon: "refuge", tone: "mauve", name: t("nav.refuge"), text: t("privacy.refuge") },
    { icon: "us", tone: "gold", name: t("nav.us"), text: t("privacy.us") },
  ] as const;
  return (
    <>
      <PageHeader title={t("settings.privacy")} subtitle={t("privacy.philosophy")} back="/settings" backLabel={t("common.back")} />
      <Section title={t("privacy.threeWorlds")}>
        <ul className="grid gap-4">
          {rooms.map((r) => (
            <li key={r.name} className="flex gap-4 items-start">
              <IconBadge name={r.icon} tone={r.tone} />
              <div><strong className="font-display text-xl font-medium">{r.name}</strong><p className="text-sm text-muted">{r.text}</p></div>
            </li>
          ))}
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
