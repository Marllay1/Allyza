import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/games";
import { GAME_IDS, type GameId } from "@/lib/games";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  await requireHer();
  const { game } = await params;
  if (!(GAME_IDS as readonly string[]).includes(game)) notFound();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t(`games.names.${game as GameId}`)} back="/refuge/games" backLabel={t("common.back")} />
      <GamePlayer id={game as GameId} />
    </>
  );
}
