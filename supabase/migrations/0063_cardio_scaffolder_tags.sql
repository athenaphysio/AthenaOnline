-- Scaffolder tags from athena_cardio_library_v2.md Section 4: modality
-- (already exists on both tables), impact level, suggested phase, format,
-- and source. suggested_phase is plain text on both tables, same as
-- programme_template_phases.name -- phases have no fixed enum anywhere in
-- this app, so this doesn't invent a second vocabulary, it just uses free
-- text the same way the real phases feature does.
--
-- Applied to every existing cardio entry, not just the new v2 content, per
-- the brief ("every cardio entry in Vault"). Tags below are inferred from
-- each block's own name/modality/category rather than re-reviewed
-- clinically -- they don't change review_status, which stays whatever it
-- already was.
--
-- Note found while querying to write this: several rows in the original
-- starter library (Easy Recovery, Return to Run Stage 1-4, Base Building
-- Session 1-4, etc.) exist as exact duplicates under different ids --
-- looks like an earlier seed migration ran more than once. Not touched
-- here (deleting rows wasn't asked for and workout_items could reference
-- either copy); flagged for David to confirm before anyone removes them.
alter table public.cardio_blocks add column impact_level text check (impact_level in ('low', 'moderate', 'high'));
alter table public.cardio_blocks add column format text check (format in ('steady_state', 'intervals', 'pyramid', 'multi_week_programme'));
alter table public.cardio_blocks add column suggested_phase text;
alter table public.cardio_blocks add column source_label text;

alter table public.cardio_programmes add column impact_level text check (impact_level in ('low', 'moderate', 'high'));
alter table public.cardio_programmes add column format text check (format in ('steady_state', 'intervals', 'pyramid', 'multi_week_programme'));

-- Impact level from modality: the row/ski/bike ergs and walking are
-- low-impact, running (treadmill or outdoor) is high-impact, anything
-- modality-agnostic ("any") or unclassified defaults to moderate.
update public.cardio_blocks set impact_level = case
  when modality in ('running', 'treadmill', 'outdoor_run') then 'high'
  when modality in ('treadmill_walk', 'cycling', 'ski_erg', 'row_erg', 'cross_trainer') then 'low'
  else 'moderate'
end;

-- Format mirrors structure directly (same underlying values), except the
-- one block that's genuinely a pyramid shape.
update public.cardio_blocks set format = structure;
update public.cardio_blocks set format = 'pyramid' where name like 'Stepped Pyramid%';

-- Source: the 13 Concept2 button-sequence workouts and the CU/general-
-- walking treadmill content already carry a clear source; everything else
-- (the original starter library, running progression tiers) was written
-- for Athena directly, with no external citation, so it's David's own.
update public.cardio_blocks set source_label = 'Concept2 official' where name in (
  '10,000m with rate changes every 2000m', '6 x 1000m / 2 min easy', '50 calorie ride',
  '6 x 20 sec high intensity intervals', '4 x 2000m / 2 min easy', '3 x 1500m / 3 min easy',
  '6 x 2 min / 1 min easy', '4 x 4 min / 2 min easy', '12 x 1 min / 1 min easy',
  '3 x 750m / 3 min easy', '4 x 500m / 2 min easy', '5 x 3 min / 1 min easy',
  '2 x 2000m rate increase / 4 min easy'
);
update public.cardio_blocks set source_label = 'sports medicine protocol' where name like 'CU Return to Run:%';
update public.cardio_blocks set source_label = 'David''s own' where name like 'General Walking Progression:%';
update public.cardio_blocks set source_label = 'David''s own' where source_label is null;

-- Suggested phase, matching Section 4's own vocabulary (Early / return to
-- activity, Building capacity, Return to running or sport, Performance).
update public.cardio_blocks set suggested_phase = 'Early / return to activity' where category = 'return_to_run';
update public.cardio_blocks set suggested_phase = 'Return to running or sport'
  where name = 'CU Return to Run: Phase 3, Return to Distance Running';
update public.cardio_blocks set suggested_phase = 'Building capacity' where category = 'running_progression';
update public.cardio_blocks set suggested_phase = 'Early / return to activity' where name like 'General Walking Progression:%';
update public.cardio_blocks set suggested_phase = 'Performance' where name in (
  '10,000m with rate changes every 2000m', '6 x 1000m / 2 min easy', '50 calorie ride',
  '6 x 20 sec high intensity intervals', '4 x 2000m / 2 min easy', '3 x 1500m / 3 min easy',
  '6 x 2 min / 1 min easy', '4 x 4 min / 2 min easy', '12 x 1 min / 1 min easy',
  '3 x 750m / 3 min easy', '4 x 500m / 2 min easy', '5 x 3 min / 1 min easy',
  '2 x 2000m rate increase / 4 min easy'
);
update public.cardio_blocks set suggested_phase = 'Building capacity' where name in (
  'Easy Recovery (Short)', 'Easy Recovery (Long)', 'Moderate Steady State (Short)', 'Moderate Steady State (Long)'
);
update public.cardio_blocks set suggested_phase = 'Performance' where name in (
  'Tempo / Threshold', 'Stepped Pyramid (5 rep)', 'Classic 4x4', 'Short Sharp Intervals',
  'Long Threshold Intervals', 'Fartlek / Variable'
);

-- cardio_programmes: every plan currently in it runs on RowErg/SkiErg/
-- BikeErg (never running), so impact level is low across the board; format
-- is always multi_week_programme by definition of the table.
update public.cardio_programmes set impact_level = 'low', format = 'multi_week_programme';
