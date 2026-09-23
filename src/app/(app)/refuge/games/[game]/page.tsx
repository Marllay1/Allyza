import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/games";
import { GAME_IDS, type GameId } from "@/lib/games";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireHer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  await requireHer();
  const { game } = await params;
  if (!(GAME_IDS as readonly string[]).includes(game)) notFound();
  const { t } = await getT();

  let photos: string[] | undefined;
  if (game === "puzzle") {
    const supabase = await createClient();
    const { data: media } = await supabase
      .from("couple_media")
      .select("storage_path")
      .neq("category", "journal")
      .order("created_at", { ascending: false })
      .limit(24);
    const paths = (media ?? []).map((m) => m.storage_path);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("couple-media").createSignedUrls(paths, 3600);
      photos = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
    }
  }

  return (
    <>
      <PageHeader title={t(`games.names.${game as GameId}`)} back="/refuge/games" backLabel={t("common.back")} />
      <GamePlayer id={game as GameId} photos={photos} />
    </>
  );
}
