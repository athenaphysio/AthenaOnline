-- Client background is now arranged around the person, with three arms.
--
-- The centre holds what Dr David Silver PhD writes from the onboarding
-- consultation: a short Client context summary (written in his Twofold
-- template) and the full background notes. Both are plain text on each
-- consultation row; the fourteen section form is no longer used, so
-- content becomes optional.
--
-- Physiology (bloods, HRV, sleep, gut) and Psychology (psychometrics) use
-- the passport and the questionnaire files as before. Physicality gets its
-- own notes, in three parts: movement screen, performance scores and
-- physiotherapy notes, each optionally with a file.

alter table public.client_context_entries
  add column summary_text text,
  add column notes_text text,
  alter column content set default '{}'::jsonb;

alter table public.client_documents drop constraint client_documents_kind_check;
alter table public.client_documents
  add constraint client_documents_kind_check
  check (kind in ('consultation_notes', 'questionnaire', 'physical', 'other'));

create table public.physical_capacity_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  section text not null check (section in ('movement_screen', 'performance', 'physio_notes')),
  dated date not null default current_date,
  title text,
  body text,
  document_id uuid references public.client_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index physical_capacity_entries_patient_idx on public.physical_capacity_entries (patient_id, section, dated desc);

-- Server access only, like the rest of Client background.
alter table public.physical_capacity_entries enable row level security;
