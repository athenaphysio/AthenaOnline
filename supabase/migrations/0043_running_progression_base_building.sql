-- The four Base Building sessions for Running Progression, in order.
-- Modality is 'treadmill' for all four -- Base Building is explicitly the
-- little-to-no-current-running-fitness starting point, and treadmill is
-- the safer, pace-controlled option; outdoor (perceived effort) belongs to
-- a later tier once someone's progressed, not flagged per-session here so
-- storing all four as treadmill for now, worth David's eye.
--
-- Each session's stated intensity is a range (e.g. "~55-60%"), but
-- interval_intensities_percent only stores one number per rep -- each row
-- below uses the range's rounded midpoint (58 for 55-60%, 63 for 60-65%)
-- applied evenly across every rep, an approximation rather than an exact
-- transcription. The exact range is preserved nowhere else in the schema,
-- so worth David's eye before these go live; easy to adjust per rep in the
-- editor if a different value within the range is wanted.
--
-- coaching_note carries the standing cadence cue asked for across the
-- whole Running Progression category; stop_rule is repeated verbatim
-- across all four, same technique as the Return to Run series in
-- 0039_cardio_starter_library.sql.
insert into public.cardio_blocks
  (name, modality, structure, rationale, category, tier, coaching_note,
   interval_reps, interval_work_seconds, interval_intensities_percent,
   interval_rest_mode, interval_rest_seconds, interval_rest_type, stop_rule)
values
  ('Base Building: Session 1', 'treadmill', 'intervals',
   'The first real running stimulus. Short enough that a single session can''t create a dangerous spike, long enough recovery that fatigue never compounds across reps.',
   'running_progression', 'base_building',
   'A 5 to 10 percent increase in step rate reduces knee loading meaningfully, with no change in pace.',
   6, 60, array[58,58,58,58,58,58], 'fixed_time', 180, 'walking',
   'If a session feels notably harder than the last one felt at the same stage, or there''s next-day soreness that hasn''t settled within 24 hours, repeat the current stage rather than advancing. This is exactly what the evidence on single-session spikes is warning against.'),

  ('Base Building: Session 2', 'treadmill', 'intervals',
   'A modest step up in continuous running time, not total volume. Hold here until it''s comfortable across at least two or three outings before moving on.',
   'running_progression', 'base_building',
   'A 5 to 10 percent increase in step rate reduces knee loading meaningfully, with no change in pace.',
   6, 120, array[58,58,58,58,58,58], 'fixed_time', 150, 'walking',
   'If a session feels notably harder than the last one felt at the same stage, or there''s next-day soreness that hasn''t settled within 24 hours, repeat the current stage rather than advancing. This is exactly what the evidence on single-session spikes is warning against.'),

  ('Base Building: Session 3', 'treadmill', 'intervals',
   'Continuous running now exceeds the walking recovery for the first time. This is a genuine step up; worth confirming Session 2 felt easy before starting here.',
   'running_progression', 'base_building',
   'A 5 to 10 percent increase in step rate reduces knee loading meaningfully, with no change in pace.',
   5, 180, array[63,63,63,63,63], 'fixed_time', 120, 'walking',
   'If a session feels notably harder than the last one felt at the same stage, or there''s next-day soreness that hasn''t settled within 24 hours, repeat the current stage rather than advancing. This is exactly what the evidence on single-session spikes is warning against.'),

  ('Base Building: Session 4', 'treadmill', 'intervals',
   'The bridge toward continuous running. Still interval-based, but each rep is now long enough that this genuinely builds toward steady-state capacity, not just tolerance.',
   'running_progression', 'base_building',
   'A 5 to 10 percent increase in step rate reduces knee loading meaningfully, with no change in pace.',
   4, 300, array[63,63,63,63], 'fixed_time', 90, 'walking',
   'If a session feels notably harder than the last one felt at the same stage, or there''s next-day soreness that hasn''t settled within 24 hours, repeat the current stage rather than advancing. This is exactly what the evidence on single-session spikes is warning against.');
