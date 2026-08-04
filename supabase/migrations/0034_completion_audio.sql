-- Separate from audio_url (the ongoing "word from David" heard throughout
-- an active programme) -- this is the one-time "You did it" message played
-- once, when a scheduled block finishes. David records it after the fact,
-- prompted from the patient record once the block is done, so it can
-- actually reference how the block went, not just a generic recording made
-- in advance.
alter table public.programmes
  add column completion_audio_url text;
