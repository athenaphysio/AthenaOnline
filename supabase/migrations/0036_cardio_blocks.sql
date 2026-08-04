-- Cardio blocks: a third droppable item in the Workout Builder, alongside
-- standalone exercises and Blocks. Structured the same way a Block is -- a
-- shared, reusable library row referenced by id from workout_items, so
-- dropping the same cardio block onto many patients' workouts is just
-- referencing the same row (mirrors how a Block or an Exercise is reused).
-- Unlike a Block, a cardio block carries no per-week progression -- it's one
-- fixed prescription, matching the "drop it as a preset" use case (e.g.
-- "5x1min run intervals, moderate").
--
-- Every field below except id/name/modality/structure/timestamps is
-- nullable -- same looseness as workout_items.sets/reps/etc, trusting the
-- clinician rather than hard-validating in the database. interval_reps
-- and steady_duration_seconds aren't required at the database level either,
-- since a cardio block is created bare (name + modality + structure only,
-- same as "+ New block") and filled in afterwards via the inline editor,
-- persisted only when the parent Workout is saved.
create table public.cardio_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  modality text not null check (modality in ('running', 'cycling', 'ski_erg', 'row_erg', 'cross_trainer', 'other')),
  modality_other text,
  structure text not null check (structure in ('steady_state', 'intervals')),
  rationale text,

  -- Steady-state fields.
  steady_duration_seconds integer,
  steady_distance_m integer,
  steady_intensity_percent integer,
  steady_hr_zone text,
  steady_pace text,
  steady_power_watts integer,
  steady_cadence integer,
  steady_incline_resistance text,

  -- Interval fields. interval_intensities_percent holds one value per rep
  -- (may contain nulls for reps the clinician hasn't set an intensity for
  -- yet), so intensity can step up or down across the set, e.g.
  -- {60,70,80,90,100} for a five-rep ramp.
  interval_reps integer,
  interval_work_seconds integer,
  interval_intensities_percent integer[],
  interval_rest_mode text check (interval_rest_mode in ('fixed_time', 'percent_recovered')),
  interval_rest_seconds integer,
  interval_rest_percent_recovered integer,
  interval_rest_type text check (interval_rest_type in ('walking', 'stationary', 'other')),
  interval_rest_type_other text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cardio_blocks enable row level security;

-- Same read-only widening as blocks/workouts (0017_coach_template_editing.sql)
-- -- shared clinical content, not patient data. Owner-side reads/writes go
-- through supabaseAdmin (service role), which bypasses RLS entirely, so no
-- insert/update policy is needed here -- coaches never edit library content,
-- only a template's own schedule (same as blocks/workouts today).
create policy "Coaches can read the cardio block library" on public.cardio_blocks
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

-- A workout item is exactly one of: a standalone exercise, a Block
-- reference, or a cardio block reference. Widens the existing two-way
-- exclusivity check from 0009_content_hierarchy.sql (`check ((block_id is
-- not null) <> (exercise_id is not null))`) to three -- found by its
-- definition rather than a guessed constraint name, since Postgres
-- auto-names unnamed table checks and guessing wrong would silently leave
-- the old two-way check in place alongside the new one, blocking every
-- cardio item outright.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.workout_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%block_id%exercise_id%'
  loop
    execute format('alter table public.workout_items drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.workout_items add column cardio_block_id uuid references public.cardio_blocks(id);

alter table public.workout_items add constraint workout_items_exactly_one_source check (
  (case when block_id is not null then 1 else 0 end)
  + (case when exercise_id is not null then 1 else 0 end)
  + (case when cardio_block_id is not null then 1 else 0 end) = 1
);
