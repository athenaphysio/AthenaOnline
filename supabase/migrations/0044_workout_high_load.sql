-- A manual, clinician-set flag on a Workout marking it a genuinely
-- high-load day (e.g. a heavy strength session or a hard interval run) --
-- deliberately not computed from percent_max or cardio intensity, since
-- judging which days are truly hard is exactly the kind of call that stays
-- the clinician's, not the app's. Powers a gentle, non-blocking prompt when
-- two high-load days land back to back on a patient's weekly schedule --
-- never a rule the app enforces.
alter table public.workouts add column high_load boolean not null default false;
