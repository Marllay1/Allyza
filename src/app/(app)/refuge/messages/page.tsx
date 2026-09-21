import { MessagesClient, type Msg } from "@/components/MessagesClient";
import { PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("refuge_messages").select("id, author_id, body, opened_at, created_at").order("created_at", { ascending: false }).limit(60);
  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  let other = t("couple.partnerFallback");
  if (otherId) {
    const { data: p } = await supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle();
    if (p?.display_name) other = p.display_name;
  }
  const isHer = v.role === "her";
  return (
    <>
      <PageHeader title={isHer ? t("refuge.messages") : t("partner.sendMessage")} subtitle={isHer ? t("refuge.messagesText") : t("partner.sendMessageText")} back={isHer ? "/refuge" : "/home"} backLabel={t("common.back")} />
      <MessagesClient coupleId={v.couple.id} myId={v.id} msgs={(data ?? []) as Msg[]} names={{ other }} canSend={!!v.couple.partnerId} />
    </>
  );
}
