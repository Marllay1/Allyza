// Creates a THROWAWAY pair of users (her + partner, linked, with a little sample data) and prints the browser
// cookies for "her" so a dev can look at signed-in screens without typing any password.
// These users are NOT the two real Allyza accounts. Remove them with:  node --env-file=.env.local scripts/dev-session.mjs --cleanup
//   node --env-file=.env.local scripts/dev-session.mjs [her|partner]
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PREFIX = "devtmp";
const emailOf = (k) => `${PREFIX}.${k}@users.allyza.app`;

async function list() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  return data.users.filter((u) => u.email?.startsWith(PREFIX + "."));
}

if (process.argv.includes("--cleanup")) {
  const us = await list();
  const { data: cs } = await admin.from("couples").select("id").in("her_id", us.map((u) => u.id));
  for (const c of cs ?? []) for (const f of [c.id, `${c.id}/vault`]) {
    const { data: files } = await admin.storage.from("couple-media").list(f);
    const paths = (files ?? []).filter((x) => x.id).map((x) => `${f}/${x.name}`);
    if (paths.length) await admin.storage.from("couple-media").remove(paths);
  }
  for (const u of us) await admin.auth.admin.deleteUser(u.id);
  console.log(`removed ${us.length} throwaway user(s)`);
  process.exit(0);
}

const who = process.argv[2] === "partner" ? "partner" : process.argv[2] === "both" ? "both" : "her";
const pw = `Dev-${Date.now()}-x!`;
let users = await list();
if (users.length < 2) {
  await Promise.all(users.map((u) => admin.auth.admin.deleteUser(u.id)));
  const mk = async (k, role, name) => (await admin.auth.admin.createUser({ email: emailOf(k), password: pw, email_confirm: true, user_metadata: { role, display_name: name, username: `${PREFIX}${k}`, locale: "fr" } })).data.user;
  const her = await mk("her", "her", "Alhanouzzia"), him = await mk("partner", "partner", "Llayane");
  await admin.from("couples").update({ partner_id: him.id }).eq("her_id", her.id);
  const { data: c } = await admin.from("couples").select("id").eq("her_id", her.id).single();
  const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  await admin.from("periods").insert(["2026-06-21", "2026-07-21", "2026-08-22"].map((start_date) => ({ user_id: her.id, start_date })));
  for (let i = 0; i < 9; i++) await admin.from("daily_logs").insert({ user_id: her.id, log_date: d(i), pain: (i * 3) % 10, fatigue: (i * 5) % 10, mood: (i % 5) + 1, sugar_level: ["low", "moderate", "high"][i % 3] });
  await admin.from("journal_entries").insert([{ couple_id: c.id, author_id: him.id, body: "Coucou ma lune ❤️" }, { couple_id: c.id, author_id: her.id, body: "Coucou toi 🌙" }]);
  await admin.from("story_moments").insert([
    { couple_id: c.id, author_id: him.id, moment_date: "2026-05-24", title: "Le début de quelque chose", body: "Ce soir-là…", emotion: "love" },
    { couple_id: c.id, author_id: her.id, moment_date: "2026-06-12", title: "Notre première soirée film", place: "Chez nous", emotion: "joy" },
    { couple_id: c.id, author_id: him.id, moment_date: "2026-07-30", title: "Ce fou rire à 2 h du matin", emotion: "laugh" },
  ]);
  await admin.from("inside_jokes").insert({ couple_id: c.id, author_id: him.id, kind: "nickname", body: "Petit nuage" });
  await admin.from("shared_songs").insert({ couple_id: c.id, author_id: him.id, title: "Dreams", artist: "Fleetwood Mac", message: "Pensé à toi ce matin." });
  await admin.from("surprises").insert([
    { couple_id: c.id, author_id: him.id, kind: "love", title: "Pour toi", body: "Je pense à toi. Tout le temps.", unlock: "miss_me" },
    { couple_id: c.id, author_id: him.id, kind: "funny", body: "Bientôt…", unlock: "date", unlock_at: new Date(Date.now() + 5 * 86400000).toISOString() },
  ]);
  users = await list();
}
// password differs per run only when users are (re)created; reset it so we can sign in now
for (const u of users) await admin.auth.admin.updateUserById(u.id, { password: pw });

async function session(k) {
  const jar = new Map();
  const ssr = createServerClient(url, anon, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => jar.set(c.name, c.value)) } });
  const { error } = await ssr.auth.signInWithPassword({ email: emailOf(k), password: pw });
  if (error) { console.error(error.message); process.exit(1); }
  return [...jar].map(([name, value]) => ({ name, value }));
}
console.log(JSON.stringify(who === "both" ? { her: await session("her"), partner: await session("partner") } : await session(who)));
