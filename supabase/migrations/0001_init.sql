-- ALLYZA — initial schema
-- Principles:
--   * Health data is private by default: only its owner can read/write it.
--   * The partner never reads health tables. He calls partner_shared_status(),
--     a SECURITY DEFINER function that returns ONLY what she chose to share.
--   * Couple content is scoped to the two members of a couple.
--   * The vault is additionally protected by a PIN enforced in the database.

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('her', 'partner');

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  soft_mode boolean not null default false,
  notify_journal boolean not null default true,
  notify_media boolean not null default true,
  notify_refuge boolean not null default true,
  notify_little boolean not null default true
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  her_id uuid not null unique references public.profiles (id) on delete cascade,
  partner_id uuid unique references public.profiles (id) on delete set null,
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  created_at timestamptz not null default now(),
  check (partner_id is null or partner_id <> her_id)
);

create table public.sharing_settings (
  her_id uuid primary key references public.profiles (id) on delete cascade,
  share_cycle_day boolean not null default false,
  share_period_status boolean not null default false,
  share_pain boolean not null default false,
  share_mood boolean not null default false,
  share_fatigue boolean not null default false,
  share_wellbeing boolean not null default false,
  share_food boolean not null default false,
  share_stats boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Health data (owner only)
-- ---------------------------------------------------------------------------

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  unique (user_id, start_date),
  check (end_date is null or end_date >= start_date)
);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date date not null,
  is_period boolean not null default false,
  flow smallint check (flow between 1 and 4),
  pain smallint check (pain between 0 and 10),
  pain_type text check (pain_type in
    ('abdominal', 'premenstrual', 'menstrual', 'ovulation', 'post_period', 'other')),
  pain_duration_min integer check (pain_duration_min between 0 and 1440),
  fatigue smallint check (fatigue between 0 and 10),
  mood smallint check (mood between 1 and 5),
  sugar_level text check (sugar_level in ('low', 'moderate', 'high')),
  symptoms text[] not null default '{}' check (cardinality(symptoms) <= 20),
  note text check (char_length(note) <= 1000),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date date not null,
  category text not null check (category in
    ('fruit', 'vegetables', 'protein', 'legumes', 'whole_grains',
     'water', 'sweet_foods', 'sugary_drinks', 'other')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index food_logs_user_date on public.food_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- Couple content
-- ---------------------------------------------------------------------------

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index journal_entries_couple_created on public.journal_entries (couple_id, created_at desc);

create table public.couple_media (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category text not null check (category in
    ('journal', 'moments', 'outings', 'memories', 'little', 'surprises')),
  entry_id uuid references public.journal_entries (id) on delete cascade,
  storage_path text not null unique,
  caption text check (char_length(caption) <= 300),
  taken_on date not null default current_date,
  created_at timestamptz not null default now(),
  check (storage_path like couple_id::text || '/%')
);
create index couple_media_couple_cat on public.couple_media (couple_id, category, created_at desc);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('journal', 'media', 'little')),
  target_id uuid not null,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (author_id, target_type, target_id, emoji)
);
create index reactions_target on public.reactions (couple_id, target_type, target_id);

create table public.refuge_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 600),
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.little_things (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in
    ('compliment', 'note', 'question', 'date_idea', 'challenge', 'hidden')),
  body text not null check (char_length(body) between 1 and 600),
  answer text check (char_length(answer) <= 600),
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('letter', 'note', 'photo')),
  title text not null default '' check (char_length(title) <= 120),
  body text check (char_length(body) <= 8000),
  storage_path text unique,
  created_at timestamptz not null default now(),
  check (storage_path is null or storage_path like couple_id::text || '/vault/%')
);

-- Vault PIN + unlock sessions: no policies at all => reachable only through the
-- SECURITY DEFINER functions below.
create table public.couple_vault_settings (
  couple_id uuid primary key references public.couples (id) on delete cascade,
  pin_hash text,
  failed_count integer not null default 0,
  locked_until timestamptz
);
create table public.vault_sessions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Notifications (in-app, contentless) + web push subscriptions
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('journal', 'media', 'refuge', 'little')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create function public.safe_uuid(t text) returns uuid
language plpgsql immutable set search_path = ''
as $$ begin return t::uuid; exception when others then return null; end $$;

