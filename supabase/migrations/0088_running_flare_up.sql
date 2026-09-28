-- Step 5 of the Running Builder brief: David's flare-up protocol. Tapping
-- "Having a flare-up?" swaps the next 6 calendar days of a running
-- programme for one fixed deload plan, then returns the client one rung
-- lower than where they were.

-- The deload plan is a normal, David-editable workout -- everything the
-- Workout builder already supports (blocks, cardio blocks, bare
-- exercises), created here with real library matches, never an AI guess.
-- This settings row just remembers which workout IS the one flare-up
-- plan, so code has a fixed thing to point at even if David later renames
-- it; he edits its CONTENT from the ordinary Workout builder, never this
-- row. The boolean primary key plus its check is the standard
-- "exactly one row, ever" pattern.
create table public.running_deload_settings (
  id boolean primary key default true,
  deload_workout_id uuid not null references public.workouts(id),
  constraint running_deload_settings_singleton check (id)
);

alter table public.running_deload_settings enable row level security;

-- One flare-up "episode" for one client's running programme -- which rung
-- they were on before it (so they go back one rung lower than that, not
-- one rung lower than wherever they happen to be later), when it started,
-- and when the 6 days are up. Clinic-only, same footing as
-- running_programme_state: RLS enabled, no policies.
create table public.running_flare_events (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  programme_state_id uuid not null references public.running_programme_state(id) on delete cascade,
  pre_flare_rung_number integer not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'resolved')),
  resolved_at timestamptz
);

alter table public.running_flare_events enable row level security;

-- One specific calendar date's whole session swapped for a different
-- workout -- today, always the flare-up deload plan, but written as a
-- general reason/workout pair rather than a flare-only boolean in case
-- something else ever needs the same one-date override. Read the same way
-- programme_workouts/workouts already are (supabaseAdmin, after ownership
-- is proven on the programme itself), so no patient RLS policy is needed
-- here either.
create table public.programme_day_overrides (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  override_date date not null,
  workout_id uuid not null references public.workouts(id),
  reason text not null default 'flare_up',
  flare_event_id uuid references public.running_flare_events(id) on delete cascade,
  unique (programme_id, override_date)
);

alter table public.programme_day_overrides enable row level security;

-- Seed the one deload workout. Real library matches only:
-- EX-194 "Clamshells" (Hip / Glute, band optional) for the banded
-- mobility, EX-094 "Hip Hinge Diagonals with Foam Roller" (Hip / Glute)
-- for the hip hinge diagonals -- both confident matches, nothing flagged.
-- Cardio duration is entered as a single representative value (steady
-- state fields don't hold a range); the 20-30 minute range from the brief
-- is kept in each one's coaching note so nothing is lost, and David can
-- adjust the exact numbers from the Cardio builder like any other block.
do $$
declare
  v_workout_id uuid := gen_random_uuid();
  v_bike_id uuid := gen_random_uuid();
  v_walk_id uuid := gen_random_uuid();
begin
  insert into public.workouts (id, name) values (v_workout_id, 'Running deload (flare-up)');

  insert into public.cardio_blocks (id, name, modality, structure, steady_duration_seconds, coaching_note)
  values (v_bike_id, 'Gym bike or easy swim', 'cycling', 'steady_state', 1500, '20 to 30 minutes, easy effort. Swap for an easy swim if preferred.');

  insert into public.cardio_blocks (id, name, modality, structure, steady_duration_seconds, coaching_note)
  values (v_walk_id, 'Walking', 'other', 'steady_state', 1500, '20 to 30 minutes, easy effort.');
  update public.cardio_blocks set modality_other = 'Walking' where id = v_walk_id;

  insert into public.workout_items (workout_id, item_order, slot_type, cardio_block_id) values (v_workout_id, 1, 'main_body', v_bike_id);
  insert into public.workout_items (workout_id, item_order, slot_type, cardio_block_id) values (v_workout_id, 2, 'main_body', v_walk_id);
  insert into public.workout_items (workout_id, item_order, slot_type, exercise_id, sets, reps, rationale)
  values (v_workout_id, 3, 'main_body', 'EX-194', 3, 15, 'Banded mobility while things settle.');
  insert into public.workout_items (workout_id, item_order, slot_type, exercise_id, sets, reps, rationale)
  values (v_workout_id, 4, 'main_body', 'EX-094', 2, 10, 'Hip hinge diagonals while things settle.');

  insert into public.running_deload_settings (deload_workout_id) values (v_workout_id);
end $$;
