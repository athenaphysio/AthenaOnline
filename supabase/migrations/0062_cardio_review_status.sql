-- Phase 3 audit result (3a): cardio_programmes is genuinely a different
-- shape from programme_templates, not a duplicate. A programme_template's
-- weekly schedule repeats the same workouts every week (only phases layer
-- named week-ranges on top; block_item_weeks varies a block's own
-- prescription per week, never which exercises/workouts run); a Concept2
-- multi-week plan like "From Couch to Consistency" has genuinely different
-- content on the same day-of-week across different weeks, with no fixed
-- repeating pattern. Folding this into the Programmes tab would misrepresent
-- it, so it keeps its own (minimal) view instead, per 3b.
--
-- review_status is invented fresh here, per 3c -- no existing pattern to
-- reuse. cardio_blocks defaults new/existing rows to 'reviewed' (nothing
-- already in the library needs re-flagging as unreviewed just because this
-- column now exists); only the new v2 treadmill content gets set to
-- 'pending' explicitly below. cardio_programmes defaults to 'pending',
-- since every row in it right now is v2 draft content with nowhere else to
-- have been reviewed yet.
alter table public.cardio_blocks add column review_status text not null default 'reviewed'
  check (review_status in ('pending', 'reviewed'));

alter table public.cardio_programmes add column review_status text not null default 'pending'
  check (review_status in ('pending', 'reviewed'));

update public.cardio_blocks set review_status = 'pending' where name like 'CU Return to Run:%';

-- Section 3 (general walking programme, non-running patients) -- the
-- source is explicit this is David's own general structure, not a cited
-- protocol, so it's named and worded to say that plainly rather than
-- attributing it to a source it didn't come from.
insert into public.cardio_blocks
  (name, modality, structure, category, rationale, review_status,
   steady_duration_seconds, steady_pace)
values
  ('General Walking Progression: Build Duration', 'treadmill_walk', 'steady_state', 'general',
   'David''s standard walking progression for patients not progressing toward running: general deconditioning, early-phase cardiovascular capacity building, or anyone for whom running isn''t a goal. Flat treadmill, comfortable pace; build duration before intensity, starting around 10-15 minutes and working up toward 30 minutes continuous. Not a cited protocol; a general structure for David to confirm the specifics of.',
   'pending', 900, 'comfortable, conversational pace'),

  ('General Walking Progression: Add Incline', 'treadmill_walk', 'steady_state', 'general',
   'Once 30 minutes flat is comfortable, introduce incline in small steps (1-2% at a time) before increasing pace. Incline raises intensity without adding impact, useful for anyone sensitive through the lower limb. David''s standard walking progression, not a cited protocol; confirm the specifics before use.',
   'pending', 1800, 'comfortable pace, incline increased before pace');
