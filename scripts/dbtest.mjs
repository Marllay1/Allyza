import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';

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

const sql = fs.readFileSync('supabase/migrations/0001_init.sql', 'utf8');
await db.exec(sql);
console.log('migration OK');

const asUser = async (id, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.sub','${id}',false);`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
};
const q = async (s, p) => (await db.query(s, p)).rows;
const expectFail = async (label, fn) => {
  try { await fn(); console.log('FAIL (should have errored):', label); process.exitCode = 1; }
  catch (e) { console.log('ok   blocked:', label, '->', e.message.slice(0, 60)); }
};
const check = (label, cond) => { console.log(cond ? 'ok  ' : 'FAIL', label); if (!cond) process.exitCode = 1; };

const [her] = await q(`insert into auth.users(email, raw_user_meta_data) values ('her@x.com','{"role":"her","display_name":"Ada"}') returning id`);
const [him] = await q(`insert into auth.users(email, raw_user_meta_data) values ('him@x.com','{"role":"partner","display_name":"Bo"}') returning id`);
const [eve] = await q(`insert into auth.users(email, raw_user_meta_data) values ('eve@x.com','{"role":"partner"}') returning id`);
const [c] = await q(`select id, invite_code from couples where her_id=$1`, [her.id]);
check('her got a couple + invite', !!c?.invite_code);

// Health data
await asUser(her.id, async () => {
  await db.query(`insert into periods(start_date) values ('2026-08-22')`);
  await db.query(`insert into periods(start_date) values ('2026-07-21')`);
  await db.query(`insert into daily_logs(log_date,pain,fatigue,mood,sugar_level) values (current_date,8,8,2,'high')`);
});

// Partner before linking
await asUser(him.id, async () => {
  const s = await q(`select partner_shared_status(current_date) as s`);
  check('unlinked partner sees linked=false', s[0].s.linked === false);
});
await asUser(him.id, () => db.query(`select join_couple('${c.invite_code}')`));
await asUser(eve.id, () => expectFail('wrong invite code', () => db.query(`select join_couple('${c.invite_code}')`)));
await asUser(him.id, async () => {
  check('partner cannot read daily_logs', (await q(`select * from daily_logs`)).length === 0);
  check('partner cannot read periods', (await q(`select * from periods`)).length === 0);
  check('partner cannot read sharing_settings', (await q(`select * from sharing_settings`)).length === 0);
  const s = (await q(`select partner_shared_status(current_date) as s`))[0].s;
  check('nothing shared by default', s.pain === null && s.mood === null && s.fatigue === null && s.cycle_day === null && s.wellbeing === null);
  await expectFail('partner writes daily_logs', () => db.query(`insert into daily_logs(log_date,pain) values (current_date - 1, 1)`));
  check('partner cannot edit her sharing (0 rows)', (await db.query(`update sharing_settings set share_pain = true returning her_id`)).rows.length === 0);
  await expectFail('partner changes own role', () => db.query(`update profiles set role='her' where id='${him.id}'`));
});

// She shares selectively
await asUser(her.id, () => db.query(`update sharing_settings set share_fatigue=true, share_cycle_day=true, share_stats=true`));
await asUser(him.id, async () => {
  const s = (await q(`select partner_shared_status(current_date) as s`))[0].s;
  check('fatigue shared as band', s.fatigue === 'high');
  check('pain still hidden', s.pain === null);
  check('mood still hidden', s.mood === null);
  check('cycle day shared', typeof s.cycle_day === 'number' && s.cycle_day > 0);
  check('avg cycle shared (32)', Number(s.avg_cycle) === 32);
  check('sugar hidden', s.sugar === null);
});
await asUser(her.id, () => db.query(`update sharing_settings set share_fatigue=false`));
await asUser(him.id, async () => {
  const s = (await q(`select partner_shared_status(current_date) as s`))[0].s;
  check('revocation is immediate', s.fatigue === null);
});

// Journal + notifications + isolation
await asUser(him.id, () => db.query(`insert into journal_entries(couple_id, body) values ('${c.id}','hello')`));
await asUser(her.id, async () => {
  check('she sees journal entry', (await q(`select * from journal_entries`)).length === 1);
  check('she got a contentless notification', (await q(`select kind from notifications`))[0]?.kind === 'journal');
  await expectFail('spoofed author', () => db.query(`insert into journal_entries(couple_id, body, author_id) values ('${c.id}','x','${him.id}')`));
  await expectFail("edit partner's entry", async () => { const r = await db.query(`update journal_entries set body='hax' returning id`); if (!r.rows.length) throw new Error('0 rows updated'); });
});
await asUser(eve.id, async () => {
  check('outsider sees no journal', (await q(`select * from journal_entries`)).length === 0);
  await expectFail('outsider writes journal', () => db.query(`insert into journal_entries(couple_id, body) values ('${c.id}','x')`));
});

// Vault
await asUser(her.id, async () => {
  check('vault empty & unlocked=false', (await q(`select vault_status() as s`))[0].s.unlocked === false);
  await expectFail('vault write without unlock', () => db.query(`insert into vault_items(couple_id,kind,body) values ('${c.id}','letter','secret')`));
  await db.query(`select vault_set_pin('123456')`);
  await db.query(`insert into vault_items(couple_id,kind,title,body) values ('${c.id}','letter','t','secret')`);
});
await asUser(him.id, async () => {
  check('partner locked out of vault without PIN', (await q(`select * from vault_items`)).length === 0);
  let r = (await q(`select vault_unlock('000000') as r`))[0].r;
  check('wrong PIN rejected', r.ok === false);
  check('correct PIN unlocks', (await q(`select vault_unlock('123456') as r`))[0].r.ok === true);
  check('partner reads vault after unlock', (await q(`select * from vault_items`)).length === 1);
  await db.query(`select vault_lock()`);
  check('lock closes it again', (await q(`select * from vault_items`)).length === 0);
  for (let i = 0; i < 5; i++) await db.query(`select vault_unlock('999999')`);
  r = (await q(`select vault_unlock('123456') as r`))[0].r;
  check('5 failures lock out even correct PIN', r.ok === false && !!r.locked_until);
});
await asUser(eve.id, async () => {
  check('outsider vault_status has no couple', (await q(`select vault_status() as s`))[0].s.couple === false);
});

// Unlink revokes
await asUser(her.id, () => db.query(`select unlink_partner()`));
await asUser(him.id, async () => {
  check('after unlink partner sees no journal', (await q(`select * from journal_entries`)).length === 0);
  check('after unlink status linked=false', (await q(`select partner_shared_status(current_date) as s`))[0].s.linked === false);
});
const [c2] = await q(`select invite_code from couples where id='${c.id}'`);
check('invite code rotated', c2.invite_code !== c.invite_code);
console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
