import { AppIcon } from "@/components/icons";
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
        <TileLink href="/her/cycle" icon="cycle" tone="rose" title={t("her.cycle")} text={t("her.cycleText")} />
        <TileLink href="/her/wellbeing" icon="wellbeing" tone="mauve" title={t("her.wellbeing")} text={t("her.wellbeingText")} />
        <TileLink href="/her/food" icon="food" tone="gold" title={t("her.food")} text={t("her.foodText")} />
        <TileLink href="/her/history" icon="history" tone="accent" title={t("her.history")} text={t("her.historyText")} />
        <TileLink href="/her/stats" icon="stats" tone="rose" title={t("her.stats")} text={t("her.statsText")} />
      </div>
      <p className="text-xs text-muted text-center mt-8 text-balance inline-flex items-center justify-center gap-1.5 w-full">
        <AppIcon name="lock" size={13} />{t("her.privateNote")}
      </p>
    </>
  );
}
