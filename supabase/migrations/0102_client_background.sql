-- Client background: the contextual layer for each client.
--
-- client_context_entries holds what Dr David Silver PhD records from the
-- onboarding consultation (and its month 6 repeat), organised by the
-- fourteen sections of the Onboarding Consultation Framework: structured
-- fields, the 0 to 10 scales, verbatim quotes, codes and flags, plus the
-- anchor statement, goals, top priority and first action. One row per
-- consultation, with its timepoint, so baseline and month 6 can be compared.
--
-- client_documents keeps the files behind it all (Twofold notes exports,
-- completed questionnaires) in a private storage bucket. Nothing here is
-- readable by clients or clinicians directly; the clinic reads it through
-- server code only.

create table public.client_context_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  timepoint text not null default 'baseline'
    check (timepoint in ('baseline', 'month_3', 'month_6', 'review')),
  consulted_on date not null default current_date,
  -- { sections: [...], scales: [...], goals: [...], flags: [...], ... }
  content jsonb not null,
  anchor_statement text,
  top_priority text,
  first_action text,
  source_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_context_entries_patient_idx on public.client_context_entries (patient_id, consulted_on desc);

create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('consultation_notes', 'questionnaire', 'other')),
  title text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  dated date,
  uploaded_at timestamptz not null default now()
);

create index client_documents_patient_idx on public.client_documents (patient_id, kind, uploaded_at desc);

alter table public.client_context_entries enable row level security;
alter table public.client_documents enable row level security;

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;
