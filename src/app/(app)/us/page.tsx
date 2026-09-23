import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIcon } from "@/components/icons";
import { PageHeader, TileLink } from "@/components/ui";
import { UnreadDot } from "@/components/UnreadDot";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function UsHub() {
  const v = await requireViewer();
  if (!v.couple) redirect("/home");
  const { t } = await getT();
  const supabase = await createClient();
  const { data: counts } = await supabase.rpc("couple_counts");
  const n = { memories: 0, photos: 0, letters: 0, ...(counts as object | null) } as { memories: number; photos: number; letters: number };

  return (
    <>
      <PageHeader title={t("couple.title")} subtitle={t("couple.subtitle")} />

      <Link href="/us/universe" className="card p-5 mb-4 flex items-center gap-4 overflow-hidden relative transition hover:-translate-y-0.5 active:scale-[0.985]" style={{ background: "radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--rose) 22%, var(--surface)), var(--surface) 65%)" }}>
        <AppIcon name="universe" size={34} className="text-gold" />
        <span className="flex-1 min-w-0">
          <span className="block font-display text-2xl leading-tight">{t("couple.universe")}</span>
          <span className="block text-sm text-muted">{t("universe.memories", { n: n.memories })} · {t("universe.photos", { n: n.photos })} · {t("universe.letters", { n: n.letters })}</span>
        </span>
        <AppIcon name="forward" size={18} className="text-muted" />
      </Link>

      <div className="grid gap-3">
        <TileLink href="/us/journal" icon="journal" tone="rose" title={t("couple.journal")} text={t("couple.journalNotebookText")} right={<UnreadDot kinds={["journal"]} />} />
        <TileLink href="/us/surprises" icon="surprise" tone="gold" title={t("couple.surprises")} text={t("couple.surprisesText")} right={<UnreadDot kinds={["surprise"]} />} />
        <TileLink href="/us/story" icon="story" tone="mauve" title={t("couple.story")} text={t("couple.storyText")} />
        <TileLink href="/us/memories" icon="memories" tone="rose" title={t("couple.memories")} text={t("couple.memoriesText")} right={<UnreadDot kinds={["media"]} />} />
        <TileLink href="/us/music" icon="song" tone="accent" title={t("couple.music")} text={t("couple.musicText")} />
        <TileLink href="/us/jokes" icon="jokes" tone="gold" title={t("couple.jokes")} text={t("couple.jokesText")} />
        <TileLink href="/us/little" icon="little" tone="mauve" title={t("couple.little")} text={t("couple.littleText")} right={<UnreadDot kinds={["little"]} />} />
        <TileLink href="/us/vault" icon="vault" tone="accent" title={t("couple.vault")} text={t("couple.vaultText")} />
      </div>

      <p className="text-sm text-muted text-center mt-8 text-balance inline-flex items-center justify-center gap-2 w-full">
        <AppIcon name="lock" size={14} /> <span><strong className="font-medium text-ink">{t("couple.privateTitle")}</strong> {t("couple.privateBody")}</span>
      </p>
    </>
  );
}
