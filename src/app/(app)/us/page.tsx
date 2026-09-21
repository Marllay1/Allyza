import { PageHeader, TileLink } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function UsHub() {
  const v = await requireViewer();
  if (!v.couple) redirect("/home");
  const { t } = await getT();
  const waiting = !v.couple.partnerId;
  return (
    <>
      <PageHeader title={t("couple.title")} subtitle={t("couple.subtitle")} />
      {waiting && <p className="card p-4 mb-4 text-sm text-muted">{t("couple.waiting")}</p>}
      <div className="grid gap-3">
        <TileLink href="/us/journal" icon="📖" title={t("couple.journal")} text={t("couple.journalText")} />
        <TileLink href="/us/memories" icon="📷" title={t("couple.memories")} text={t("couple.memoriesText")} />
        <TileLink href="/us/little" icon="💗" title={t("couple.little")} text={t("couple.littleText")} />
        <TileLink href="/us/vault" icon="🗝️" title={t("couple.vault")} text={t("couple.vaultText")} />
      </div>
      <p className="text-xs text-muted text-center mt-8 text-balance">{t("couple.privacyNote")}</p>
    </>
  );
}
