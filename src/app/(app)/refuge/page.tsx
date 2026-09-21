import { redirect } from "next/navigation";
import { RefugeNote } from "@/components/RefugeNote";
import { PageHeader, TileLink } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function RefugeHub() {
  const v = await requireViewer();
  // The Refuge is her well-being space. He only ever reaches the "send her a message" corner.
  if (v.role !== "her") redirect("/refuge/messages");
  const { t } = await getT();
  const supabase = await createClient();
  const { count } = await supabase.from("refuge_messages").select("id", { count: "exact", head: true }).is("opened_at", null).neq("author_id", v.id);

  return (
    <>
      <PageHeader title={t("refuge.title")} subtitle={t("refuge.welcome")} />
      <RefugeNote notes={t.arr("refuge.notes")} label={t("refuge.littleNote")} />
      <Link href="/refuge/atmosphere" className="btn btn-primary w-full !min-h-14 text-lg mb-4">🌧️ {t("refuge.needCalm")}</Link>
      <div className="grid gap-3">
        <TileLink href="/refuge/soft" icon="🌸" title={t("soft.title")} text={v.prefs.soft_mode ? t("soft.on") : t("soft.tagline")} />
        <TileLink href="/refuge/messages" icon="💌" title={t("refuge.messageFromHim")} text={t("refuge.messagesText")} badge={!!count} />
        <TileLink href="/refuge/games" icon="🎮" title={t("refuge.games")} text={t("refuge.gamesText")} />
        <TileLink href="/refuge/atmosphere" icon="🌧️" title={t("refuge.atmosphere")} text={t("refuge.atmosphereText")} />
        <TileLink href="/refuge/poetry" icon="📖" title={t("refuge.poetry")} text={t("refuge.poetryText")} />
        <TileLink href="/refuge/breathe" icon="🌿" title={t("refuge.breathe")} text={t("refuge.breatheText")} />
        <TileLink href="/refuge/little" icon="☁️" title={t("refuge.little")} text={t("refuge.littleText")} />
        <TileLink href="/us" icon="🫶" title={t("nav.us")} text={t("home.us")} />
      </div>
    </>
  );
}
