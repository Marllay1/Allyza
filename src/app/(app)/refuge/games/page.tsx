import { GAME_ICON, GAME_IDS } from "@/lib/games";
import { PageHeader, TileLink } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function GamesPage() {
  await requireHer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("refuge.games")} subtitle={t("games.subtitle")} back="/refuge" backLabel={t("common.back")} />
      <div className="grid gap-3">
        {GAME_IDS.map((g) => (
          <TileLink key={g} href={`/refuge/games/${g}`} icon={GAME_ICON[g]} title={t(`games.names.${g}`)} text={t(`games.desc.${g}`)} />
        ))}
      </div>
      <p className="text-xs text-muted text-center mt-8">{t("games.noPressure")}</p>
    </>
  );
}
