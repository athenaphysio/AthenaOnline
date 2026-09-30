-- Step 2 of the athena-plan-v1 direction: a plan built and reviewed in
-- Claude chat, pasted in by David, stored exactly as given. raw_json is
-- never rewritten -- it's the one source of truth the client-facing
-- calendar and the PDF both read from, kept forever so a plan can be
-- re-read even once superseded. 'draft' exists only briefly (paste ->
-- preview -> Assign/Cancel, see the import-plan screens); 'assigned' is
-- the one live plan for a client; assigning a new plan for the same
-- client marks the old one 'replaced' rather than deleting it, so its
-- history and logs stay intact.
create table public.imported_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  raw_json jsonb not null,
  client_name_in_plan text not null,
  block_title text not null,
  start_date date not null,
  status text not null default 'draft' check (status in ('draft', 'assigned', 'replaced')),
  assigned_at timestamptz,
  replaced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.imported_plans enable row level security;
