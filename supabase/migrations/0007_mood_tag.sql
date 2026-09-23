-- ---------------------------------------------------------------------------
-- Mood as a named feeling (calm, happy, tired, sad, irritated, anxious,
-- sensitive, neutral) rather than only a 1-5 intensity. The existing numeric
-- `mood` column is kept for trends/history continuity; the app derives it
-- from the tag when one is chosen.
-- ---------------------------------------------------------------------------
alter table public.daily_logs add column mood_tag text check (mood_tag in
  ('calm', 'happy', 'tired', 'sad', 'irritated', 'anxious', 'sensitive', 'neutral'));