create function public.is_couple_member(cid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.couples c
    where c.id = cid and (select auth.uid()) in (c.her_id, c.partner_id)
  )
$$;

create function public.is_her() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'her')
$$;

create function public.has_vault_access(cid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_couple_member(cid) and exists (
    select 1 from public.vault_sessions v
    where v.user_id = (select auth.uid()) and v.couple_id = cid and v.expires_at > now()
  )
$$;

-- ---------------------------------------------------------------------------
-- Signup trigger: profile, preferences, and (for her) couple + sharing defaults
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.app_role;
  nm text;
  lc text;
begin
  r := case when new.raw_user_meta_data ->> 'role' = 'partner'
            then 'partner'::public.app_role else 'her'::public.app_role end;
  nm := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                      split_part(new.email, '@', 1)), 40);
  lc := case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'fr' end;

  insert into public.profiles (id, role, display_name) values (new.id, r, nm);
  insert into public.user_preferences (user_id, locale) values (new.id, lc);
  if r = 'her' then
    insert into public.couples (her_id) values (new.id);
    insert into public.sharing_settings (her_id) values (new.id);
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Couple management RPCs
-- ---------------------------------------------------------------------------

create function public.join_couple(p_code text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare cid uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'partner') then
    raise exception 'not_partner';
  end if;
  if exists (select 1 from public.couples where partner_id = auth.uid()) then
    raise exception 'already_linked';
  end if;
  update public.couples
     set partner_id = auth.uid()
   where invite_code = upper(trim(p_code)) and partner_id is null
  returning id into cid;
  if cid is null then raise exception 'invalid_code'; end if;
  return cid;
end $$;

-- Either member can end the link. The invite code is rotated so the old one dies.
create function public.unlink_partner() returns void
language plpgsql security definer set search_path = ''
as $$
declare cid uuid;
begin
  update public.couples
     set partner_id = null,
         invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
   where auth.uid() in (her_id, partner_id)
  returning id into cid;
  if cid is not null then
    delete from public.vault_sessions where couple_id = cid;
    delete from public.notifications where user_id = auth.uid();
  end if;
end $$;

create function public.regenerate_invite() returns text
language plpgsql security definer set search_path = ''
as $$
declare code text;
begin
  update public.couples
     set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
   where her_id = auth.uid() and partner_id is null
  returning invite_code into code;
  return code;
end $$;

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- What the partner may see: ONLY what she has shared, and only coarse bands.
-- Keys she did not share (or has not logged) are null, so "not shared" and
-- "not logged today" are indistinguishable from his side.
-- ---------------------------------------------------------------------------

