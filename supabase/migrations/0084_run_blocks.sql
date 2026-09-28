-- A Run block is a new item kind in a Workout, alongside a standalone
-- exercise, a Block reference, and a cardio block reference. Unlike blocks
-- and cardio blocks, a Run block isn't a shared/reusable library row -- it's
-- one-off fields filled in directly per placement, the same way a bare
-- exercise_id item already carries its own sets/reps directly on
-- workout_items rather than pointing at a separate table. So this adds
-- columns straight onto workout_items plus a boolean discriminator, not a
-- new table.

alter table public.workout_items add column is_run_block boolean not null default false;
alter table public.workout_items add column run_title text;
alter table public.workout_items add column run_warmup_walk text;
alter table public.workout_items add column run_repeats integer;
alter table public.workout_items add column run_portion_value numeric;
alter table public.workout_items add column run_portion_unit text check (run_portion_unit in ('min', 'km', 'm'));
alter table public.workout_items add column run_recovery_duration text;
alter table public.workout_items add column run_recovery_type text check (run_recovery_type in ('walk', 'jog', 'standing'));
alter table public.workout_items add column run_target_pace text;
alter table public.workout_items add column run_effort_cue text;
alter table public.workout_items add column run_surface text;
alter table public.workout_items add column run_cooldown text;

-- workout_items.id itself is not stable across a workout's saves --
-- saveWorkout's PATCH deletes and re-inserts every row on every save (see
-- src/app/api/clinic/workouts/[id]/route.ts) -- so a Run block gets its own
-- client-generated stable id, carried through every save exactly the way
-- exercise_id/cardio_block_id already are, rather than being keyed on the
-- workout_item row itself. Defaulted so it's never null even if a caller
-- forgets to send one.
alter table public.workout_items add column run_stable_id uuid not null default gen_random_uuid();

-- Widen the three-way exclusivity check (0036_cardio_blocks.sql) to four,
-- found by its definition rather than a guessed name, same technique that
-- migration itself used to widen the original two-way check.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.workout_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%block_id%exercise_id%cardio_block_id%'
  loop
    execute format('alter table public.workout_items drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.workout_items add constraint workout_items_exactly_one_source check (
  (case when block_id is not null then 1 else 0 end)
  + (case when exercise_id is not null then 1 else 0 end)
  + (case when cardio_block_id is not null then 1 else 0 end)
  + (case when is_run_block then 1 else 0 end) = 1
);

-- A completed Run block has no shared library id to key session_completions
-- on the way exercise_id/cardio_block_id do, so it keys on the Run block's
-- own stable id instead (see run_stable_id above) -- no foreign key, since
-- that id isn't a primary key of anything, the same trust-the-app looseness
-- already used for this table's other nullable fields.
alter table public.session_completions add column run_stable_id uuid;

alter table public.session_completions drop constraint session_completions_shape;

alter table public.session_completions add constraint session_completions_shape check (
  (status = 'completed' and (
    (case when exercise_id is not null then 1 else 0 end)
    + (case when cardio_block_id is not null then 1 else 0 end)
    + (case when run_stable_id is not null then 1 else 0 end) = 1
  ))
  or
  (status = 'skipped' and exercise_id is null and cardio_block_id is null and run_stable_id is null)
);

create unique index session_completions_run_unique
  on public.session_completions (patient_id, programme_id, run_stable_id, week_number, day_of_week)
  where status = 'completed' and run_stable_id is not null;
