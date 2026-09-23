"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/action-utils";
import { getAuthUser } from "@/lib/supabase/request";

const kinds = z.array(z.enum(["journal", "media", "refuge", "little", "surprise", "message"])).max(4);

export async function markNotificationsReadAction(input: string[]) {
  const parsed = kinds.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const user = await getAuthUser();
  if (!user) return fail("auth");
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
    .in("kind", parsed.data);
  return ok();
}

const sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export async function savePushSubscriptionAction(input: unknown) {
  const parsed = sub.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const user = await getAuthUser();
  if (!user) return fail("auth");
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
    { onConflict: "endpoint" },
  );
  return error ? fail("generic") : ok();
}

export async function removePushSubscriptionAction(endpoint: string) {
  const user = await getAuthUser();
  if (!user) return fail("auth");
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return ok();
}
