-- The 13 confirmed Concept2 monitor-preset workouts from David's own
-- workout sheet, cross-checked against Concept2's site
-- (athena_cardio_library_concept2.md) -- 6 BikeErg, 7 SkiErg. Modality
-- 'cycling' stands in for BikeErg and 'ski_erg' for SkiErg, since neither
-- CardioModality nor this table's check constraint has a bike-erg-specific
-- value. rationale carries the plain-English description column verbatim.
--
-- A few of these don't cleanly fit the existing reps/work-seconds/rest
-- model, which is time-based, not distance-based: several pieces are
-- specified in metres (e.g. "6 x 1000m"), so interval_reps and the rest
-- fields are set but interval_work_seconds is left null for those --
-- the button sequence and rationale carry the real prescription regardless,
-- same principle as 0039's own documented Fartlek approximation.
insert into public.cardio_blocks
  (name, modality, structure, rationale, button_sequence_pm5,
   steady_distance_m,
   interval_reps, interval_work_seconds, interval_rest_mode, interval_rest_seconds,
   interval_rest_type, interval_rest_type_other)
values
  ('10,000m with rate changes every 2000m', 'cycling', 'steady_state',
   'Ride 10,000m total: 2000m @ 70rpm, 2000m @ 90rpm, 2000m @ 70rpm, 2000m @ 90rpm, 2000m @ 70rpm',
   'B-A-C', 10000, null, null, null, null, null, null),

  ('6 x 1000m / 2 min easy', 'cycling', 'intervals',
   'Six 1000m pieces, 2 min easy pedalling between',
   'B-D-D-A-D-B-A-C-C-C-C-A-A-A-A-B-B-E', null,
   6, null, 'fixed_time', 120, 'other', 'easy pedalling'),

  ('50 calorie ride', 'cycling', 'steady_state',
   'Monitor''s built-in preset -- ride to 50 calories',
   'B-A-D', null, null, null, null, null, null, null),

  ('6 x 20 sec high intensity intervals', 'cycling', 'intervals',
   '20 sec intense / 20 sec moderate, x6, ~4 min total',
   'B-D-D-B-A-B-B-D-C-E', null,
   6, 20, 'fixed_time', 20, 'other', 'moderate'),

  ('4 x 2000m / 2 min easy', 'cycling', 'intervals',
   'Four 2000m pieces, 2 min easy between',
   'B-D-D-A-D-B-B-A-C-C-C-C-A-A-A-A-B-B-E', null,
   4, null, 'fixed_time', 120, 'other', 'easy pedalling'),

  ('3 x 1500m / 3 min easy', 'cycling', 'intervals',
   'Three 1500m pieces, 3 min easy between',
   'B-D-D-A-D-B-A-A-A-A-A-B-B-B-E', null,
   3, null, 'fixed_time', 180, 'other', 'easy pedalling');

-- SkiErg -- carries both button_sequence_pm3_4 and button_sequence_pm5,
-- since the reference file gives both and they genuinely differ for some
-- of these (e.g. "12 x 1 min").
insert into public.cardio_blocks
  (name, modality, structure, rationale, button_sequence_pm3_4, button_sequence_pm5,
   interval_reps, interval_work_seconds, interval_rest_mode, interval_rest_seconds,
   interval_rest_type, interval_rest_type_other)
values
  ('6 x 2 min / 1 min easy', 'ski_erg', 'intervals',
   'Six 2-minute pieces, 1 min light pressure between',
   'B-D-D-B-A-A-A-A-B-E', 'B-D-D-B-A-A-A-A-B-E',
   6, 120, 'fixed_time', 60, 'other', 'light pressure'),

  ('4 x 4 min / 2 min easy', 'ski_erg', 'intervals',
   'Four 4-minute pieces, 2 min light pressure between',
   'B-D-D-B-B-B-A-A-A-A-B-B-E', 'B-D-D-B-B-B-A-A-A-A-B-B-E',
   4, 240, 'fixed_time', 120, 'other', 'light pressure'),

  ('12 x 1 min / 1 min easy', 'ski_erg', 'intervals',
   'Twelve 1-min work / 1-min rest, 24 min total',
   'B-D-D-A-A-A-A-B-E', 'B-D-D-B-A-A-A-A-B-E',
   12, 60, 'fixed_time', 60, 'other', 'light pressure'),

  ('3 x 750m / 3 min easy', 'ski_erg', 'intervals',
   'Three 750m pieces, 3 min light pressure between',
   'B-D-C-B-B-A-B-B-B-B-B-A-A-A-B-B-B-E', 'B-D-D-A-B-B-A-B-B-B-B-A-A-A-B-B-B-E',
   3, null, 'fixed_time', 180, 'other', 'light pressure'),

  ('4 x 500m / 2 min easy', 'ski_erg', 'intervals',
   'Four 500m pieces, 2 min light pressure between',
   'B-D-C-A-A-A-A-B-B-E', 'B-D-D-A-A-A-A-B-B-E',
   4, null, 'fixed_time', 120, 'other', 'light pressure'),

  ('5 x 3 min / 1 min easy', 'ski_erg', 'intervals',
   'Five 3-minute pieces, 1 min light pressure between',
   'B-D-D-B-B-A-A-A-A-B-E', 'B-D-D-B-B-A-A-A-A-B-E',
   5, 180, 'fixed_time', 60, 'other', 'light pressure'),

  ('2 x 2000m rate increase / 4 min easy', 'ski_erg', 'intervals',
   'Two 2000m pieces: first 1000m @ 35-40spm, then 500m @ 40-42, 250m @ 42-44, 250m @ 45+spm; 4 min light pressure between',
   'B-D-C-D-B-B-A-C-C-C-C-A-A-A-B-B-B-B-E', 'B-D-D-A-D-B-B-A-C-C-C-C-A-A-A-B-B-B-B-E',
   2, null, 'fixed_time', 240, 'other', 'light pressure');
