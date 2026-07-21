-- Dropping the per-exercise coaching-cue audio: each exercise's video already
-- carries narration, so a separate recording per exercise was redundant.
-- Only the per-programme "word from David" message (programmes.audio_url) stays.
alter table public.exercises drop column audio_url;
