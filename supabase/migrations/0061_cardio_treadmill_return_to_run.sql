-- Treadmill return-to-run content from athena_cardio_library_v2.md Section
-- 2 (CU Sports Medicine / Dr. Rachel Frank protocol, cross-checked against
-- general return-to-run literature). A genuine clinical protocol, stored
-- here as a strong starting draft for David to review and correct, same
-- footing as the JOSPT hamstring guidance already in the library.
--
-- Distinct from the existing generic "Return to Run (Stage 1-4)" series
-- (0039_cardio_starter_library.sql) -- that series stays as is; these are
-- new, separately named entries ("CU Return to Run: ...") from this more
-- detailed, specifically-cited source, so nothing gets silently merged or
-- overwritten. Whether to keep both, retire one, or merge them is David's
-- call once he's reviewed this content.
--
-- "treadmill_walk" is a new modality (the protocol's own walking phase,
-- distinct from treadmill running) -- widens the existing check constraint
-- the same way 0038/0042 did when "any"/"treadmill"/"outdoor_run" were
-- added.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.cardio_blocks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%modality%running%'
  loop
    execute format('alter table public.cardio_blocks drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.cardio_blocks add constraint cardio_blocks_modality_check
  check (modality in ('running', 'treadmill', 'treadmill_walk', 'outdoor_run', 'cycling', 'ski_erg', 'row_erg', 'cross_trainer', 'any', 'other'));

-- Phase 1 (the protocol's own numbering) -- no entry criteria of its own;
-- it's the very first step in the whole progression. The plyometric
-- "quick response" phase that source Phase 2 covers (ladder drills, line
-- jumps, dot hops, building toward 500-600 foot contacts) isn't stored
-- here -- it's a large block of video-linked exercise content better
-- suited to its own exercise entries in Vault later, per the source note,
-- so it's referenced in text below rather than built as its own block.
insert into public.cardio_blocks
  (name, modality, structure, category, rationale,
   steady_duration_seconds, steady_pace)
values
  ('CU Return to Run: Walking Phase', 'treadmill_walk', 'steady_state', 'return_to_run',
   'Start on a treadmill rather than outdoor surfaces, for more control over pace and incline. Build up to 30 minutes pain-free at 3.5mph or faster before moving on to the quick-response/plyometric phase and then the walk/jog progression.',
   1800, '3.5mph or faster');

-- The walk/jog progression itself -- do each step 2-3 times before
-- advancing to the next. entry_criteria is the same gate on all four
-- steps, matching how the source scopes it to the whole walk/jog phase
-- rather than per individual step.
insert into public.cardio_blocks
  (name, modality, structure, category, rationale, entry_criteria,
   interval_reps, interval_work_seconds, interval_rest_mode, interval_rest_seconds, interval_rest_type)
values
  ('CU Return to Run: Step 1 (1 min run, 1 min walk)', 'treadmill', 'intervals', 'return_to_run',
   'Seven 1-minute run intervals with 1-minute walk recovery between, about 7 minutes of running in total. Repeat this step 2-3 times before advancing. No hills or incline and no speed work during this phase; focus on form, run every other day, and end every session with a 3-5 minute walk and some mobility work.',
   'Walk 30 minutes pain-free at a fairly brisk pace (3.5mph or faster), with no limp, full range of motion, and at least 80% strength symmetry compared with the uninjured side. Also assumes the quick-response/plyometric progression (ladder drills, line jumps, dot hops, hop/hold work) has been completed without pain or a limp during daily activity; that progression isn''t built into Vault as its own content yet. This is a gate for you to confirm per patient, not something the app decides.',
   7, 60, 'fixed_time', 60, 'walking'),

  ('CU Return to Run: Step 2 (2-3 min run, 1 min walk)', 'treadmill', 'intervals', 'return_to_run',
   'Five run intervals of 2 to 3 minutes each, with 1-minute walk recovery between, about 10 to 15 minutes of running in total (stored here at the lower bound, 2 minutes, as a representative starting value). Repeat this step 2-3 times before advancing. Same key points as Step 1: no hills, no speed work, focus on form, run every other day, walk and mobility work to finish.',
   'Walk 30 minutes pain-free at a fairly brisk pace (3.5mph or faster), with no limp, full range of motion, and at least 80% strength symmetry compared with the uninjured side. Also assumes the quick-response/plyometric progression (ladder drills, line jumps, dot hops, hop/hold work) has been completed without pain or a limp during daily activity; that progression isn''t built into Vault as its own content yet. This is a gate for you to confirm per patient, not something the app decides.',
   5, 120, 'fixed_time', 60, 'walking'),

  ('CU Return to Run: Step 3 (3-5 min run, 1 min walk)', 'treadmill', 'intervals', 'return_to_run',
   'Run intervals of 3 to 5 minutes each (stored here at the lower bound, 3 minutes, as a representative starting value), with 1-minute walk recovery between, toward about 20 minutes of running in total. The source doesn''t give a fixed rep count for this step, only the overall time target, so reps are left for you to set per patient. Repeat this step 2-3 times before advancing. Same key points: no hills, no speed work, focus on form, run every other day, walk and mobility work to finish.',
   'Walk 30 minutes pain-free at a fairly brisk pace (3.5mph or faster), with no limp, full range of motion, and at least 80% strength symmetry compared with the uninjured side. Also assumes the quick-response/plyometric progression (ladder drills, line jumps, dot hops, hop/hold work) has been completed without pain or a limp during daily activity; that progression isn''t built into Vault as its own content yet. This is a gate for you to confirm per patient, not something the app decides.',
   null, 180, 'fixed_time', 60, 'walking'),

  ('CU Return to Run: Step 4 (run to fatigue, 1-2 min walk)', 'treadmill', 'intervals', 'return_to_run',
   'Run to fatigue or form failure, then walk 1 to 2 minutes and repeat, toward about 25 to 30 minutes of running in total. This step is effort-based rather than a fixed work duration, so no reps or work time are set here; use this description as the prescription. Same key points: no hills, no speed work, focus on form, run every other day, walk and mobility work to finish.',
   'Walk 30 minutes pain-free at a fairly brisk pace (3.5mph or faster), with no limp, full range of motion, and at least 80% strength symmetry compared with the uninjured side. Also assumes the quick-response/plyometric progression (ladder drills, line jumps, dot hops, hop/hold work) has been completed without pain or a limp during daily activity; that progression isn''t built into Vault as its own content yet. This is a gate for you to confirm per patient, not something the app decides.',
   null, null, 'fixed_time', 90, 'walking');

-- After Step 4: move outdoors, every other day, building toward 30
-- continuous minutes. A target to build toward, not a fixed starting
-- duration.
insert into public.cardio_blocks
  (name, modality, structure, category, rationale, steady_duration_seconds)
values
  ('CU Return to Run: Outdoor Jog Progression', 'outdoor_run', 'steady_state', 'return_to_run',
   'Once the treadmill walk/jog steps above are comfortable, move to jogging outdoors every other day, building toward 30 continuous minutes. Still no hills or incline and no speed work at this stage; focus on form and end every session with a walk and some mobility work. 30 minutes here is the target to build toward, not a fixed starting duration.',
   1800);

-- Phase 3 -- an adaptive, criteria-based procedure rather than a fixed
-- single-session prescription (find a baseline, then progress it week by
-- week with reassessment built in), so it doesn't fit the reps/work/rest
-- model the way the earlier steps do. Stored as one reference block
-- carrying the full procedure in rationale, including the incline
-- guidance, rather than forcing it into fields that would misrepresent it
-- as a fixed prescription.
insert into public.cardio_blocks
  (name, modality, structure, category, rationale, entry_criteria, stop_rule)
values
  ('CU Return to Run: Phase 3, Return to Distance Running', 'running', 'steady_state', 'return_to_run',
   'Find your baseline first: on a treadmill, run as long as comfortable without pain during the run or for 48 hours after, and note the distance or pace where that holds. Weeks 1-2: run 2-3 times a week with a rest day between each; two shorter runs at 50-60% of baseline, one longer run at baseline. Weeks 3-6: run 3 times a week at baseline, each separated by a rest day, increasing distance by 10% per week. Week 5 onward: reassess baseline and increase accordingly, monitoring pain for 24-48 hours after any increase, capping weekly volume and long-run increases at 10%. Once at goal distance, introduce speed or hill work, one at a time, never both together, and be cautious with downhills specifically once hills are introduced. Incline guidance: a moderate treadmill incline (around 3-5%) can be useful once flat running is well tolerated, improving running mechanics and adding load gradually before true outdoor hills; avoid incline entirely during the walk/jog phase above, and introduce it only once this flat baseline is established, as the one variable being changed at a time.',
   'Comfortably completing the walk/jog progression above (25-30 minutes of running, most of it continuous) without pain during or in the 24-48 hours after. This is a gate for you to confirm per patient, not something the app decides.',
   'New or worsening pain during running, or pain that hasn''t settled within 24-48 hours of a distance or intensity increase, means hold at the current level rather than progress further.');
