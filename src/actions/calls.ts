"use server";
import { z } from "zod";
import { fail, ok, rateLimit, uuid } from "@/lib/action-utils";
import { coupleCtx } from "@/lib/couple-ctx";
import { pingPartner } from "@/lib/push";

const STUN_FALLBACK: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/**
 * Temporary, time-limited TURN credentials for this call only — minted server-side from
 * Twilio's Network Traversal Service so the account secret never reaches the browser.
 * Without TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN configured, calls still work over STUN
 * alone (fine on the same network or many home routers; not reliable across all NATs).
 */
export async function getIceServersAction() {
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return ok(STUN_FALLBACK);
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    });
    if (!res.ok) return ok(STUN_FALLBACK);
    const data = (await res.json()) as { ice_servers?: { url?: string; urls?: string; username?: string; credential?: string }[] };
    const servers: RTCIceServer[] = (data.ice_servers ?? [])
      .map((s) => ({ urls: s.urls ?? s.url ?? "", username: s.username, credential: s.credential }))
      .filter((s) => s.urls);
    return ok(servers.length ? servers : STUN_FALLBACK);
  } catch {
    return ok(STUN_FALLBACK);
  }
}

export async function startCallAction(input: { kind: "audio" | "video" }) {
  const p = z.object({ kind: z.enum(["audio", "video"]) }).safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  if (!c.couple.partner_id) return fail("forbidden");
  if (!rateLimit(`call:${c.uid}`, 20, 60_000)) return fail("rate");
  const calleeId = c.uid === c.couple.her_id ? c.couple.partner_id : c.couple.her_id;

  // A call that never got closed (app killed mid-ring, phone died) must not block every future call.
  const now = Date.now();
  await c.supabase.from("calls").update({ status: "missed", ended_at: new Date(now).toISOString() })
    .eq("couple_id", c.couple.id).eq("status", "ringing").lt("started_at", new Date(now - 90_000).toISOString());
  await c.supabase.from("calls").update({ status: "ended", ended_at: new Date(now).toISOString() })
    .eq("couple_id", c.couple.id).eq("status", "accepted").lt("answered_at", new Date(now - 4 * 3600_000).toISOString());

  const { data: active } = await c.supabase.from("calls").select("id").eq("couple_id", c.couple.id).in("status", ["ringing", "accepted"]).limit(1);
  if (active?.length) return fail("busy");

  const { data, error } = await c.supabase
    .from("calls")
    .insert({ couple_id: c.couple.id, caller_id: c.uid, callee_id: calleeId, kind: p.data.kind })
    .select("id, caller_id, callee_id, kind, status, started_at")
    .single();
  if (error || !data) return fail("generic");
  void pingPartner("call");
  return ok(data);
}

const statusInput = z.object({
  id: uuid,
  status: z.enum(["accepted", "rejected", "cancelled", "missed", "ended", "failed"]),
});

export async function updateCallStatusAction(input: z.infer<typeof statusInput>) {
  const p = statusInput.safeParse(input);
  if (!p.success) return fail("invalid");
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const patch: Record<string, string> = { status: p.data.status };
  if (p.data.status === "accepted") patch.answered_at = new Date().toISOString();
  if (p.data.status !== "accepted") patch.ended_at = new Date().toISOString();
  const { error } = await c.supabase.from("calls").update(patch).eq("id", p.data.id).eq("couple_id", c.couple.id);
  if (error) return fail("generic");
  return ok();
}

/** Catches an incoming call that started just before this device subscribed to live updates. */
export async function myActiveCallAction() {
  const c = await coupleCtx();
  if (!c) return fail("auth");
  const { data } = await c.supabase
    .from("calls")
    .select("id, caller_id, callee_id, kind, status, started_at")
    .eq("couple_id", c.couple.id)
    .in("status", ["ringing", "accepted"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ok(data ?? null);
}
