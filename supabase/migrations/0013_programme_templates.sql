-- Programme Templates: the one layer of the content hierarchy that didn't
-- already stand alone (Exercises/Blocks/Workouts already do). A template is
-- a reusable, patient-agnostic schedule -- exact mirror of programmes /
-- programme_workouts, minus anything patient-specific (no patient, no
-- audio message, no start date).

create table public.programme_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  block_length_weeks integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.programme_template_workouts (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.programme_templates(id) on delete cascade,
  workout_id uuid not null references public.workouts(id),
  day_of_week integer not null check (day_of_week between 1 and 7),
  created_at timestamptz not null default now(),
  unique (template_id, day_of_week)
);

-- Set when a bespoke programme is instantiated from a template, or when an
-- existing bespoke programme is retroactively promoted into one ("save as
-- template"). This is what lets a coach's template assignment reach the
-- right patients -- see 0016_coach_rls.sql.
alter table public.programmes
  add column source_template_id uuid references public.programme_templates(id);

-- Which coach can see which template. Owner-only write, via supabaseAdmin.
create table public.coach_template_assignments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.staff(id) on delete cascade,
  template_id uuid not null references public.programme_templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (coach_id, template_id)
);

-- Shared clinical content, same security model as blocks/workouts (0009):
-- no anon/authenticated policy at all here -- service_role only for now.
-- Coach-specific read policies are added in 0016_coach_rls.sql once the
-- helper functions they depend on exist.
alter table public.programme_templates enable row level security;
alter table public.programme_template_workouts enable row level security;
alter table public.coach_template_assignments enable row level security;
