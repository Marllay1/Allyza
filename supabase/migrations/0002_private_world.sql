-- ALLYZA — phase 2/3: a private world for exactly two people.
--  * usernames (login is by username; the e-mail behind it is internal)
--  * no self-service linking / unlinking / deletion: the two accounts are provisioned by
--    scripts/seed-users.mjs and stay linked
--  * new couple content: surprises (with server-enforced unlock), our story, inside jokes, songs
-- The couple/role model is kept as-is, so more users could be supported later.

-- ---------------------------------------------------------------------------
-- Usernames
-- ---------------------------------------------------------------------------
alter table public.profiles add column username text;
create unique index profiles_username_key on public.profiles (lower(username));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.app_role;
  nm text;
  un text;
  lc text;
begin
  r := case when new.raw_user_meta_data ->> 'role' = 'partner'
            then 'partner'::public.app_role else 'her'::public.app_role end;
  nm := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                      split_part(new.email, '@', 1)), 40);
  un := nullif(lower(trim(new.raw_user_meta_data ->> 'username')), '');
  lc := case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'fr' end;

  insert into public.profiles (id, role, display_name, username) values (new.id, r, nm, un);
  insert into public.user_preferences (user_id, locale) values (new.id, lc);
  if r = 'her' then
    insert into public.couples (her_id) values (new.id);
    insert into public.sharing_settings (her_id) values (new.id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- No self-service link management, no account deletion
-- ---------------------------------------------------------------------------
revoke execute on function public.join_couple(text) from authenticated;
revoke execute on function public.unlink_partner() from authenticated;
revoke execute on function public.regenerate_invite() from authenticated;
revoke execute on function public.delete_my_account() from authenticated;

-- ---------------------------------------------------------------------------
-- Preferences / notifications / reactions extended
-- ---------------------------------------------------------------------------
alter table public.user_preferences add column notify_surprise boolean not null default true;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('journal', 'media', 'refuge', 'little', 'surprise'));

alter table public.reactions drop constraint reactions_target_type_check;
alter table public.reactions add constraint reactions_target_type_check
  check (target_type in ('journal', 'media', 'little', 'story', 'song', 'joke'));

-- ---------------------------------------------------------------------------
-- Surprises
-- ---------------------------------------------------------------------------
create table public.surprises (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('love', 'encouragement', 'funny', 'memory', 'compliment', 'surprise')),
  title text not null default '' check (char_length(title) <= 80),
  body text not null check (char_length(body) between 1 and 2000),
  storage_path text unique,
  unlock text not null default 'anytime'
    check (unlock in ('anytime', 'miss_me', 'hard_day', 'need_smile', 'tonight', 'tomorrow', 'date')),
  unlock_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  check (storage_path is null or storage_path like couple_id::text || '/%'),
  check (unlock not in ('tonight', 'tomorrow', 'date') or unlock_at is not null)
);
create index surprises_couple on public.surprises (couple_id, created_at desc);
alter table public.surprises enable row level security;

-- The AUTHOR sees everything they wrote. The RECIPIENT has no direct access at all:
-- content only ever leaves the database through my_surprises() / open_surprise(),
-- which withhold it until the surprise is opened and its date (if any) has arrived.
create policy surprises_author_select on public.surprises for select to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id));
create policy surprises_insert on public.surprises for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_couple_member(couple_id));
create policy surprises_update on public.surprises for update to authenticated
  using (author_id = (select auth.uid()) and opened_at is null)
  with check (author_id = (select auth.uid()));
create policy surprises_delete on public.surprises for delete to authenticated
  using (author_id = (select auth.uid()));

create function public.my_surprises()
returns table (id uuid, kind text, unlock text, unlock_at timestamptz, created_at timestamptz,
               opened_at timestamptz, locked boolean, title text, body text, storage_path text)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.kind, s.unlock, s.unlock_at, s.created_at, s.opened_at,
         (s.unlock_at is not null and s.unlock_at > now()) as locked,
         case when s.opened_at is not null then s.title end,
         case when s.opened_at is not null then s.body end,
         case when s.opened_at is not null then s.storage_path end
    from public.surprises s
    join public.couples c on c.id = s.couple_id
   where (select auth.uid()) in (c.her_id, c.partner_id)
     and s.author_id <> (select auth.uid())
   order by s.created_at desc
$$;

