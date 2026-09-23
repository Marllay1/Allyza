-- Sticker messages: kind='sticker' stores a sticker id (from a fixed, code-defined set of
-- original Allyza artwork) in `body`; no storage_path, since nothing is uploaded.
alter table public.messages drop constraint messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'image', 'audio', 'sticker'));

alter table public.messages drop constraint messages_check2;
alter table public.messages add constraint messages_check2 check (kind = 'text' or kind = 'sticker' or storage_path is not null);

alter table public.messages add constraint messages_sticker_body_check check (kind <> 'sticker' or (body is not null and char_length(body) > 0));
