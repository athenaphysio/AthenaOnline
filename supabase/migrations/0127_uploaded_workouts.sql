-- Workout files a client uploads from the Me page (.FIT, or a .zip holding
-- one): Wattbike, Garmin, Zwift and anything else that saves FIT. Only the
-- numbers read from the file are kept, never the file itself. Rows and
-- runs with a distance also go into rowing_results (source 'file') so the
-- Rowing and Running Builder plans, suggestions and on target measure
-- read them like any other result.

create table public.uploaded_workouts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  file_name text,
  sport text not null check (sport in ('row', 'run', 'ride', 'other')),
  sport_label text not null,
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  distance_m integer,
  avg_hr smallint,
  max_hr smallint,
  avg_power smallint,
  max_power smallint,
  avg_cadence smallint,
  calories integer,
  device text,
  laps jsonb not null default '[]'::jsonb,
  note text,
  rowing_result_id uuid references public.rowing_results(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  read_at timestamptz,
  unique (patient_id, started_at, duration_seconds)
);

create index uploaded_workouts_patient_started on public.uploaded_workouts (patient_id, started_at desc);

alter table public.uploaded_workouts enable row level security;

create policy "Clients can read their own uploaded workouts" on public.uploaded_workouts
  for select using (auth.uid() = patient_id);

alter table public.rowing_results drop constraint rowing_results_source_check;
alter table public.rowing_results add constraint rowing_results_source_check check (source in ('concept2', 'manual', 'file'));
