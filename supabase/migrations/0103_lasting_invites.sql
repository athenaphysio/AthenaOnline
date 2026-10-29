-- Joining links that last. The login system's own one-time links expire
-- after an hour, which is too short for a client who opens their welcome
-- email later in the day. The welcome email now carries the app's own
-- link, valid for seven days, which swaps in a fresh login token only at
-- the moment the client opens it. Only a hash of the link is stored.

create table public.client_invite_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index client_invite_links_patient_idx on public.client_invite_links (patient_id, created_at desc);

alter table public.client_invite_links enable row level security;