create function public.partner_shared_status(p_today date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  c public.couples;
  s public.sharing_settings;
  lg public.daily_logs;
  last_start date;
  last_end date;
  cyc_day int;
  on_period boolean;
  pain_b text;
  fat_b text;
  mood_b text;
  well text;
  avg_len numeric;
begin
  select * into c from public.couples where partner_id = auth.uid();
  if not found then return jsonb_build_object('linked', false); end if;
  if abs(p_today - current_date) > 1 then p_today := current_date; end if;

  select * into s from public.sharing_settings where her_id = c.her_id;
  select * into lg from public.daily_logs where user_id = c.her_id and log_date = p_today;
  select start_date, end_date into last_start, last_end
    from public.periods
   where user_id = c.her_id and start_date <= p_today
   order by start_date desc limit 1;

  if s.share_cycle_day and last_start is not null then
    cyc_day := p_today - last_start + 1;
    if cyc_day > 90 then cyc_day := null; end if;
  end if;

  if s.share_period_status then
    on_period := coalesce(lg.is_period, false)
      or (last_start is not null and (
            (last_end is not null and p_today between last_start and last_end)
            or (last_end is null and p_today - last_start < 7)));
  end if;

  if s.share_pain and lg.pain is not null then
    pain_b := case when lg.pain <= 3 then 'low' when lg.pain <= 6 then 'medium' else 'high' end;
  end if;
  if s.share_fatigue and lg.fatigue is not null then
    fat_b := case when lg.fatigue <= 3 then 'low' when lg.fatigue <= 6 then 'medium' else 'high' end;
  end if;
  if s.share_mood and lg.mood is not null then
    mood_b := case when lg.mood <= 2 then 'low' when lg.mood = 3 then 'neutral' else 'good' end;
  end if;
  if s.share_wellbeing and lg.id is not null
     and (lg.mood is not null or lg.fatigue is not null or lg.pain is not null) then
    well := case
      when coalesce(lg.pain, 0) >= 6 or coalesce(lg.fatigue, 0) >= 7 or coalesce(lg.mood, 3) <= 2 then 'gentle'
      when coalesce(lg.mood, 3) >= 4 and coalesce(lg.fatigue, 0) <= 4 and coalesce(lg.pain, 0) <= 3 then 'good'
      else 'ok' end;
  end if;

  if s.share_stats then
    select round(avg(d)) into avg_len from (
      select start_date - lag(start_date) over (order by start_date) as d
        from public.periods where user_id = c.her_id
    ) x where d is not null;
  end if;

  return jsonb_build_object(
    'linked', true,
    'cycle_day', cyc_day,
    'on_period', on_period,
    'pain', pain_b,
    'fatigue', fat_b,
    'mood', mood_b,
    'wellbeing', well,
    'sugar', case when s.share_food then lg.sugar_level end,
    'avg_cycle', avg_len
  );
end $$;

-- ---------------------------------------------------------------------------
-- Vault PIN
-- ---------------------------------------------------------------------------

create function public.vault_status() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare cid uuid; st public.couple_vault_settings;
begin
  select id into cid from public.couples where auth.uid() in (her_id, partner_id);
  if cid is null then return jsonb_build_object('couple', false); end if;
  select * into st from public.couple_vault_settings where couple_id = cid;
  return jsonb_build_object(
    'couple', true,
    'has_pin', coalesce(st.pin_hash is not null, false),
    'unlocked', public.has_vault_access(cid),
    'locked_until', case when st.locked_until > now() then st.locked_until end
  );
end $$;

create function public.vault_set_pin(p_pin text, p_old text default null) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare cid uuid; st public.couple_vault_settings;
begin
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'invalid_pin'; end if;
  select id into cid from public.couples where auth.uid() in (her_id, partner_id);
  if cid is null then raise exception 'no_couple'; end if;
  select * into st from public.couple_vault_settings where couple_id = cid for update;
  if found and st.pin_hash is not null then
    if st.locked_until > now() then raise exception 'locked'; end if;
    if p_old is null or st.pin_hash <> extensions.crypt(p_old, st.pin_hash) then
      raise exception 'wrong_pin';
    end if;
  end if;
  insert into public.couple_vault_settings (couple_id, pin_hash, failed_count, locked_until)
  values (cid, extensions.crypt(p_pin, extensions.gen_salt('bf')), 0, null)
  on conflict (couple_id) do update
    set pin_hash = excluded.pin_hash, failed_count = 0, locked_until = null;
  delete from public.vault_sessions where couple_id = cid;
  insert into public.vault_sessions (user_id, couple_id, expires_at)
  values (auth.uid(), cid, now() + interval '15 minutes')
  on conflict (user_id) do update set couple_id = excluded.couple_id, expires_at = excluded.expires_at;
  return true;
end $$;

create function public.vault_unlock(p_pin text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare cid uuid; st public.couple_vault_settings;
begin
  select id into cid from public.couples where auth.uid() in (her_id, partner_id);
  if cid is null then return jsonb_build_object('ok', false); end if;
  select * into st from public.couple_vault_settings where couple_id = cid for update;
  if not found or st.pin_hash is null then return jsonb_build_object('ok', false, 'no_pin', true); end if;
  if st.locked_until > now() then
    return jsonb_build_object('ok', false, 'locked_until', st.locked_until);
  end if;
  if st.pin_hash = extensions.crypt(p_pin, st.pin_hash) then
    update public.couple_vault_settings set failed_count = 0, locked_until = null where couple_id = cid;
    insert into public.vault_sessions (user_id, couple_id, expires_at)
    values (auth.uid(), cid, now() + interval '15 minutes')
    on conflict (user_id) do update set couple_id = excluded.couple_id, expires_at = excluded.expires_at;
    return jsonb_build_object('ok', true);
  end if;
  update public.couple_vault_settings
     set failed_count = case when failed_count + 1 >= 5 then 0 else failed_count + 1 end,
         locked_until = case when failed_count + 1 >= 5 then now() + interval '15 minutes' else null end
   where couple_id = cid
  returning * into st;
  return jsonb_build_object('ok', false, 'locked_until', st.locked_until);
end $$;

create function public.vault_lock() returns void
language sql security definer set search_path = ''
as $$ delete from public.vault_sessions where user_id = auth.uid() $$;

-- ---------------------------------------------------------------------------
-- Triggers: edited_at, little_things guard, contentless notifications
-- ---------------------------------------------------------------------------

create function public.touch_edited() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  new.couple_id := old.couple_id;
  new.author_id := old.author_id;
  return new;
end $$;
create trigger journal_touch before update on public.journal_entries
  for each row execute function public.touch_edited();

-- The author can edit content; the other partner can only answer / open.
create function public.little_things_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.couple_id := old.couple_id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  if auth.uid() <> old.author_id then
    new.body := old.body;
    new.kind := old.kind;
  end if;
  return new;
end $$;
create trigger little_things_guard_trg before update on public.little_things
  for each row execute function public.little_things_guard();

create function public.refuge_messages_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.couple_id := old.couple_id;
  new.author_id := old.author_id;
  new.body := old.body;
  new.created_at := old.created_at;
  return new;
end $$;
create trigger refuge_messages_guard_trg before update on public.refuge_messages
  for each row execute function public.refuge_messages_guard();

create function public.notify_partner() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.couples;
  recipient uuid;
  k text := tg_argv[0];
  wanted boolean;
begin
  select * into c from public.couples where id = new.couple_id;
  recipient := case when c.her_id = new.author_id then c.partner_id else c.her_id end;
  if recipient is null then return new; end if;
  if k = 'media' and to_jsonb(new) ->> 'category' = 'journal' then return new; end if;

  select case k
           when 'journal' then notify_journal
           when 'media'   then notify_media
           when 'refuge'  then notify_refuge
           else notify_little end
    into wanted
    from public.user_preferences where user_id = recipient;

  if coalesce(wanted, true) then
    insert into public.notifications (user_id, kind) values (recipient, k);
  end if;
  return new;
end $$;

create trigger journal_notify after insert on public.journal_entries
  for each row execute function public.notify_partner('journal');
create trigger media_notify after insert on public.couple_media
  for each row execute function public.notify_partner('media');
create trigger refuge_notify after insert on public.refuge_messages
  for each row execute function public.notify_partner('refuge');
create trigger little_notify after insert on public.little_things
  for each row execute function public.notify_partner('little');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.couples enable row level security;
alter table public.sharing_settings enable row level security;
alter table public.periods enable row level security;
alter table public.daily_logs enable row level security;
alter table public.food_logs enable row level security;
alter table public.journal_entries enable row level security;
alter table public.couple_media enable row level security;
alter table public.reactions enable row level security;
alter table public.refuge_messages enable row level security;
alter table public.little_things enable row level security;
alter table public.vault_items enable row level security;
alter table public.couple_vault_settings enable row level security;
alter table public.vault_sessions enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles: own row + the other member of my couple (display name only matters).
-- The role column can never be changed by clients.
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or id in (select c.partner_id from public.couples c where c.her_id = (select auth.uid()))
  or id in (select c.her_id from public.couples c where c.partner_id = (select auth.uid()))
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;

create policy prefs_all on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- couples: members read; changes only through RPCs.
create policy couples_select on public.couples for select to authenticated
  using ((select auth.uid()) in (her_id, partner_id));
revoke insert, update, delete on public.couples from authenticated, anon;

-- sharing: only her.
create policy sharing_all on public.sharing_settings for all to authenticated
  using (her_id = (select auth.uid())) with check (her_id = (select auth.uid()));

-- health data: owner only, and only accounts with the "her" role.
create policy periods_all on public.periods for all to authenticated
  using (user_id = (select auth.uid()) and public.is_her())
  with check (user_id = (select auth.uid()) and public.is_her());
create policy daily_logs_all on public.daily_logs for all to authenticated
  using (user_id = (select auth.uid()) and public.is_her())
  with check (user_id = (select auth.uid()) and public.is_her());
create policy food_logs_all on public.food_logs for all to authenticated
  using (user_id = (select auth.uid()) and public.is_her())
  with check (user_id = (select auth.uid()) and public.is_her());

-- journal
create policy journal_select on public.journal_entries for select to authenticated
  using (public.is_couple_member(couple_id));
create policy journal_insert on public.journal_entries for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy journal_update on public.journal_entries for update to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id))
  with check (author_id = (select auth.uid()));
