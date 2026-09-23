import { GAME_CATEGORIES, GAME_ICON } from "@/lib/games";
import { PageHeader, TileLink } from "@/components/ui";
import { GameLevelBadge } from "@/features/refuge/GameLevelBadge";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function GamesPage() {
  await requireHer();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("refuge.games")} subtitle={t("games.subtitle")} back="/refuge" backLabel={t("common.back")} />
      <div className="grid gap-7">
        {GAME_CATEGORIES.map((cat) => (
          <section key={cat.id}>
            <h2 className="eyebrow mb-2.5 px-1">{t(`games.categories.${cat.id}`)}</h2>
            <div className="grid gap-3">
              {cat.games.map((g) => (
                <TileLink key={g} href={`/refuge/games/${g}`} icon={GAME_ICON[g]} title={t(`games.names.${g}`)} text={t(`games.desc.${g}`)}
                  right={<GameLevelBadge gameId={g} />} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs text-muted text-center mt-8">{t("games.noPressure")}</p>
    </>
  );
}
