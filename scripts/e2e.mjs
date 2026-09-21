// End-to-end check against a REAL Supabase project (uses .env.local).
// Creates two throwaway users, exercises privacy/realtime/storage/vault, then deletes them.
// Requires email confirmation to be OFF on the project while it runs.
// Run: node --env-file=.env.local scripts/e2e.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mk = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, svc, { auth: { persistSession: false } });

let failed = 0;
const check = (label, cond, extra = "") => { console.log(cond ? "ok  " : "FAIL", label, cond ? "" : extra); if (!cond) failed++; };
const stamp = Date.now();
const pw = "Test-" + stamp + "-pw!";
const users = {};

async function signup(role, name, key = role) {
  const c = mk();
  const email = `allyza.${key}.${stamp}@example.com`;
  const { data, error } = await c.auth.signUp({ email, password: pw, options: { data: { role, display_name: name, locale: "fr" } } });
  if (error) throw new Error("signup " + role + ": " + error.message);
  if (!data.session) throw new Error("no session (email confirmation must be off)");
  users[key] = { c, id: data.user.id };
  return c;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(150); } return false; };

try {
  const her = await signup("her", "Ada");
  const him = await signup("partner", "Bo", "him");
  const eve = await signup("partner", "Eve", "eve");
  check("signup created profile + couple for her", !!(await her.from("couples").select("id, invite_code").single()).data?.invite_code);
  const { data: couple } = await her.from("couples").select("id, invite_code").single();

  // Health data + privacy
  const today = new Date().toISOString().slice(0, 10);
  await her.from("periods").insert([{ start_date: "2026-07-21" }, { start_date: "2026-08-22" }]);
  const ins = await her.from("daily_logs").insert({ log_date: today, pain: 8, fatigue: 8, mood: 2, sugar_level: "high", note: "secret" });
  check("her can log her day", !ins.error, ins.error?.message);

  check("partner cannot join with wrong code", !!(await him.rpc("join_couple", { p_code: "WRONGCODE123" })).error);
  const join = await him.rpc("join_couple", { p_code: couple.invite_code });
  check("partner joins with invite code", !join.error, join.error?.message);
  check("second partner cannot reuse the code", !!(await eve.rpc("join_couple", { p_code: couple.invite_code })).error);

  check("partner reads 0 daily_logs", (await him.from("daily_logs").select("*")).data?.length === 0);
  check("partner reads 0 periods", (await him.from("periods").select("*")).data?.length === 0);
  check("partner reads 0 sharing_settings", (await him.from("sharing_settings").select("*")).data?.length === 0);
  let st = (await him.rpc("partner_shared_status", { p_today: today })).data;
  check("nothing shared by default", st.linked && st.pain === null && st.fatigue === null && st.mood === null && st.cycle_day === null);
  await her.from("sharing_settings").update({ share_fatigue: true, share_stats: true }).eq("her_id", users.her.id);
  st = (await him.rpc("partner_shared_status", { p_today: today })).data;
  check("shared fatigue arrives as a band only", st.fatigue === "high" && st.pain === null && st.mood === null);
  check("avg cycle shared (32)", Number(st.avg_cycle) === 32);
  await her.from("sharing_settings").update({ share_fatigue: false }).eq("her_id", users.her.id);
  check("revocation immediate", (await him.rpc("partner_shared_status", { p_today: today })).data.fatigue === null);
  const roleHack = await him.from("profiles").update({ role: "her" }).eq("id", users.him.id);
  check("clients cannot change their role", !!roleHack.error);

  // Realtime: journal INSERT reaches her; typing broadcast on private channel
  const received = [];
  const chan = her.channel(`journal:${couple.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "journal_entries", filter: `couple_id=eq.${couple.id}` }, (p) => received.push(p.new));
  let subscribed = false;
  chan.subscribe((s) => { if (s === "SUBSCRIBED") subscribed = true; });
  check("her subscribes to journal realtime", await until(() => subscribed));
  const typed = [];
  const typingHer = her.channel(`couple:${couple.id}`, { config: { private: true } }).on("broadcast", { event: "typing" }, (m) => typed.push(m.payload));
  let tSub = false;
  await her.realtime.setAuth();
  typingHer.subscribe((s, e) => { if (s === "SUBSCRIBED") tSub = true; });
  check("her joins the PRIVATE typing channel", await until(() => tSub));
  await wait(800);
  const post = await him.from("journal_entries").insert({ couple_id: couple.id, body: "coucou ❤️" }).select().single();
  check("partner writes in journal", !post.error, post.error?.message);
  check("REALTIME: her receives his entry live", await until(() => received.some((r) => r.body === "coucou ❤️")));
  const typingHim = him.channel(`couple:${couple.id}`, { config: { private: true } });
  let hSub = false;
  await him.realtime.setAuth();
  typingHim.subscribe((s) => { if (s === "SUBSCRIBED") hSub = true; });
  await until(() => hSub);
  await typingHim.send({ type: "broadcast", event: "typing", payload: { uid: users.him.id } });
  check("REALTIME: typing indicator reaches her", await until(() => typed.length > 0));
  const eveTyping = eve.channel(`couple:${couple.id}`, { config: { private: true } });
  let eveState = "";
  await eve.realtime.setAuth();
  eveTyping.subscribe((s) => { eveState = s; });
  await wait(2500);
  check("outsider is refused on the private channel", eveState !== "SUBSCRIBED", eveState);

  check("notification row created for her (contentless)", (await her.from("notifications").select("kind")).data?.[0]?.kind === "journal");
  check("outsider sees no journal", (await eve.from("journal_entries").select("*")).data?.length === 0);

  // Storage: private bucket, signed URLs, isolation
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const path = `${couple.id}/${stamp}.png`;
  const up = await him.storage.from("couple-media").upload(path, png, { contentType: "image/png" });
  check("partner uploads a photo to the couple folder", !up.error, up.error?.message);
  const signed = await her.storage.from("couple-media").createSignedUrl(path, 60);
  check("her gets a signed URL", !!signed.data?.signedUrl);
  const fetched = signed.data ? await fetch(signed.data.signedUrl) : { status: 0 };
  check("signed URL serves the image", fetched.status === 200);
  const pub = await fetch(`${url}/storage/v1/object/public/couple-media/${path}`);
  check("public URL does NOT work (bucket private)", pub.status >= 400, String(pub.status));
  check("outsider cannot sign that URL", !!(await eve.storage.from("couple-media").createSignedUrl(path, 60)).error);
  const bad = await eve.storage.from("couple-media").upload(`${couple.id}/evil.png`, png, { contentType: "image/png" });
  check("outsider cannot upload into the couple folder", !!bad.error);
  const exe = await him.storage.from("couple-media").upload(`${couple.id}/x.html`, Buffer.from("<script>1</script>"), { contentType: "text/html" });
  check("non-image upload rejected", !!exe.error);

  // Vault
  check("vault write blocked before unlock", !!(await her.from("vault_items").insert({ couple_id: couple.id, kind: "note", body: "x" })).error);
  check("set vault PIN", !(await her.rpc("vault_set_pin", { p_pin: "482913" })).error);
  await her.from("vault_items").insert({ couple_id: couple.id, kind: "letter", title: "t", body: "lettre secrète" });
  check("partner locked out of vault", (await him.from("vault_items").select("*")).data?.length === 0);
  const vpath = `${couple.id}/vault/${stamp}.png`;
  check("vault file upload blocked while locked (partner)", !!(await him.storage.from("couple-media").upload(vpath, png, { contentType: "image/png" })).error);
  check("wrong PIN rejected", (await him.rpc("vault_unlock", { p_pin: "000000" })).data.ok === false);
  check("right PIN opens it", (await him.rpc("vault_unlock", { p_pin: "482913" })).data.ok === true);
  check("partner reads vault when unlocked", (await him.from("vault_items").select("*")).data?.length === 1);
  check("vault file upload allowed once unlocked", !(await him.storage.from("couple-media").upload(vpath, png, { contentType: "image/png" })).error);
  await him.rpc("vault_lock");
  check("locking closes it", (await him.from("vault_items").select("*")).data?.length === 0);
  check("vault file not signable when locked", !!(await him.storage.from("couple-media").createSignedUrl(vpath, 60)).error);

  // Unlink revokes
  await her.rpc("unlink_partner");
  check("after unlink partner sees no journal", (await him.from("journal_entries").select("*")).data?.length === 0);
  check("after unlink partner can't read couple files", !!(await him.storage.from("couple-media").createSignedUrl(path, 60)).error);

  await her.removeAllChannels(); await him.removeAllChannels(); await eve.removeAllChannels();
} catch (e) {
  console.error("ABORTED:", e.message);
  failed++;
} finally {
  // Cleanup: files then users (cascade removes their rows).
  const { data: couples } = await admin.from("couples").select("id").in("her_id", Object.values(users).map((u) => u.id));
  for (const c of couples ?? []) {
    for (const f of [c.id, `${c.id}/vault`]) {
      const { data: files } = await admin.storage.from("couple-media").list(f);
      const paths = (files ?? []).filter((x) => x.id).map((x) => `${f}/${x.name}`);
      if (paths.length) await admin.storage.from("couple-media").remove(paths);
    }
  }
  for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL E2E CHECKS PASSED");
  process.exit(failed ? 1 : 0);
}
