-- Targets: for one client and one marker, the value the care team is
-- working towards, drawn as a dashed line on that client's chart so change
-- over time can be read against it. A target can be a floor (at or above),
-- a ceiling (below) or a band, with an optional date to reach it by.
--
-- Same rule as results: a target starts as a draft only the care team can
-- see, and a client sees it only once it is released, which the app allows
-- only after a result for that marker has been released (and so signed off
-- at a multidisciplinary meeting).

create table public.passport_targets (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  marker_key text not null references public.passport_markers(marker_key) on update cascade,
  target_low numeric,
  target_high numeric,
  target_by date,
  -- Shown to the client beside the target, in plain words.
  note text,
  -- Where the target came from, for the care team only.
  source text,
  status text not null default 'draft' check (status in ('draft', 'released')),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, marker_key),
  check (target_low is not null or target_high is not null)
);

alter table public.passport_targets enable row level security;

create policy "Clients can read their own released passport targets"
  on public.passport_targets for select to authenticated
  using (auth.uid() = patient_id and status = 'released');
