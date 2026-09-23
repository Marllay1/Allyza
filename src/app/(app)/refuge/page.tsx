import { ClientOnly } from "@/components/ClientOnly";
import { AppIcon } from "@/components/icons";
import { PageHeader, Section, TileLink } from "@/components/ui";
import { UnreadDot } from "@/components/UnreadDot";
import { RefugeNote } from "@/components/RefugeNote";
import { Companion } from "@/features/refuge/Companion";
import { StatusCard } from "@/features/home/StatusCard";
import { getPartner } from "@/lib/nickname";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";

/** Her Refuge; for him this same tab becomes "Her" — a gentle read on her day, never the tracker itself. */
export default async function RefugeHub() {
  const v = await requireViewer();
  const { t } = await getT();

  if (v.role !== "her") {
    const herName = (await getPartner())?.name ?? t("partner.herFallback");
    return (
      <>
        <PageHeader title={herName} subtitle={t("partner.careSubtitle", { name: herName })} />
        <Section title={t("partner.today", { name: herName })}>
          <ClientOnly fallback={<p className="text-sm text-muted">{t("common.loading")}</p>}>
            <StatusCard name={herName} />
          </ClientOnly>
          <p className="text-xs text-muted mt-4 inline-flex items-center gap-1.5"><AppIcon name="lock" size={13} /> {t("partner.onlyShared", { name: herName })}</p>
        </Section>
        <div className="grid gap-3">
          <TileLink href="/refuge/messages" icon="mail" tone="gold" title={t("partner.sendMessage")} text={t("partner.sendMessageText")} />
          <TileLink href="/us/surprises" icon="surprise" tone="rose" title={t("partner.leaveSurprise")} text={t("partner.leaveSurpriseText")} right={<UnreadDot kinds={["surprise"]} />} />
        </div>
      </>
    );
  }

  const partnerName = (await getPartner())?.name ?? t("couple.partnerFallback");

  return (
    <>
      <PageHeader title={t("refuge.title")} subtitle={t("refuge.here")} />

      <ClientOnly><Companion partnerName={partnerName} /></ClientOnly>
      <ClientOnly><RefugeNote notes={t.arr("refuge.notes")} label={t("refuge.littleNote")} /></ClientOnly>

      <h2 className="text-[1.7rem] mb-3">{t("refuge.needTitle")}</h2>
      <div className="grid gap-3 mb-8">
        <TileLink href="/refuge/atmosphere" icon="calm" tone="mauve" title={t("refuge.need.calm")} text={t("refuge.need.calmText")} />
        <TileLink href="/refuge/games" icon="distract" tone="rose" title={t("refuge.need.distract")} text={t("refuge.need.distractText")} />
        <TileLink href="/refuge/messages" icon="love" tone="gold" title={t("refuge.need.love")} text={t("refuge.need.loveText", { name: partnerName })} right={<UnreadDot kinds={["refuge"]} />} />
        <TileLink href="/refuge/poetry" icon="read" tone="accent" title={t("refuge.need.read")} text={t("refuge.need.readText")} />
        <TileLink href="/us/music" icon="musicNote" tone="mauve" title={t("refuge.need.music")} text={t("refuge.need.musicText")} />
        <TileLink href="/us" icon="us" tone="gold" title={t("refuge.need.us")} text={t("refuge.need.usText")} right={<UnreadDot kinds={["surprise", "journal", "little", "media"]} />} />
      </div>

      <h2 className="text-[1.4rem] mb-3 text-muted">{t("refuge.alsoTitle")}</h2>
      <div className="grid gap-3">
        <TileLink href="/refuge/soft" icon="soft" tone="rose" title={t("soft.title")} text={v.prefs.soft_mode ? t("soft.on") : t("soft.tagline")} />
        <TileLink href="/refuge/breathe" icon="breathe" tone="mauve" title={t("refuge.breathe")} text={t("refuge.breatheText")} />
        <TileLink href="/refuge/little" icon="little" tone="gold" title={t("refuge.little")} text={t("refuge.littleText")} />
      </div>
    </>
  );
}
