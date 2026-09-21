import { PageHeader, TileLink } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function HerHub() {
  await requireHer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("her.title")} subtitle={t("her.subtitle")} />
      <div className="grid gap-3">
        <TileLink href="/her/cycle" icon="🌷" title={t("her.cycle")} text={t("her.cycleText")} />
        <TileLink href="/her/wellbeing" icon="🌿" title={t("her.wellbeing")} text={t("her.wellbeingText")} />
        <TileLink href="/her/food" icon="🍎" title={t("her.food")} text={t("her.foodText")} />
        <TileLink href="/her/history" icon="📖" title={t("her.history")} text={t("her.historyText")} />
        <TileLink href="/her/stats" icon="📊" title={t("her.stats")} text={t("her.statsText")} />
      </div>
      <p className="text-xs text-muted text-center mt-8 text-balance">{t("her.privateNote")}</p>
    </>
  );
}
