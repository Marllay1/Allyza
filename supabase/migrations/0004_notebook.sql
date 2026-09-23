-- ALLYZA — Our Journal becomes a shared notebook (not a chat): optional title/mood per page.
-- Real-time chat now lives in public.messages (0003); journal_entries keeps its RLS/realtime as-is.
alter table public.journal_entries add column title text check (char_length(title) <= 120);
alter table public.journal_entries add column mood text check (mood in ('joy', 'love', 'calm', 'tender', 'nostalgia', 'tired', 'grateful'));
