-- ALLYZA — phase 4: nicknames, real messaging, avatars.
--  * nicknames: each viewer's own private label for the other person, never shared
--  * messages: a real 1:1 chat (text/image/audio, reply, edit, soft-delete, read cursor)
--  * profiles.avatar_path: an optional private photo, next to the existing display name

-- ---------------------------------------------------------------------------
-- Avatars (reuses the existing private couple-media bucket/policies)
-- ---------------------------------------------------------------------------
alter table public.profiles add column avatar_path text;
grant update (avatar_path) on public.profiles to authenticated;

create or replace function public.is_my_partner(p_target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.couples c
    where (select auth.uid()) in (c.her_id, c.partner_id)
      and p_target in (c.her_id, c.partner_id)
      and p_target <> (select auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- Nicknames: "how I refer to the other person" — local to the viewer only.
-- She can call him "Mon amour" while he calls her "Alhanou"; neither sees the other's choice.
-- ---------------------------------------------------------------------------
create table public.nicknames (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  updated_at timestamptz not null default now(),
  primary key (owner_id, target_id)
);
alter table public.nicknames enable row level security;
create policy nicknames_all on public.nicknames for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_my_partner(target_id));

-- ---------------------------------------------------------------------------
-- Messages: real-time 1:1 chat, separate from the "Our Journal" notebook.
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'audio')),
  body text check (char_length(body) <= 4000),
  storage_path text unique,
  duration_ms integer check (duration_ms between 0 and 600000),
  reply_to uuid references public.messages (id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (storage_path is null or storage_path like couple_id::text || '/chat/%'),
  check (deleted_at is not null or kind <> 'text' or (body is not null and char_length(body) > 0)),
  check (kind = 'text' or storage_path is not null)
);
create index messages_couple_created on public.messages (couple_id, created_at desc);
alter table public.messages enable row level security;
create policy messages_select on public.messages for select to authenticated using (public.is_couple_member(couple_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (public.is_couple_member(couple_id) and author_id = (select auth.uid()));
create policy messages_update on public.messages for update to authenticated
  using (author_id = (select auth.uid()) and public.is_couple_member(couple_id))
  with check (author_id = (select auth.uid()));
-- No delete policy: soft-delete via update (deleted_at) keeps the reply chain intact.

-- Edits only touch body/edited_at/deleted_at; everything else about a message is fixed at creation.
create function public.messages_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.couple_id := old.couple_id;
  new.author_id := old.author_id;
  new.kind := old.kind;
  new.storage_path := old.storage_path;
  new.duration_ms := old.duration_ms;
  new.reply_to := old.reply_to;
  new.created_at := old.created_at;
  if new.body is distinct from old.body and new.deleted_at is null then new.edited_at := now(); end if;
  if new.deleted_at is not null then new.body := null; end if;
  return new;
end $$;
create trigger messages_guard_trg before update on public.messages
  for each row execute function public.messages_guard();

-- "Read up to": far simpler than a row per message for exactly two participants.
create table public.message_cursors (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  last_read_at timestamptz not null default now()
);
alter table public.message_cursors enable row level security;
create policy cursors_select on public.message_cursors for select to authenticated using (public.is_couple_member(couple_id));
create policy cursors_upsert on public.message_cursors for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_couple_member(couple_id));
create policy cursors_update on public.message_cursors for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Reactions / notifications extended with "message"
-- ---------------------------------------------------------------------------
alter table public.reactions drop constraint reactions_target_type_check;
alter table public.reactions add constraint reactions_target_type_check
  check (target_type in ('journal', 'media', 'little', 'story', 'song', 'joke', 'message'));

alter table public.user_preferences add column notify_message boolean not null default true;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('journal', 'media', 'refuge', 'little', 'surprise', 'message'));

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
  select case k
           when 'journal'  then notify_journal
           when 'media'    then notify_media
           when 'refuge'   then notify_refuge
           when 'surprise' then notify_surprise
           when 'message'  then notify_message
           else notify_little end
    into wanted
    from public.user_preferences where user_id = recipient;
  if coalesce(wanted, true) then
    insert into public.notifications (user_id, kind) values (recipient, k);
  end if;
  return new;
end $$;

create trigger message_notify after insert on public.messages
  for each row execute function public.notify_partner('message');

-- ---------------------------------------------------------------------------
-- Realtime + privileges
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.message_cursors, public.nicknames;

revoke execute on function public.is_my_partner(uuid) from public, anon;
grant execute on function public.is_my_partner(uuid) to authenticated;
