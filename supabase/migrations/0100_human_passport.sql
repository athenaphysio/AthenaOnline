-- Human Passport: one living record of each client's health and performance
-- data (Firstbeat, Randox, gut microbiome, psychometrics, physical
-- assessments), measured at baseline, 3 months and 6 months so the client
-- sees change over time rather than a single snapshot.
--
-- Three pieces:
--   1. patients.passport_enabled, David's switch per client, off by default,
--      so no existing client sees anything new until it is turned on.
--   2. passport_markers, the marker library: what each marker is, its unit,
--      its ranges and a plain English explanation, written once and reused
--      for every client.
--   3. passport_results, one row per result per client per date. Every
--      result arrives as a draft that only the care team can see, and the
--      client only ever sees it once a clinician has added a note and
--      released it.

alter table public.patients
  add column if not exists passport_enabled boolean not null default false;

create table public.passport_markers (
  marker_key text primary key,
  domain text not null
    check (domain in ('heart_recovery', 'sleep_energy', 'blood', 'gut', 'body_movement', 'mind_behaviour')),
  panel text,
  name text not null,
  unit text,
  explanation text,
  range_low numeric,
  range_high numeric,
  optimal_low numeric,
  optimal_high numeric,
  -- Which way is "better", so a trend can be described honestly:
  -- higher (for example heart rate variability), lower (for example
  -- resting heart rate) or in_range (most blood markers).
  better text not null default 'in_range'
    check (better in ('higher', 'lower', 'in_range')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.passport_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  marker_key text not null references public.passport_markers(marker_key) on update cascade,
  value numeric not null,
  timepoint text not null
    check (timepoint in ('baseline', 'month_3', 'month_6', 'review')),
  taken_on date not null,
  source text,
  clinician_note text,
  status text not null default 'draft'
    check (status in ('draft', 'released')),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Uploading the same file twice updates the result rather than
  -- duplicating it.
  unique (patient_id, marker_key, taken_on)
);

create index passport_results_patient_idx on public.passport_results (patient_id, marker_key, taken_on);

alter table public.passport_markers enable row level security;
alter table public.passport_results enable row level security;

-- The marker library is shared explanatory content, the same for everyone,
-- so any logged in client may read it.
create policy "Logged in users can read the marker library"
  on public.passport_markers for select
  to authenticated
  using (true);

-- A client can only ever read their own results, and only once released.
-- Drafts stay invisible to them. All writes go through the password gated
-- clinic routes using the service key, so there are no client write policies.
create policy "Clients can read their own released passport results"
  on public.passport_results for select
  to authenticated
  using (auth.uid() = patient_id and status = 'released');
