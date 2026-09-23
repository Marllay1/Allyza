// Replays every migration in an in-process Postgres (PGlite) with Supabase-shaped stubs and asserts
// the privacy guarantees. Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";

const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema extensions; create schema auth; create schema storage; create schema realtime;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, owner_id text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create table realtime.messages(extension text); alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql as $$ select current_setting('realtime.topic', true) $$;
create publication supabase_realtime;
grant usage on schema public, auth, extensions to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
`);
for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(`supabase/migrations/${f}`, "utf8"));
console.log("migrations OK");

const asUser = async (id, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.sub','${id}',false);`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
};
const q = async (s, p) => (await db.query(s, p)).rows;
const expectFail = async (label, fn) => {
  try { await fn(); console.log("FAIL (should have errored):", label); process.exitCode = 1; }
  catch (e) { console.log("ok   blocked:", label, "->", e.message.slice(0, 60)); }
};
const check = (label, cond) => { console.log(cond ? "ok  " : "FAIL", label); if (!cond) process.exitCode = 1; };

const [her] = await q(`insert into auth.users(email, raw_user_meta_data) values ('a@x.com','{"role":"her","display_name":"Alhanouzzia","username":"Alhanouzzia"}') returning id`);
const [him] = await q(`insert into auth.users(email, raw_user_meta_data) values ('l@x.com','{"role":"partner","display_name":"Llayane","username":"Llayane"}') returning id`);
const [eve] = await q(`insert into auth.users(email, raw_user_meta_data) values ('e@x.com','{"role":"partner","username":"eve"}') returning id`);
const [c] = await q(`select id from couples where her_id=$1`, [her.id]);
check("her got a couple", !!c?.id);
check("usernames stored", (await q(`select username from profiles where id=$1`, [her.id]))[0].username === "alhanouzzia");
await expectFail("duplicate username (case-insensitive)", () => db.query(`insert into auth.users(email, raw_user_meta_data) values ('z@x.com','{"username":"LLAYANE"}')`));

// The seed links the two accounts (superuser). Nobody can do it from the app.
await db.query(`update couples set partner_id=$1 where id=$2`, [him.id, c.id]);
for (const fn of ["join_couple(text)", "unlink_partner()", "regenerate_invite()", "delete_my_account()"]) {
  check(`authenticated cannot call ${fn}`, (await q(`select has_function_privilege('authenticated','public.${fn}','execute') as ok`))[0].ok === false);
}
await asUser(eve.id, () => expectFail("outsider invites herself with a code", () => db.query(`select join_couple('anything')`)));

// Health data stays private
await asUser(her.id, async () => {
  await db.query(`insert into periods(start_date) values ('2026-08-22'),('2026-07-21')`);
  await db.query(`insert into daily_logs(log_date,pain,fatigue,mood,sugar_level) values (current_date,8,8,2,'high')`);
});
await asUser(him.id, async () => {
  check("partner cannot read daily_logs", (await q(`select * from daily_logs`)).length === 0);
  check("partner cannot read periods", (await q(`select * from periods`)).length === 0);
  check("partner cannot read sharing_settings", (await q(`select * from sharing_settings`)).length === 0);
  const s = (await q(`select partner_shared_status(current_date) as s`))[0].s;
  check("nothing shared by default", s.pain === null && s.mood === null && s.fatigue === null && s.cycle_day === null);
  check("partner cannot edit her sharing (0 rows)", (await db.query(`update sharing_settings set share_pain = true returning her_id`)).rows.length === 0);
  await expectFail("partner changes own role", () => db.query(`update profiles set role='her' where id='${him.id}'`));
  await expectFail("partner writes daily_logs", () => db.query(`insert into daily_logs(log_date,pain) values (current_date - 1, 1)`));
});
await asUser(her.id, () => db.query(`update sharing_settings set share_fatigue=true, share_stats=true`));
await asUser(him.id, async () => {
  const s = (await q(`select partner_shared_status(current_date) as s`))[0].s;
  check("fatigue shared as band only", s.fatigue === "high" && s.pain === null && s.mood === null);
  check("avg cycle shared (32)", Number(s.avg_cycle) === 32);
});
await asUser(her.id, () => db.query(`update sharing_settings set share_fatigue=false`));
await asUser(him.id, async () => check("revocation is immediate", (await q(`select partner_shared_status(current_date) as s`))[0].s.fatigue === null));

