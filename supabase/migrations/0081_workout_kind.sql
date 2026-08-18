-- Cardio workouts as their own type of workout.
--
-- A discriminator on workouts rather than a parallel table: a cardio
-- workout is still a session that gets assigned to a day, saved into a
-- programme, and rendered to a client, so a second table would mean a
-- second workout_items, a second assignment path and a second session
-- pipeline, for nothing a client would ever see. One pipeline underneath,
-- two genuinely separate types everywhere it matters -- separate builders,
-- separate libraries, separate Vault tabs.
--
-- Defaulting to 'standard' leaves every existing workout exactly where it
-- already is, in the Workouts library.

alter table workouts
  add column if not exists kind text not null default 'standard';

create index if not exists workouts_kind_idx on workouts (kind);
