-- Save and Send are now two separate buttons in the programme builder.
-- Save keeps the builder exactly as it is, here, and nothing reaches the
-- client; Send is still the only thing that creates a real programme row.
-- Keeping drafts in their own table means no client-facing query has to
-- learn to skip them. id is the programme id the builder already uses, so
-- the client's own session copies made while building stay attached.
create table if not exists public.programme_drafts (
  id uuid primary key,
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text not null default '',
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists programme_drafts_patient_idx on public.programme_drafts (patient_id, updated_at desc);
alter table public.programme_drafts enable row level security;