// Journal + notifications + isolation
await asUser(him.id, () => db.query(`insert into journal_entries(couple_id, body) values ('${c.id}','hello')`));
await asUser(her.id, async () => {
  check("she sees the journal entry", (await q(`select * from journal_entries`)).length === 1);
  check("contentless notification", (await q(`select kind from notifications`))[0]?.kind === "journal");
  await expectFail("spoofed author", () => db.query(`insert into journal_entries(couple_id, body, author_id) values ('${c.id}','x','${him.id}')`));
});
await asUser(eve.id, async () => {
  check("outsider sees no journal", (await q(`select * from journal_entries`)).length === 0);
  await expectFail("outsider writes journal", () => db.query(`insert into journal_entries(couple_id, body) values ('${c.id}','x')`));
});

// Surprises: the recipient can never read content before it is opened / unlocked
await asUser(him.id, async () => {
  await db.query(`insert into surprises(couple_id, kind, title, body, unlock) values ('${c.id}','love','Pour toi','Je pense a toi','miss_me')`);
  await db.query(`insert into surprises(couple_id, kind, body, unlock, unlock_at) values ('${c.id}','funny','PLUS TARD','date', now() + interval '2 days')`);
});
await asUser(her.id, async () => {
  check("recipient cannot select surprises table directly", (await q(`select * from surprises`)).length === 0);
  const list = await q(`select * from my_surprises()`);
  check("recipient sees 2 sealed surprises", list.length === 2);
  check("no content leaks before opening", list.every((s) => s.body === null && s.title === null && s.storage_path === null));
  check("future one is flagged locked", list.some((s) => s.locked === true));
  check("she got a contentless surprise notification", (await q(`select kind from notifications where kind='surprise'`)).length === 2);
  const open = list.find((s) => !s.locked);
  const r = (await q(`select open_surprise('${open.id}') as r`))[0].r;
  check("opening reveals the content", r.body === "Je pense a toi");
  const locked = list.find((s) => s.locked);
  await expectFail("opening a locked surprise early", () => db.query(`select open_surprise('${locked.id}')`));
  check("opened one now shows its body in the list", (await q(`select body from my_surprises() where id='${open.id}'`))[0].body === "Je pense a toi");
  await expectFail("recipient cannot modify surprises", async () => { const r = await db.query(`update surprises set body='x' returning id`); if (!r.rows.length) throw new Error("0 rows"); });
});
await asUser(him.id, async () => check("author sees own surprises", (await q(`select * from surprises`)).length === 2));
await asUser(eve.id, async () => {
  check("outsider sees no surprises", (await q(`select * from my_surprises()`)).length === 0);
  await expectFail("outsider opens a surprise", () => db.query(`select open_surprise('${(0, 0) || "00000000-0000-0000-0000-000000000000"}')`));
});

// Story, jokes, songs, counts
await asUser(her.id, async () => {
  await db.query(`insert into story_moments(couple_id, moment_date, title, emotion) values ('${c.id}','2026-05-24','Le debut','love')`);
  await db.query(`insert into inside_jokes(couple_id, kind, body) values ('${c.id}','nickname','Petit nuage')`);
  await db.query(`insert into shared_songs(couple_id, title, artist, url) values ('${c.id}','Song','Artist','https://example.com/x')`);
  await expectFail("javascript: URL as a song link", () => db.query(`insert into shared_songs(couple_id, title, artist, url) values ('${c.id}','S','A','javascript:alert(1)')`));
});
await asUser(him.id, async () => {
  check("partner reads the story", (await q(`select * from story_moments`)).length === 1);
  check("partner reads jokes + songs", (await q(`select * from inside_jokes`)).length === 1 && (await q(`select * from shared_songs`)).length === 1);
  await expectFail("partner edits her story moment", async () => { const r = await db.query(`update story_moments set title='hack' returning id`); if (!r.rows.length) throw new Error("0 rows"); });
  const n = (await q(`select couple_counts() as n`))[0].n;
  check("counts summarise without content", n.memories === 1 && n.letters === 2 && n.songs === 1 && n.jokes === 1);
});
await asUser(eve.id, async () => {
  check("outsider sees no story", (await q(`select * from story_moments`)).length === 0);
  check("outsider counts are zero", (await q(`select couple_counts() as n`))[0].n.memories === 0);
});

