-- Phase 5/6 of the registration brief: confirming a pending registration
-- copies its answers onto the real patients row (found by matching
-- email -- see the confirm route), so David never retypes anything.
-- date_of_birth, occupation and clinic_location already exist
-- (0047_patient_profile_and_baseline_fields.sql) and are reused
-- directly. referred_via already exists too, but it's the CLINICAL
-- intake-import field ("how they were referred", filled in from a
-- Cliniko/Setmore export -- 0046_patient_intake.sql); referral_source
-- here is the registration form's own marketing-attribution dropdown
-- (Google search / Instagram / friend referral / etc) -- a different
-- question with a different lifecycle, kept as its own column rather
-- than conflated with David's intake paperwork field.
alter table public.patients add column title text;
alter table public.patients add column preferred_name text;
alter table public.patients add column gender text;
alter table public.patients add column referral_source text;
alter table public.patients add column gp_name text;
alter table public.patients add column gp_practice text;
alter table public.patients add column mobile_phone text;
alter table public.patients add column address text;
alter table public.patients add column city text;
alter table public.patients add column postcode text;
alter table public.patients add column newsletter_opt_in boolean not null default false;
alter table public.patients add column emergency_contact_name text;
alter table public.patients add column emergency_contact_phone text;

-- Under-18 registrations: the account itself belongs to the parent/
-- guardian (their email is the login), but the patient identity this
-- row IS is the child's -- see the Phase 6 note flagged to David. These
-- columns record who's actually managing the account.
alter table public.patients add column is_guardian_account boolean not null default false;
alter table public.patients add column guardian_full_name text;
alter table public.patients add column guardian_relationship text;
alter table public.patients add column guardian_relationship_other text;

alter table public.patients add column privacy_policy_accepted_at timestamptz;
alter table public.patients add column notes_policy_accepted_at timestamptz;
alter table public.patients add column cancellation_policy_accepted_at timestamptz;
alter table public.patients add column treatment_consent_signed_name text;
alter table public.patients add column treatment_consent_signed_at timestamptz;

-- Which patient a registration was confirmed into, once matched by
-- email -- lets the review screen show "already confirmed" instead of
-- risking a second, conflicting merge.
alter table public.registrations add column claimed_patient_id uuid references public.patients(id);