create policy journal_delete on public.journal_entries for delete to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id));

-- media
create policy media_select on public.couple_media for select to authenticated
  using (public.is_couple_member(couple_id));
create policy media_insert on public.couple_media for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy media_update on public.couple_media for update to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id))
  with check (author_id = (select auth.uid()));
create policy media_delete on public.couple_media for delete to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id));

-- reactions
create policy reactions_select on public.reactions for select to authenticated
  using (public.is_couple_member(couple_id));
create policy reactions_insert on public.reactions for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy reactions_delete on public.reactions for delete to authenticated
  using (author_id = (select auth.uid()));

-- refuge messages: both read; both write; recipient marks opened (guard trigger
-- freezes every other column).
create policy refuge_select on public.refuge_messages for select to authenticated
  using (public.is_couple_member(couple_id));
create policy refuge_insert on public.refuge_messages for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy refuge_update on public.refuge_messages for update to authenticated
  using (public.is_couple_member(couple_id) and author_id <> (select auth.uid()))
  with check (public.is_couple_member(couple_id));
create policy refuge_delete on public.refuge_messages for delete to authenticated
  using (author_id = (select auth.uid()));

-- little things
create policy little_select on public.little_things for select to authenticated
  using (public.is_couple_member(couple_id));
create policy little_insert on public.little_things for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy little_update on public.little_things for update to authenticated
  using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy little_delete on public.little_things for delete to authenticated
  using (author_id = (select auth.uid()));

