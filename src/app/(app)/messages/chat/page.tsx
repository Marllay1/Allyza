import { redirect } from "next/navigation";
import { ChatClient, type ChatMessage } from "@/features/messaging/ChatClient";
import { ChatHeader } from "@/features/messaging/ChatHeader";
import { CallButtons } from "@/features/messaging/CallSheet";
import { ChatInfoButton } from "@/features/messaging/ChatInfo";
import { getT } from "@/lib/i18n/server";
import { getMyNicknameForPartner } from "@/lib/nickname";
import { requireCouple } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reaction } from "@/lib/use-reactions";

export default async function MessagesChatPage() {
  const v = await requireCouple();
  const { t } = await getT();
  const supabase = await createClient();

  const otherId = v.id === v.couple.herId ? v.couple.partnerId : v.couple.herId;
  if (!otherId) redirect("/messages");

  const [{ data: messages }, { data: reactions }, { data: profiles }, { data: cursors }] = await Promise.all([
    supabase.from("messages").select("id, author_id, kind, body, storage_path, duration_ms, reply_to, edited_at, deleted_at, created_at").order("created_at", { ascending: false }).limit(150),
    supabase.from("reactions").select("id, target_type, target_id, emoji, author_id").eq("target_type", "message").limit(1000),
    supabase.from("profiles").select("id, display_name, avatar_path"),
    supabase.from("message_cursors").select("user_id, last_read_at"),
  ]);

  const otherProfile = profiles?.find((p) => p.id === otherId);
  const otherFallback = otherProfile?.display_name || t("couple.partnerFallback");
  const otherName = await getMyNicknameForPartner(otherId, otherFallback);
  const myCursor = cursors?.find((c) => c.user_id === v.id)?.last_read_at ?? null;
  const theirCursor = cursors?.find((c) => c.user_id === otherId)?.last_read_at ?? null;

  const imagePaths = (messages ?? []).filter((m) => m.kind === "image" && m.storage_path).map((m) => m.storage_path as string);
  let photos: string[] = [];
  if (imagePaths.length) {
    const { data: signed } = await supabase.storage.from("couple-media").createSignedUrls(imagePaths, 3600);
    photos = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
  }

  const otherTone = v.role === "her" ? "gold" : "rose";
  return (
    <>
      <ChatHeader
        name={otherName}
        avatar={otherProfile?.avatar_path ?? null}
        tone={otherTone}
        actions={<>
          <ChatInfoButton name={otherName} avatar={otherProfile?.avatar_path ?? null} tone={otherTone} photos={photos} />
          <CallButtons name={otherName} avatar={otherProfile?.avatar_path ?? null} tone={otherTone} />
        </>}
      />
      <ChatClient
        coupleId={v.couple.id}
        me={{ id: v.id, name: t("common.you"), avatar: null, tone: v.role === "her" ? "rose" : "gold" }}
        other={{ id: otherId, name: otherName, avatar: otherProfile?.avatar_path ?? null, tone: otherTone }}
        initialMessages={((messages ?? []) as ChatMessage[]).reverse()}
        initialReactions={(reactions ?? []) as Reaction[]}
        initialCursors={{ mine: myCursor, theirs: theirCursor }}
      />
    </>
  );
}
