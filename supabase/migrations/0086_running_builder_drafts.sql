-- A Running Builder draft: everything produced from one pasted Twofold
-- note, between "Build programme" and David's own "Approve and assign".
-- The workouts/blocks it references (quality_run/easy_run/strength/
-- cross_training) are created as real rows as soon as the note is parsed
-- (same pattern as scaffold generation, 0009_content_hierarchy.sql-era
-- content -- clinic-internal, not patient-visible on their own), but no
-- `programmes` row exists yet, and so no patient can see any of this,
-- until Approve actually runs (see instantiateProgramme.ts -- that insert
-- is the real point of no return for patient visibility, not this table).
create table public.running_builder_drafts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  raw_note text not null,
  status text not null default 'draft' check (status in ('draft', 'approved')),

  ladder_id uuid references public.running_ladders(id),
  start_rung_number integer,

  -- Everything else the model returned, kept as JSON rather than a wider
  -- table -- this is draft/review content, read back only by this
  -- feature's own two screens, not queried or joined against elsewhere.
  header jsonb not null,
  weekly_structure jsonb not null,
  cross_training jsonb not null default '[]'::jsonb,
  locked_blocks jsonb not null default '[]'::jsonb,
  rules text,
  flags jsonb not null default '[]'::jsonb,

  weeks integer not null default 4,

  -- One real workout per session kind (see the route that creates these) --
  -- how many times each is used per week comes from weekly_structure at
  -- approval time, not a separate row per repeat.
  quality_run_workout_id uuid references public.workouts(id),
  easy_run_workout_id uuid references public.workouts(id),
  strength_workout_id uuid references public.workouts(id),
  cross_training_workout_id uuid references public.workouts(id),

  -- Set only once Approve actually runs.
  programme_id uuid references public.programmes(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same locked-down shape as blocks/cardio_blocks/running_ladders: clinic-
-- internal, service role only, no policy needed since a patient never
-- queries this table at all (they only ever see the real programme this
-- produces, once Approve creates it).
alter table public.running_builder_drafts enable row level security;
