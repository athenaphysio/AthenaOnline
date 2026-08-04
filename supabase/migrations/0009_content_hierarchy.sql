-- Content hierarchy: Exercise -> Block -> Workout -> Programme.
--
-- A Block is a reusable, typed group of exercises with its own week-to-week
-- progression (this is what programme_items/programme_item_weeks used to be,
-- just decoupled from any single patient). A Workout is one full session,
-- built from several Blocks (plus optionally standalone exercises added
-- directly). A Programme schedules Workouts onto specific day(s) of the
-- week, per patient.

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('warm_up', 'activation', 'main_body', 'injury_prevention', 'cool_down')),
  block_length_weeks integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.block_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.blocks(id) on delete cascade,
  item_order integer not null
);

create table public.block_item_weeks (
  id uuid primary key default gen_random_uuid(),
  block_item_id uuid not null references public.block_items(id) on delete cascade,
  week_number integer not null,
  exercise_id text not null references public.exercises(exercise_id),
  rationale text,
  sets integer,
  reps integer,
  hold_seconds integer,
  percent_max integer,
  frequency text,
  unique (block_item_id, week_number)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one of block_id / exercise_id is set. block_id items get their
-- content from the block's own block_item_weeks (progression lives there);
-- exercise_id items are a standalone add with a single fixed prescription,
-- no week-by-week progression.
create table public.workout_items (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  item_order integer not null,
  slot_type text not null check (slot_type in ('warm_up', 'activation', 'main_body', 'injury_prevention', 'cool_down')),
  block_id uuid references public.blocks(id),
  exercise_id text references public.exercises(exercise_id),
  rationale text,
  sets integer,
  reps integer,
  hold_seconds integer,
  percent_max integer,
  frequency text,
  check ((block_id is not null) <> (exercise_id is not null))
);

-- Which Workout runs on which day(s) of the week, per programme.
-- day_of_week: 1 = Monday .. 7 = Sunday (ISO).
create table public.programme_workouts (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  workout_id uuid not null references public.workouts(id),
  day_of_week integer not null check (day_of_week between 1 and 7),
  created_at timestamptz not null default now(),
  unique (programme_id, day_of_week)
);

-- Retire the old flat programme structure and the templates feature --
-- both are superseded by the Block/Workout hierarchy above.
drop table if exists public.programme_item_weeks;
drop table if exists public.programme_items;
drop table if exists public.programme_template_item_weeks;
drop table if exists public.programme_template_items;
drop table if exists public.programme_templates;

-- RLS: Blocks/Workouts and their children are shared clinical content, not
-- patient data -- there is no patient_id on any of these tables. Nobody
-- reads them with the anon/authenticated role at all; the clinic writes via
-- the service_role key, and the patient-facing app reads them server-side
-- with service_role only after it has already verified (via the patient's
-- own login and the unchanged RLS on `programmes`) that this is genuinely
-- their programme. No policy is created here, which means select/insert/
-- update/delete are all denied by default for anon/authenticated once RLS
-- is enabled -- matching how programme_templates was locked down before it.
alter table public.blocks enable row level security;
alter table public.block_items enable row level security;
alter table public.block_item_weeks enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_items enable row level security;
alter table public.programme_workouts enable row level security;