create function public.open_surprise(p_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s public.surprises;
begin
  select s2.* into s from public.surprises s2
    join public.couples c on c.id = s2.couple_id
   where s2.id = p_id and (select auth.uid()) in (c.her_id, c.partner_id) and s2.author_id <> (select auth.uid());
  if not found then raise exception 'not_found'; end if;
  if s.unlock_at is not null and s.unlock_at > now() then raise exception 'locked'; end if;
  update public.surprises set opened_at = coalesce(opened_at, now()) where id = p_id;
  return jsonb_build_object('kind', s.kind, 'title', s.title, 'body', s.body, 'storage_path', s.storage_path);
end $$;

-- ---------------------------------------------------------------------------
-- Our story
-- ---------------------------------------------------------------------------
create table public.story_moments (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  moment_date date not null,
  title text not null check (char_length(title) between 1 and 120),
  body text check (char_length(body) <= 3000),
  place text check (char_length(place) <= 120),
  emotion text check (emotion in ('love', 'joy', 'laugh', 'tender', 'nostalgia', 'wonder')),
  storage_path text unique,
  created_at timestamptz not null default now(),
  check (storage_path is null or storage_path like couple_id::text || '/%')
);
create index story_moments_couple_date on public.story_moments (couple_id, moment_date desc);
alter table public.story_moments enable row level security;
create policy story_select on public.story_moments for select to authenticated using (public.is_couple_member(couple_id));
create policy story_insert on public.story_moments for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy story_update on public.story_moments for update to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id)) with check (author_id = (select auth.uid()));
create policy story_delete on public.story_moments for delete to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id));

-- ---------------------------------------------------------------------------
-- Inside jokes ("Nos trucs à nous")
-- ---------------------------------------------------------------------------
create table public.inside_jokes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('joke', 'nickname', 'phrase', 'quote', 'moment')),
  body text not null check (char_length(body) between 1 and 500),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index inside_jokes_couple on public.inside_jokes (couple_id, created_at desc);
alter table public.inside_jokes enable row level security;
create policy jokes_select on public.inside_jokes for select to authenticated using (public.is_couple_member(couple_id));
create policy jokes_insert on public.inside_jokes for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy jokes_update on public.inside_jokes for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy jokes_delete on public.inside_jokes for delete to authenticated using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Songs ("Cette chanson m'a fait penser à toi")
-- ---------------------------------------------------------------------------
create table public.shared_songs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  artist text not null check (char_length(artist) between 1 and 120),
  url text check (url ~* '^https?://[^[:space:]]+$' and char_length(url) <= 500),
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now()
);
create index shared_songs_couple on public.shared_songs (couple_id, created_at desc);
alter table public.shared_songs enable row level security;
create policy songs_select on public.shared_songs for select to authenticated using (public.is_couple_member(couple_id));
create policy songs_insert on public.shared_songs for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy songs_delete on public.shared_songs for delete to authenticated using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- "27 memories · 14 photos · 9 letters": counts only, never content
-- ---------------------------------------------------------------------------
create function public.couple_counts() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare cid uuid;
begin
  select id into cid from public.couples where (select auth.uid()) in (her_id, partner_id);
  if cid is null then return jsonb_build_object('memories', 0, 'photos', 0, 'letters', 0, 'songs', 0, 'jokes', 0); end if;
  return jsonb_build_object(
    'memories', (select count(*) from public.story_moments where couple_id = cid),
    'photos', (select count(*) from public.couple_media where couple_id = cid and category <> 'journal')
            + (select count(*) from public.story_moments where couple_id = cid and storage_path is not null),
    'letters', (select count(*) from public.surprises where couple_id = cid)
             + (select count(*) from public.vault_items where couple_id = cid and kind = 'letter'),
    'songs', (select count(*) from public.shared_songs where couple_id = cid),
    'jokes', (select count(*) from public.inside_jokes where couple_id = cid)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Notifications: surprises are announced (contentless) like everything else
-- ---------------------------------------------------------------------------
create or replace function public.notify_partner() returns trigger
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
  -- a surprise that unlocks later is announced when it is created, not its content
  select case k
           when 'journal'  then notify_journal
           when 'media'    then notify_media
           when 'refuge'   then notify_refuge
           when 'surprise' then notify_surprise
           else notify_little end
    into wanted
    from public.user_preferences where user_id = recipient;
  if coalesce(wanted, true) then
    insert into public.notifications (user_id, kind) values (recipient, k);
  end if;
  return new;
end $$;

create trigger surprise_notify after insert on public.surprises
  for each row execute function public.notify_partner('surprise');

-- Live refresh for the new shared sections (RLS still filters what each member receives).
alter publication supabase_realtime add table public.story_moments, public.inside_jokes, public.shared_songs;

-- ---------------------------------------------------------------------------
-- Privileges for the new functions
-- ---------------------------------------------------------------------------
revoke execute on function public.my_surprises(), public.open_surprise(uuid), public.couple_counts()
  from public, anon;
grant execute on function public.my_surprises(), public.open_surprise(uuid), public.couple_counts()
  to authenticated;
