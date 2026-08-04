-- The fourteen starter cardio blocks: five steady-state, five interval, and
-- a four-stage Return to Run series. Modality is set to 'any' for the ten
-- generic ones (a deliberate, storable "not modality-specific" default --
-- David picks the real one per patient via the per-drop override) and
-- 'running' for the Return to Run series, which is genuinely run-specific.
--
-- Two clinical decisions worth flagging rather than silently guessing:
-- 1. Fartlek / Variable's brief ("20 min total, alternating 2 min moderate
--    / 1 min hard throughout") doesn't divide evenly into the reps/work/rest
--    model every other block uses -- it's stored here as 6 reps of 1 min
--    hard work with a 2 min moderate-paced recovery (18 min total, close to
--    but not exactly the stated 20), an approximation, not an exact
--    transcription. Worth David's eye before this one gets used.
-- 2. "Treadmill (recommended first) or Outdoor" for the Return to Run
--    series doesn't map to any existing field (modality here means running
--    vs cycling vs rowing etc, not surface/environment) -- stored as
--    modality 'running' with the treadmill/outdoor guidance left out
--    rather than folded into the rationale text, which was asked to be
--    used exactly as given.
insert into public.cardio_blocks
  (name, modality, structure, rationale, steady_duration_seconds, steady_intensity_percent)
values
  ('Easy Recovery (Short)', 'any', 'steady_state',
   'A short, easy spin or jog to keep things moving without adding load. Good the day after something harder, or on a lighter week.',
   900, 60),
  ('Easy Recovery (Long)', 'any', 'steady_state',
   'Same idea, more time under it. Builds a base without asking the body to work hard; this should feel comfortable the whole way through.',
   1800, 60),
  ('Moderate Steady State (Short)', 'any', 'steady_state',
   'A genuine aerobic effort, working but sustainable. This is where most of your engine gets built over time.',
   1200, 72),
  ('Moderate Steady State (Long)', 'any', 'steady_state',
   'Same effort, longer exposure. Good once the shorter version feels comfortable.',
   1800, 72),
  ('Tempo / Threshold', 'any', 'steady_state',
   'Right at the edge of comfortable; this is the effort that teaches the body to hold a hard pace for longer. Should feel like a genuine push by the end.',
   900, 82);

insert into public.cardio_blocks
  (name, modality, structure, rationale, interval_reps, interval_work_seconds, interval_intensities_percent,
   interval_rest_mode, interval_rest_seconds, interval_rest_percent_recovered, interval_rest_type, interval_rest_type_other)
values
  ('Stepped Pyramid (5 rep)', 'any', 'intervals',
   'Builds up and back down rather than repeating the same effort; the middle rep is the only truly hard one, so it''s a manageable way to touch a high effort without it wrecking the rest of the session.',
   5, 60, array[55,75,90,75,55], 'percent_recovered', null, 75, null, null),
  ('Classic 4x4', 'any', 'intervals',
   'A well-established structure for building the top end of aerobic capacity. Four hard efforts with real recovery between them, so quality stays high across all four.',
   4, 240, array[88,88,88,88], 'fixed_time', 180, null, 'other', 'easy'),
  ('Short Sharp Intervals', 'any', 'intervals',
   'Short, hard bursts with equally short recovery; good for building the ability to repeat high efforts, more anaerobic than aerobic.',
   10, 30, array[92,92,92,92,92,92,92,92,92,92], 'fixed_time', 30, null, 'other', 'easy'),
  ('Long Threshold Intervals', 'any', 'intervals',
   'Longer efforts at a hard-but-sustainable pace, broken into three so the quality holds up across the whole session rather than fading in one long block.',
   3, 480, array[82,82,82], 'fixed_time', 120, null, 'other', 'easy'),
  ('Fartlek / Variable', 'any', 'intervals',
   'Unstructured-feeling but genuinely purposeful; the changes in pace keep things interesting and build the ability to shift gears mid-effort, useful for anyone whose sport demands variable pace rather than one steady speed.',
   6, 60, array[90,90,90,90,90,90], 'fixed_time', 120, null, 'other', 'moderate pace');

insert into public.cardio_blocks
  (name, modality, structure, rationale, interval_reps, interval_work_seconds, interval_intensities_percent,
   interval_rest_mode, interval_rest_seconds, interval_rest_type, category, entry_criteria, stop_rule)
values
  ('Return to Run (Stage 1)', 'running', 'intervals',
   'The very first reintroduction of running, short enough that it can''t do much harm, long enough recovery that fatigue never builds. The point here isn''t fitness, it''s proving the tissue tolerates running at all.',
   5, 60, array[55,55,55,55,55], 'fixed_time', 240, 'walking', 'return_to_run',
   'The patient should be able to walk briskly for 30 minutes with no pain, limping, or swelling, and have reasonable strength symmetry and full range of motion at the affected joint. This is a gate for you to confirm per patient, not something the app decides.',
   'Persistent or worsening pain during running, pain the next morning that hasn''t settled within 24 hours, or new compensation showing up elsewhere, such as a new ache somewhere unrelated. Any one of these means hold at the current stage, or step back a stage, rather than progress.'),
  ('Return to Run (Stage 2)', 'running', 'intervals',
   'Same easy effort, a little more continuous time on it. Move here once Stage 1 has been comfortable for a few sessions, not on a fixed timeline.',
   5, 120, array[55,55,55,55,55], 'fixed_time', 180, 'walking', 'return_to_run',
   'The patient should be able to walk briskly for 30 minutes with no pain, limping, or swelling, and have reasonable strength symmetry and full range of motion at the affected joint. This is a gate for you to confirm per patient, not something the app decides.',
   'Persistent or worsening pain during running, pain the next morning that hasn''t settled within 24 hours, or new compensation showing up elsewhere, such as a new ache somewhere unrelated. Any one of these means hold at the current stage, or step back a stage, rather than progress.'),
  ('Return to Run (Stage 3)', 'running', 'intervals',
   'The run segments now outweigh the walks. Still easy pace; this stage is about duration tolerance, not speed.',
   5, 180, array[55,55,55,55,55], 'fixed_time', 120, 'walking', 'return_to_run',
   'The patient should be able to walk briskly for 30 minutes with no pain, limping, or swelling, and have reasonable strength symmetry and full range of motion at the affected joint. This is a gate for you to confirm per patient, not something the app decides.',
   'Persistent or worsening pain during running, pain the next morning that hasn''t settled within 24 hours, or new compensation showing up elsewhere, such as a new ache somewhere unrelated. Any one of these means hold at the current stage, or step back a stage, rather than progress.'),
  ('Return to Run (Stage 4)', 'running', 'intervals',
   'The last step before continuous running. A short walk break remains as a safety margin, not because it''s still needed physically for most patients by this point.',
   5, 240, array[55,55,55,55,55], 'fixed_time', 60, 'walking', 'return_to_run',
   'The patient should be able to walk briskly for 30 minutes with no pain, limping, or swelling, and have reasonable strength symmetry and full range of motion at the affected joint. This is a gate for you to confirm per patient, not something the app decides.',
   'Persistent or worsening pain during running, pain the next morning that hasn''t settled within 24 hours, or new compensation showing up elsewhere, such as a new ache somewhere unrelated. Any one of these means hold at the current stage, or step back a stage, rather than progress.');
