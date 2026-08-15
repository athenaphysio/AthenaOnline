-- Public, unauthenticated patient registration (/register). A
-- staging table, deliberately separate from patients -- an anonymous
-- public submission is never trusted straight into the real patient
-- record, and a patient can submit this before they have any auth
-- account at all. David reviews these from the clinic side; nothing
-- here is merged into patients automatically yet.
--
-- Under-18 submissions reuse the same columns rather than a parallel
-- set: email/mobile_phone/etc. always hold the *contact* (the patient's
-- own for an adult, the parent/guardian's for a child -- see Phase 4 of
-- the brief), and the guardian_* columns capture only what's genuinely
-- extra (their name and relationship to the child).
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,

  -- Patient identity (the child's, for an under-18 submission)
  title text,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  date_of_birth date not null,
  gender text,
  occupation text,
  referral_source text,

  -- GP -- both optional, the patient may not know either
  gp_name text,
  gp_practice text,

  -- Contact -- the account-holder's own; the parent/guardian's, not the
  -- child's, on an under-18 submission
  email text not null,
  mobile_phone text,
  address text,
  city text,
  postcode text,
  newsletter_opt_in boolean not null default false,

  -- Emergency contact -- can be a different person from whoever is
  -- completing the form
  emergency_contact_name text,
  emergency_contact_phone text,

  -- Under-18 branch
  is_guardian_submission boolean not null default false,
  guardian_full_name text,
  guardian_relationship text,
  guardian_relationship_other text,

  -- Consent -- four separate items, each its own timestamp so there's
  -- never any ambiguity later about which were actually accepted
  privacy_policy_accepted_at timestamptz,
  notes_policy_accepted_at timestamptz,
  cancellation_policy_accepted_at timestamptz,
  treatment_consent_signed_name text,
  treatment_consent_signed_at timestamptz
);

alter table public.registrations enable row level security;

-- No policy for anon or authenticated -- this table is only ever
-- touched via the service-role key, from the public submit route and
-- the clinic review page. Same model as patient_intake_documents.