-- vault: membership AND an unexpired PIN session, enforced here.
create policy vault_select on public.vault_items for select to authenticated
  using (public.has_vault_access(couple_id));
create policy vault_insert on public.vault_items for insert to authenticated
  with check (public.has_vault_access(couple_id) and author_id = (select auth.uid()));
create policy vault_update on public.vault_items for update to authenticated
  using (public.has_vault_access(couple_id) and author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy vault_delete on public.vault_items for delete to authenticated
  using (public.has_vault_access(couple_id) and author_id = (select auth.uid()));

-- notifications: recipient only (rows are created by triggers).
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert on public.notifications from authenticated, anon;

create policy push_all on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Function privileges: nothing is callable by anon or PUBLIC by default.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.safe_uuid(text), public.is_couple_member(uuid), public.is_her(),
  public.has_vault_access(uuid), public.join_couple(text), public.unlink_partner(),
  public.regenerate_invite(), public.delete_my_account(),
  public.partner_shared_status(date), public.vault_status(),
  public.vault_set_pin(text, text), public.vault_unlock(text), public.vault_lock()
to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one PRIVATE bucket. Path = <couple_id>/<file> or <couple_id>/vault/<file>.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('couple-media', 'couple-media', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

create policy couple_media_read on storage.objects for select to authenticated using (
  bucket_id = 'couple-media'
  and public.is_couple_member(public.safe_uuid((storage.foldername(name))[1]))
  and ((storage.foldername(name))[2] is distinct from 'vault'
       or public.has_vault_access(public.safe_uuid((storage.foldername(name))[1])))
);
create policy couple_media_write on storage.objects for insert to authenticated with check (
  bucket_id = 'couple-media'
  and public.is_couple_member(public.safe_uuid((storage.foldername(name))[1]))
  and ((storage.foldername(name))[2] is distinct from 'vault'
       or public.has_vault_access(public.safe_uuid((storage.foldername(name))[1])))
);
create policy couple_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'couple-media'
  and owner_id = (select auth.uid())::text
  and public.is_couple_member(public.safe_uuid((storage.foldername(name))[1]))
);

-- ---------------------------------------------------------------------------
-- Realtime: postgres_changes honours the RLS above. Broadcast/presence
-- ("she's writing…") uses PRIVATE channels named couple:<couple_id>.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.journal_entries, public.couple_media, public.reactions,
  public.refuge_messages, public.little_things, public.notifications;

create policy couple_channel_read on realtime.messages for select to authenticated using (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.is_couple_member(public.safe_uuid(split_part((select realtime.topic()), ':', 2)))
);
create policy couple_channel_write on realtime.messages for insert to authenticated with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and public.is_couple_member(public.safe_uuid(split_part((select realtime.topic()), ':', 2)))
);
