-- Clinician access by package, with client consent, care team notes, an
-- access log and an emailed login code for clinicians on new devices.
--
-- How access works. A clinician (a staff row with role "coach") can see a
-- section of a client's record only when ALL of these are true:
--   1. the client is in a package (for example Regenerate),
--   2. the clinician is in that package with that section switched on,
--   3. the client has signed the current published consent for that
--      package, has not withdrawn it, and that signed consent named this
--      clinician and this section.
-- Switching a section off takes effect immediately. Switching one on, or
-- adding a clinician, needs the client to sign again first.
--
-- None of these tables has a policy for logged in users, so clinicians and
-- clients have no direct database access to any of them. Every read and
-- write goes through server code that applies the rule above
-- (src/lib/clinicianAccess.ts) using the service key.

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  brand_pack_id uuid references public.brand_packs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.patient_packages (
  patient_id uuid not null references public.patients(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, package_id)
);

-- Which sections each clinician can see within each package. A row means
-- switched on; no row means switched off.
create table public.staff_package_sections (
  staff_id uuid not null references public.staff(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete cascade,
  section text not null check (section in (
    'details', 'programme',
    'heart_recovery', 'sleep_energy', 'blood', 'gut', 'body_movement', 'mind_behaviour',
    'write_notes'
  )),
  created_at timestamptz not null default now(),
  primary key (staff_id, package_id, section)
);

-- Shown to clients on the consent page beside each clinician's name, for
-- example "GMC registered doctor (MBBS)".
alter table public.staff add column if not exists profession text;

-- Consent wording, one row per version per package. Only a published
-- version is ever shown to clients, and the newest published one is the
-- one that counts.
create table public.consent_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  version integer not null,
  body text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (package_id, version)
);

create table public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete cascade,
  consent_version_id uuid not null references public.consent_versions(id),
  signed_name text not null,
  -- Exactly who the client agreed could see what, at the moment of signing:
  -- [{ "staff_id", "name", "profession", "sections": [...] }]
  clinicians jsonb not null,
  signed_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  user_agent text
);

create index patient_consents_lookup_idx on public.patient_consents (patient_id, package_id, signed_at desc);

-- Internal care team notes. Not shown to the client. A note belongs to one
-- section, and is visible to whoever can see that section.
create table public.care_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  package_id uuid references public.packages(id) on delete set null,
  section text not null,
  staff_id uuid references public.staff(id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index care_notes_patient_idx on public.care_notes (patient_id, created_at desc);

-- Every time a clinician opens a client's record, one row per section shown.
create table public.staff_access_log (
  id bigint generated always as identity primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  section text not null,
  accessed_at timestamptz not null default now()
);

create index staff_access_log_patient_idx on public.staff_access_log (patient_id, accessed_at desc);

-- Emailed login codes, and the devices a clinician has confirmed with one.
-- Only hashes are stored, never the code or the device token itself.
create table public.staff_login_codes (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index staff_login_codes_staff_idx on public.staff_login_codes (staff_id, created_at desc);

create table public.staff_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.packages enable row level security;
alter table public.patient_packages enable row level security;
alter table public.staff_package_sections enable row level security;
alter table public.consent_versions enable row level security;
alter table public.patient_consents enable row level security;
alter table public.care_notes enable row level security;
alter table public.staff_access_log enable row level security;
alter table public.staff_login_codes enable row level security;
alter table public.staff_trusted_devices enable row level security;

insert into public.packages (name) values ('Regenerate'), ('Atomic SpeedWorks')
on conflict (name) do nothing;