// Vault
await asUser(her.id, async () => {
  await expectFail("vault write without unlock", () => db.query(`insert into vault_items(couple_id,kind,body) values ('${c.id}','letter','secret')`));
  await db.query(`select vault_set_pin('123456')`);
  await db.query(`insert into vault_items(couple_id,kind,title,body) values ('${c.id}','letter','t','secret')`);
});
await asUser(him.id, async () => {
  check("partner locked out of vault without PIN", (await q(`select * from vault_items`)).length === 0);
  check("wrong PIN rejected", (await q(`select vault_unlock('000000') as r`))[0].r.ok === false);
  check("correct PIN unlocks", (await q(`select vault_unlock('123456') as r`))[0].r.ok === true);
  check("partner reads vault after unlock", (await q(`select * from vault_items`)).length === 1);
  await db.query(`select vault_lock()`);
  check("lock closes it again", (await q(`select * from vault_items`)).length === 0);
  for (let i = 0; i < 5; i++) await db.query(`select vault_unlock('999999')`);
  const r = (await q(`select vault_unlock('123456') as r`))[0].r;
  check("5 failures lock out even the right PIN", r.ok === false && !!r.locked_until);
});

// Nicknames: each viewer's own label for the other person, invisible to that person
await asUser(her.id, () => db.query(`insert into nicknames(target_id, nickname) values ('${him.id}', 'Mon amour')`));
await asUser(him.id, async () => {
  check("partner cannot read her nickname for him", (await q(`select * from nicknames where owner_id='${her.id}'`)).length === 0);
  await db.query(`insert into nicknames(target_id, nickname) values ('${her.id}', 'Babe')`);
  check("his own nickname for her is readable to him", (await q(`select nickname from nicknames where owner_id='${him.id}'`))[0].nickname === "Babe");
});
await asUser(her.id, async () => {
  check("her nickname for him unaffected by his choice", (await q(`select nickname from nicknames where owner_id='${her.id}'`))[0].nickname === "Mon amour");
  await expectFail("cannot set a nickname for a non-partner", () => db.query(`insert into nicknames(target_id, nickname) values ('${eve.id}', 'x')`));
});

// Messages: real chat, RLS-scoped, soft delete, guarded edits
let msgId;
await asUser(him.id, async () => {
  const r = await q(`insert into messages(couple_id, kind, body) values ('${c.id}','text','Coucou toi') returning id`);
  msgId = r[0].id;
  await expectFail("cannot spoof author on a message", () => db.query(`insert into messages(couple_id, kind, body, author_id) values ('${c.id}','text','x','${her.id}')`));
});
await asUser(her.id, async () => {
  check("she receives the message", (await q(`select body from messages where id='${msgId}'`))[0].body === "Coucou toi");
  check("she got a contentless message notification", (await q(`select kind from notifications where kind='message'`)).length === 1);
  await expectFail("she cannot edit his message", async () => { const r = await db.query(`update messages set body='hacked' where id='${msgId}' returning id`); if (!r.rows.length) throw new Error("0 rows"); });
});
check("outsider sees 0 messages", (await asUser(eve.id, () => q(`select * from messages`))).length === 0);
await asUser(him.id, async () => {
  await db.query(`update messages set body='Coucou toi (edit)' where id='${msgId}'`);
  check("edited_at stamped on edit", (await q(`select edited_at is not null as e from messages where id='${msgId}'`))[0].e === true);
  await db.query(`update messages set deleted_at = now() where id='${msgId}'`);
  check("soft delete clears the body", (await q(`select body from messages where id='${msgId}'`))[0].body === null);
});

// Sticker messages: a fixed id in `body`, no storage_path required
await asUser(him.id, async () => {
  const r = await q(`insert into messages(couple_id, kind, body) values ('${c.id}','sticker','love') returning id`);
  check("sticker message inserted with no storage_path", r.length === 1);
  await expectFail("sticker requires a non-empty body", () => db.query(`insert into messages(couple_id, kind) values ('${c.id}','sticker')`));
});

