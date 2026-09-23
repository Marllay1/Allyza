"use client";
import Link from "next/link";
import { AppIcon } from "@/components/icons";
import { ClientOnly } from "@/components/ClientOnly";
import { useUnread } from "@/components/AppShell";
import { Section, TileLink } from "@/components/ui";
import { Greeting } from "@/features/home/Greeting";
import { StatusCard } from "@/features/home/StatusCard";
import { useT } from "@/lib/i18n/provider";
import { startNight } from "@/lib/local-pref";

/** His Home: a quiet read on her (full detail lives on the "Her" tab) and a place to leave her something —
 * nothing here repeats a navbar destination as a big button; Refuge/Us/Messages stay one tap away in the bar. */
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
        {fromHer > 0 && (
          <Link href="/us" className="text-sm text-accent mt-3 inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose pop-in" role="status" aria-label={t("nav.new")} /> {t("home.usLeft", { name: herName })}
          </Link>
        )}
      </Section>

      <div className="grid gap-3 mb-4">
        <TileLink href="/write" icon="penLine" tone="rose" title={t("partner.writeTitle")} text={t("partner.writeCard", { name: herName })} />
      </div>

      <div className="flex justify-center pt-2">
        <button className="btn btn-ghost text-sm" onClick={startNight}><AppIcon name="night" size={16} /> {t("night.start")}</button>
      </div>
    </>
  );
}
