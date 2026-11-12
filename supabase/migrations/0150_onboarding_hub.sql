-- Consultation hub.
--
-- One row per client per field of the fourteen part onboarding
-- consultation. Each value carries where it came from (the medical report,
-- the psychometrics, a transcript, or Dr David Silver PhD himself) and
-- whether he has confirmed it. A value read from a document by the app is
-- always held as to_confirm until he confirms it.
--
-- A record of every import is kept as well, so the source of anything in
-- the hub can be traced back to the document it came from.
--
-- Both tables are read and written only by the server, behind the clinic
-- login, so row level security is on with no policies.

create table if not exists public.onboarding_hub_fields (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  field_key text not null,
  value text not null,
  source text,
  status text not null default 'to_confirm' check (status in ('to_confirm', 'confirmed')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, field_key)
);

create index if not exists onboarding_hub_fields_patient_idx on public.onboarding_hub_fields (patient_id);
alter table public.onboarding_hub_fields enable row level security;

create table if not exists public.onboarding_hub_imports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  source_label text not null,
  file_name text,
  document_id uuid,
  fields_filled integer not null default 0,
  -- Any safety concern the document raised, exactly as stated.
  safety_notes text,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_hub_imports_patient_idx on public.onboarding_hub_imports (patient_id, created_at desc);
alter table public.onboarding_hub_imports enable row level security;