// Read cursor: both members can see both cursors (so each can show the other's read state)
await asUser(her.id, () => db.query(`insert into message_cursors(couple_id, last_read_at) values ('${c.id}', now()) on conflict (user_id) do update set last_read_at = excluded.last_read_at`));
await asUser(him.id, async () => {
  check("partner can read her cursor (for read receipts)", (await q(`select * from message_cursors where user_id='${her.id}'`)).length === 1);
  await expectFail("partner cannot overwrite her cursor", async () => { const r = await db.query(`update message_cursors set last_read_at = now() where user_id='${her.id}' returning user_id`); if (!r.rows.length) throw new Error("0 rows"); });
});
await asUser(eve.id, async () => check("outsider sees no cursors", (await q(`select * from message_cursors`)).length === 0));

// Avatars: her own column, grantable, nobody else's row touchable
await asUser(her.id, async () => {
  await db.query(`update profiles set avatar_path = '${c.id}/avatars/x.webp' where id='${her.id}'`);
  check("avatar_path saved", (await q(`select avatar_path from profiles where id='${her.id}'`))[0].avatar_path?.endsWith("x.webp"));
});
await asUser(him.id, async () => {
  const r = await db.query(`update profiles set avatar_path = 'hack' where id='${her.id}' returning id`);
  check("partner cannot overwrite her avatar", r.rows.length === 0);
});

// Custom content: drafts/scheduled-not-due are author-only; published or scheduled-and-due is couple-visible
let draftId, publishedId, dueScheduledId;
await asUser(him.id, async () => {
  draftId = (await q(`insert into custom_content(couple_id, category, body, status) values ('${c.id}','note','still working on this','draft') returning id`))[0].id;
  publishedId = (await q(`insert into custom_content(couple_id, category, body, status) values ('${c.id}','compliment','you are lovely','published') returning id`))[0].id;
  await db.query(`insert into custom_content(couple_id, category, body, status, publish_at) values ('${c.id}','poem','a poem for later','scheduled', now() + interval '1 day')`);
  dueScheduledId = (await q(`insert into custom_content(couple_id, category, body, status, publish_at) values ('${c.id}','letter','open this now','scheduled', now() - interval '1 minute') returning id`))[0].id;
});
await asUser(her.id, async () => {
  const visible = await q(`select id from custom_content order by created_at`);
  check("she sees the published note and the due scheduled one, not the future one", visible.length === 2 && visible.some((r) => r.id === publishedId) && visible.some((r) => r.id === dueScheduledId));
  await expectFail("she cannot edit his content", async () => { const r = await db.query(`update custom_content set body='hacked' where id='${publishedId}' returning id`); if (!r.rows.length) throw new Error("0 rows"); });
});
await asUser(him.id, async () => {
  const mine = await q(`select id from custom_content order by created_at`);
  check("he sees his own draft, published and scheduled content", mine.length === 4);
  check("draft id is his own", mine.some((r) => r.id === draftId));
});
check("outsider sees no custom content", (await asUser(eve.id, () => q(`select * from custom_content`))).length === 0);

// Calls: only the two of them, caller can't spoof, either side can update state
let callId;
await asUser(him.id, async () => {
  callId = (await q(`insert into calls(couple_id, caller_id, callee_id, kind) values ('${c.id}','${him.id}','${her.id}','audio') returning id`))[0].id;
  await expectFail("cannot spoof another caller", () => db.query(`insert into calls(couple_id, caller_id, callee_id, kind) values ('${c.id}','${her.id}','${him.id}','audio')`));
});
await asUser(her.id, async () => {
  await db.query(`update calls set status='accepted', answered_at=now() where id='${callId}'`);
  check("she can accept his call", (await q(`select status from calls where id='${callId}'`))[0].status === "accepted");
  await db.query(`update calls set caller_id='${her.id}' where id='${callId}'`);
  check("who-called-whom stays guarded even for the callee", (await q(`select caller_id from calls where id='${callId}'`))[0].caller_id === him.id);
});
check("outsider sees no calls", (await asUser(eve.id, () => q(`select * from calls`))).length === 0);

console.log(process.exitCode ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
