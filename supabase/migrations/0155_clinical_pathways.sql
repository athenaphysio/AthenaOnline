-- Clinical pathways: Dr David Silver PhD's clinical reasoning written down
-- as flowcharts, one per body region and pathology (for example Lumbar,
-- flexion related). Each pathway is kept whole as one athena-pathway-v1
-- document, the same shape the Clinical Pathways Claude Project writes, so
-- a pathway can be pasted in from that Project and copied back out again
-- without anything being lost. See src/lib/pathways.ts for the format.
--
-- Everything here is reached only through the server with the service
-- key, so row level security is on with no policies, as elsewhere.

create table public.pathways (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null default '',
  pathology text not null default '',
  -- draft: still being worked on; approved: offered when building a
  -- client's programme from a working diagnosis.
  status text not null default 'draft' check (status in ('draft', 'approved')),
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pathways_region_idx on public.pathways (region, name);
alter table public.pathways enable row level security;

-- One client on one pathway: where they started, which stage they are on
-- now, and the draft programme that was built for them.
create table public.pathway_assignments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  pathway_id uuid not null references public.pathways (id) on delete restrict,
  presentation text not null default '',
  current_stage text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  programme_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pathway_assignments_patient_idx on public.pathway_assignments (patient_id, created_at desc);
alter table public.pathway_assignments enable row level security;

-- Every decision made on a client's pathway: what the app suggested, what
-- David chose and why. Where the two differ is exactly where the pathway's
-- rules need tightening, so nothing here is ever edited or deleted.
create table public.pathway_decision_log (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.pathway_assignments (id) on delete cascade,
  kind text not null check (kind in ('build', 'progress', 'hold', 'regress', 'switch', 'edit')),
  suggested jsonb,
  chosen jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index pathway_decision_log_assignment_idx on public.pathway_decision_log (assignment_id, created_at desc);
alter table public.pathway_decision_log enable row level security;

-- Links between exercises, so the app knows what comes next, what to drop
-- back to after a flare-up, and what can stand in for an exercise. The
-- free text progression and regression columns on exercises stay as they
-- are; these links sit alongside them.
create table public.exercise_links (
  id uuid primary key default gen_random_uuid(),
  from_exercise_id text not null references public.exercises (exercise_id) on delete cascade,
  to_exercise_id text not null references public.exercises (exercise_id) on delete cascade,
  kind text not null check (kind in ('progression', 'regression', 'alternative')),
  -- What changes in the move, such as load, range, base of support or speed.
  what_changes text,
  -- When to make the move, in David's words.
  criterion text,
  created_at timestamptz not null default now(),
  unique (from_exercise_id, to_exercise_id, kind),
  check (from_exercise_id <> to_exercise_id)
);
create index exercise_links_from_idx on public.exercise_links (from_exercise_id, kind);
alter table public.exercise_links enable row level security;

-- Clinical traits, so the app can choose between exercises the way David
-- would. All optional: an empty trait means it has not been set yet, never
-- that it does not apply.
alter table public.exercises
  add column if not exists irritability_levels text[] not null default '{}',
  add column if not exists load_type text,
  add column if not exists impact_level text,
  add column if not exists prerequisites text,
  add column if not exists flare_safe boolean;

alter table public.exercises
  add constraint exercises_irritability_levels_check check (irritability_levels <@ array['high', 'moderate', 'low']::text[]),
  add constraint exercises_load_type_check check (load_type is null or load_type in ('bodyweight', 'band', 'fixed_load', 'machine')),
  add constraint exercises_impact_level_check check (impact_level is null or impact_level in ('none', 'low', 'high'));
