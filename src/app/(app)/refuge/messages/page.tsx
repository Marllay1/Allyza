import { LittleNoteClient, type Msg } from "@/features/refuge/LittleNoteClient";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { getMyNicknameForPartner } from "@/lib/nickname";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function LittleNotePage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("refuge_messages").select("id, author_id, body, opened_at, created_at").order("created_at", { ascending: false }).limit(60);
  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  let fallback = t("couple.partnerFallback");
  if (otherId) {
    const { data: p } = await supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle();
    if (p?.display_name) fallback = p.display_name;
  }
  const other = await getMyNicknameForPartner(otherId, fallback);
  const isHer = v.role === "her";
  return (
    <>
      <PageHeader title={isHer ? t("refuge.messages") : t("partner.sendMessage")} subtitle={isHer ? t("refuge.messagesText") : t("partner.sendMessageText")} back={isHer ? "/refuge" : "/home"} backLabel={t("common.back")} />
      <LittleNoteClient coupleId={v.couple.id} myId={v.id} msgs={(data ?? []) as Msg[]} names={{ other }} canSend={!!v.couple.partnerId} />
    </>
  );
}
