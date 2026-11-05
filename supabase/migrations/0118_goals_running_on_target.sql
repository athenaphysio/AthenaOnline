-- Performance goals and running for the Rowing and Running Builder, plus
-- Dr David Silver PhD's own one tap read of each voice note, which feeds
-- the "how it feels" strand of the on target measure.

-- Results can now be runs as well as rows. Running results carry pace per
-- km in avg_split_seconds; rowing results stay per 500m.
alter table public.rowing_results add column sport text not null default 'row' check (sport in ('row', 'run'));

-- David's read of a voice note. Set by him, never by the app, so a client
-- saying they weren't sure they were doing it right is never auto-flagged.
alter table public.voice_notes add column clinician_tag text check (clinician_tag in ('going_well', 'neutral', 'worth_watching'));

-- Three running strength sessions, placed on strength days the same way
-- as the rowing ones.
alter table public.rowing_settings add column run_strength_foundation_workout_id uuid references public.workouts(id) on delete set null;
alter table public.rowing_settings add column run_strength_build_workout_id uuid references public.workouts(id) on delete set null;
alter table public.rowing_settings add column run_strength_power_workout_id uuid references public.workouts(id) on delete set null;

-- Real library exercises only. Sets, reps and wording are a draft for
-- David to check.
do $$
declare
  v_foundation uuid := gen_random_uuid();
  v_build uuid := gen_random_uuid();
  v_power uuid := gen_random_uuid();
begin
  insert into public.workouts (id, name) values
    (v_foundation, 'Running Strength 1: Foundation'),
    (v_build, 'Running Strength 2: Build'),
    (v_power, 'Running Strength 3: Power and maintenance');

  insert into public.workout_items (workout_id, item_order, slot_type, exercise_id, sets, reps, hold_seconds, prescription_mode, rationale) values
    (v_foundation, 1, 'main_body', 'EX-178', 3, 10, null, 'reps_and_sets', 'Builds the knee and hip strength that absorbs each landing, thousands of times a run.'),
    (v_foundation, 2, 'main_body', 'EX-179', 3, 8, null, 'reps_and_sets', 'Strengthens the hamstrings and the back of the hips that drive you forward.'),
    (v_foundation, 3, 'main_body', 'EX-181', 3, 8, null, 'reps_and_sets', 'Single leg strength in the shape of running, one side at a time.'),
    (v_foundation, 4, 'main_body', 'EX-095', 3, 15, null, 'reps_and_sets', 'The calf takes several times your bodyweight with every stride, so we build it directly.'),
    (v_foundation, 5, 'main_body', 'EX-064', 3, null, 30, 'time_under_load', 'Side trunk endurance that keeps the pelvis level as you tire.'),
    (v_foundation, 6, 'main_body', 'EX-017', 2, null, 20, 'time_under_load', 'Inner thigh strength that steadies the hip and knee on each landing.'),
    (v_foundation, 7, 'main_body', 'EX-171', 3, 8, null, 'reps_and_sets', 'Trunk control so the legs have a stable base to push from.');

  insert into public.workout_items (workout_id, item_order, slot_type, exercise_id, sets, reps, hold_seconds, prescription_mode, rationale) values
    (v_build, 1, 'main_body', 'EX-177', 4, 6, null, 'reps_and_sets', 'Heavier leg strength, so each stride costs a smaller share of what you have.'),
    (v_build, 2, 'main_body', 'EX-014', 3, 8, null, 'reps_and_sets', 'Loaded single leg strength to even out the two sides.'),
    (v_build, 3, 'main_body', 'EX-066', 3, 8, null, 'reps_and_sets', 'Balance and hip strength on one leg, the position you land in.'),
    (v_build, 4, 'main_body', 'EX-012', 3, 10, null, 'reps_and_sets', 'Hip extension power for a stronger push off.'),
    (v_build, 5, 'main_body', 'EX-182', 3, 5, null, 'reps_and_sets', 'Hamstring strength at length, where they work hardest when you run faster.'),
    (v_build, 6, 'main_body', 'EX-095', 3, 12, null, 'reps_and_sets', 'Calf strength kept building alongside the heavier work.'),
    (v_build, 7, 'main_body', 'EX-018', 2, null, 20, 'time_under_load', 'A longer lever for the inner thigh, as running volume grows.');

  insert into public.workout_items (workout_id, item_order, slot_type, exercise_id, sets, reps, hold_seconds, prescription_mode, rationale) values
    (v_power, 1, 'main_body', 'EX-083', 3, 6, null, 'reps_and_sets', 'Quick, springy force off the ground, the quality that makes pace feel easier.'),
    (v_power, 2, 'main_body', 'EX-232', 3, 6, null, 'reps_and_sets', 'Elastic strength in the split position of running.'),
    (v_power, 3, 'main_body', 'EX-030', 3, 10, null, 'reps_and_sets', 'Short ground contacts that train the calf and Achilles to return energy.'),
    (v_power, 4, 'main_body', 'EX-177', 3, 4, null, 'reps_and_sets', 'Holds on to the strength you have built with fewer, faster reps so you stay fresh to run.'),
    (v_power, 5, 'main_body', 'EX-095', 2, 12, null, 'reps_and_sets', 'Calf strength kept ticking over through the taper.'),
    (v_power, 6, 'main_body', 'EX-007', 3, 10, null, 'reps_and_sets', 'Resisting rotation so the trunk stays quiet at speed.');

  update public.rowing_settings
  set run_strength_foundation_workout_id = v_foundation,
      run_strength_build_workout_id = v_build,
      run_strength_power_workout_id = v_power;
end $$;
