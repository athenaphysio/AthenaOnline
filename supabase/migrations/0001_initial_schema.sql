-- Exercise library: one row per exercise, columns match exercise_library_database.xlsx exactly.
create table public.exercises (
  exercise_id text primary key,
  slug text,
  name_clinical text,
  name_patient_facing text,
  body_site text,
  target_muscles text,
  nature text,
  movement_pattern text,
  rehab_stage text,
  primary_aim text,
  equipment text,
  position text,
  difficulty text,
  default_sets integer,
  default_reps integer,
  default_hold_seconds integer,
  default_distance_m integer,
  default_dosage_text text,
  progression text,
  regression text,
  cues_notes text,
  condition_use_case text,
  contraindication_flags text,
  vimeo_url text,
  thumbnail_url text,
  is_gap_suggestion boolean not null default false,
  active boolean not null default true,
  sort_order integer
);

-- One row per patient programme, reached via an unguessable share_code link.
create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  patient_first_name text not null,
  title text not null,
  share_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

-- The exercises inside a programme, with the clinician's per-patient overrides.
create table public.programme_items (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  exercise_id text not null references public.exercises(exercise_id),
  item_order integer not null,
  sets integer,
  reps integer,
  hold_seconds integer,
  frequency text,
  rationale text
);

-- Readable by the app (anon key), not writable from the browser: no insert/update/delete
-- policies are created, so those operations are denied by default once RLS is enabled.
alter table public.exercises enable row level security;
alter table public.programmes enable row level security;
alter table public.programme_items enable row level security;

create policy "Public read access" on public.exercises for select using (true);
create policy "Public read access" on public.programmes for select using (true);
create policy "Public read access" on public.programme_items for select using (true);
