-- Rowing Builder: a goal based indoor rowing plan built from a client's
-- available days, their event date and a 20 minute test, with Concept2
-- Logbook results (from the PM5, usually via the ErgData app) feeding
-- suggestions that Dr David Silver PhD approves or holds.
--
-- The plan itself is ordinary plan cards in an ordinary programme (the same
-- workouts.plan_session cards that pasted plan code produces), so the
-- client sees and logs it exactly like any other weekly programme. Each
-- rowing card carries a small `rowing` object inside plan_session (its
-- stable key, zone and target splits) so results can be compared against
-- it and its paces rewritten later. Nothing here needs a schema change on
-- workouts for that.

-- One row per rowing programme: what the builder was given, and the
-- reference split every pace is worked out from. programme_id has no
-- foreign key on purpose: this row is written when David opens the
-- generated plan in the programme builder, before the programme itself is
-- saved, and an unsaved draft leaves a harmless orphan that nothing reads
-- (every reader joins through a real programmes row first).
create table public.rowing_plans (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null unique,
  patient_id uuid references public.patients(id) on delete cascade,
  inputs jsonb not null,
  -- Seconds per 500m from the 20 minute test (or the latest approved
  -- change to it). Every zone is an offset from this one number.
  reference_split_seconds numeric(6,2) not null,
  reference_source text not null default 'entry_test'
    check (reference_source in ('entry_test', 'new_test', 'paces_up', 'paces_down')),
  -- Spare weeks between the plan's natural length and the event, so a
  -- "hold this week" can push the plan back without eating the taper.
  slack_weeks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rowing_plans enable row level security;

-- A client's link to their own Concept2 Logbook. Tokens never leave the
-- server: RLS is on with no policies, so only the service role reads it.
create table public.concept2_connections (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  c2_user_id bigint,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null default 'user:read,results:read',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text
);

alter table public.concept2_connections enable row level security;

-- Short lived state for the connect flow, so the callback can prove the
-- request started from this client's own session.
create table public.concept2_oauth_states (
  state text primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.concept2_oauth_states enable row level security;

-- Rows from the erg. Either pulled from the Concept2 Logbook (c2_result_id
-- set) or typed in by David from a PM5 screen photo (source 'manual').
create table public.rowing_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  c2_result_id bigint unique,
  source text not null default 'concept2' check (source in ('concept2', 'manual')),
  rowed_on date not null,
  distance_m integer not null check (distance_m > 0),
  time_tenths integer not null check (time_tenths > 0),
  avg_split_seconds numeric(6,2) not null,
  stroke_rate smallint,
  avg_hr smallint,
  workout_type text,
  note text,
  created_at timestamptz not null default now()
);

create index rowing_results_patient_date on public.rowing_results (patient_id, rowed_on desc);

alter table public.rowing_results enable row level security;

create policy "Clients can read their own rows" on public.rowing_results
  for select using (auth.uid() = patient_id);

-- What the data suggests, waiting for David. Approve applies it; Hold
-- records that he saw it and chose not to.
create table public.rowing_suggestions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('new_test', 'paces_up', 'paces_down', 'hold_week')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'held')),
  from_split_seconds numeric(6,2),
  to_split_seconds numeric(6,2),
  week_number integer,
  reason text not null,
  evidence jsonb not null default '[]'::jsonb,
  source_result_id uuid references public.rowing_results(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index rowing_suggestions_one_pending_per_kind
  on public.rowing_suggestions (programme_id, kind) where status = 'pending';

alter table public.rowing_suggestions enable row level security;

-- The three rowing strength sessions the builder drops onto strength days,
-- remembered here so code has a fixed thing to point at even if they are
-- renamed. Their content is edited in the ordinary Workout builder.
create table public.rowing_settings (
  id boolean primary key default true,
  strength_foundation_workout_id uuid references public.workouts(id) on delete set null,
  strength_build_workout_id uuid references public.workouts(id) on delete set null,
  strength_power_workout_id uuid references public.workouts(id) on delete set null,
  constraint rowing_settings_singleton check (id)
);

alter table public.rowing_settings enable row level security;

-- Seed the three strength sessions from real library exercises only. The
-- sets, reps and wording are a draft starting point for David to check.
do $$
declare
  v_foundation uuid := gen_random_uuid();
  v_build uuid := gen_random_uuid();
  v_power uuid := gen_random_uuid();
begin
  insert into public.workouts (id, name) values
    (v_foundation, 'Rowing Strength 1: Foundation'),
    (v_build, 'Rowing Strength 2: Build'),
    (v_power, 'Rowing Strength 3: Power and maintenance');

  insert into public.workout_items (workout_id, item_order, slot_type, exercise_id, sets, reps, hold_seconds, prescription_mode, rationale) values
    (v_foundation, 1, 'main_body', 'EX-178', 3, 10, null, 'reps_and_sets', 'The leg drive at the catch is a squat pattern, so we groove it here with a load you can own.'),
    (v_foundation, 2, 'main_body', 'EX-179', 3, 8, null, 'reps_and_sets', 'Builds the hinge and the back of the hips that carry the body swing through the drive.'),
    (v_foundation, 3, 'main_body', 'EX-110', 3, 12, null, 'reps_and_sets', 'Strengthens the finish of the stroke so the arms and upper back hold their shape late in a long row.'),
    (v_foundation, 4, 'main_body', 'EX-001', 3, 12, null, 'reps_and_sets', 'Glute and hamstring endurance for the many thousands of strokes in an event.'),
    (v_foundation, 5, 'main_body', 'EX-171', 3, 8, null, 'reps_and_sets', 'Trunk control so force from the legs reaches the handle rather than leaking through the back.'),
    (v_foundation, 6, 'main_body', 'EX-064', 3, null, 30, 'time_under_load', 'Side trunk endurance that keeps you stable on the seat as you tire.'),
    (v_foundation, 7, 'main_body', 'EX-158', 2, 8, null, 'reps_and_sets', 'Keeps the upper back moving after long spells in the rowing position.');

  insert into public.workout_items (workout_id, item_order, slot_type, exercise_id, sets, reps, hold_seconds, prescription_mode, rationale) values
    (v_build, 1, 'main_body', 'EX-177', 4, 6, null, 'reps_and_sets', 'Heavier leg strength, so each drive costs a smaller share of what you have.'),
    (v_build, 2, 'main_body', 'EX-180', 4, 5, null, 'reps_and_sets', 'Whole posterior chain strength for a powerful, connected drive from the floor up.'),
    (v_build, 3, 'main_body', 'EX-081', 4, 8, null, 'reps_and_sets', 'The pulling strength of the finish, trained with the trunk held in a hinge just as it is on the erg.'),
    (v_build, 4, 'main_body', 'EX-014', 3, 8, null, 'reps_and_sets', 'Single leg strength to even out the drive between the two sides.'),
    (v_build, 5, 'main_body', 'EX-011', 3, 10, null, 'reps_and_sets', 'Hip extension strength for the moment the legs finish and the body swings back.'),
    (v_build, 6, 'main_body', 'EX-114', 3, 10, null, 'reps_and_sets', 'Lat strength that links the handle to the trunk through the finish.'),
    (v_build, 7, 'main_body', 'EX-007', 3, 10, null, 'reps_and_sets', 'Resisting rotation so the stroke stays square under load.');

  insert into public.workout_items (workout_id, item_order, slot_type, exercise_id, sets, reps, hold_seconds, prescription_mode, rationale) values
    (v_power, 1, 'main_body', 'EX-236', 4, 10, null, 'reps_and_sets', 'Fast hip extension, the same quick, crisp drive you want off the catch.'),
    (v_power, 2, 'main_body', 'EX-177', 3, 4, null, 'reps_and_sets', 'Holds on to the strength you have built with fewer, faster reps so you stay fresh to row.'),
    (v_power, 3, 'main_body', 'EX-063', 3, 5, null, 'reps_and_sets', 'Links legs, hips and arms in one quick sequence, as the stroke does.'),
    (v_power, 4, 'main_body', 'EX-115', 3, 8, null, 'reps_and_sets', 'Pulling strength with control of the trunk, kept ticking over.'),
    (v_power, 5, 'main_body', 'EX-172', 3, null, 30, 'time_under_load', 'Trunk stiffness under load, carried into the later stages of a long row.'),
    (v_power, 6, 'main_body', 'EX-170', 3, null, 40, 'time_under_load', 'Trunk endurance maintained without adding fatigue before the event.');

  insert into public.rowing_settings (strength_foundation_workout_id, strength_build_workout_id, strength_power_workout_id)
  values (v_foundation, v_build, v_power);
end $$;
