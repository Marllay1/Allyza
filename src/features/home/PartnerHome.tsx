"use client";
import { AppIcon } from "@/components/icons";
import { ClientOnly } from "@/components/ClientOnly";
import { useUnread } from "@/components/AppShell";
import { Section, TileLink } from "@/components/ui";
import { Greeting } from "@/features/home/Greeting";
import { StatusCard } from "@/features/home/StatusCard";
import { useT } from "@/lib/i18n/provider";
import { startNight } from "@/lib/local-pref";

/** His Home: a quick read on her (full detail lives on the "Her" tab), then the three rooms he has. */
export function PartnerHome({ myName, herName }: { myName: string; herName: string }) {
  const t = useT();
  const { unread } = useUnread();
  const fromHer = unread.journal + unread.media + unread.little + unread.surprise + unread.refuge;

  return (
    <>
      <ClientOnly><Greeting name={myName} /></ClientOnly>

      <Section title={t("partner.today", { name: herName })}>
        <ClientOnly fallback={<p className="text-sm text-muted">{t("common.loading")}</p>}>
          <StatusCard name={herName} compact />
        </ClientOnly>
        <p className="text-xs text-muted mt-4 inline-flex items-center gap-1.5"><AppIcon name="lock" size={13} /> {t("partner.onlyShared", { name: herName })}</p>
      </Section>

      <div className="grid gap-3 mb-4">
        <TileLink href="/refuge" icon="love" tone="rose" title={t("nav.her")} text={t("partner.careCard", { name: herName })} />
        <TileLink href="/us" icon="us" tone="gold" title={t("nav.us")} text={fromHer > 0 ? t("home.usLeft", { name: herName }) : t("home.usCard")} right={fromHer > 0 ? <span className="size-2.5 rounded-full bg-rose pop-in" role="status" aria-label={t("nav.new")} /> : undefined} />
        <TileLink href="/messages" icon="message" tone="accent" title={t("nav.messaging")} text={t("partner.messagingCard", { name: herName })} right={unread.message > 0 ? <span className="size-2.5 rounded-full bg-rose pop-in" role="status" aria-label={t("nav.new")} /> : undefined} />
      </div>

      <div className="flex justify-center pt-2">
        <button className="btn btn-ghost text-sm" onClick={startNight}><AppIcon name="night" size={16} /> {t("night.start")}</button>
      </div>
    </>
  );
}
