-- The single source of truth for a patient's membership tier -- everything
-- else (messaging limits, wearable defaults, shop pricing) asks this table
-- the same question through src/lib/membership.ts rather than each
-- inventing its own notion of "is this patient a member."
--
-- One row per patient, written by David from the clinic side (no UI for it
-- yet -- this migration is infrastructure ahead of that). No row means
-- tier "none", same convention as purchases/notifications/communications:
-- nothing is seeded for a patient who's never had a membership set, rather
-- than pre-creating an empty row for every patient at signup.
create table public.patient_memberships (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  tier text not null check (tier in ('member', 'progress', 'performance', 'athlete')),
  billing_type text not null check (billing_type in ('recurring', 'prepay')),
  -- Only meaningful for a prepay membership -- a fixed-term access window.
  -- Left null for recurring, where Stripe's subscription is the source of
  -- truth for whether billing continues.
  expires_at date,
  -- Only meaningful for a recurring membership, and even then only once
  -- it's actually linked to a real Stripe subscription -- null for prepay,
  -- and null for a recurring membership set up by hand before that link
  -- exists.
  stripe_subscription_id text,
  status text not null check (status in ('active', 'lapsed', 'paused', 'cancelled')),
  updated_at timestamptz not null default now()
);

alter table public.patient_memberships enable row level security;

-- A patient can read their own membership record -- same precedent as
-- purchases (their own billing history is theirs to see). No insert/
-- update/delete policy for authenticated users -- every write goes through
-- supabaseAdmin from the clinic side, same trust boundary as purchases and
-- communications.
create policy "Patients can read their own membership" on public.patient_memberships
  for select using (auth.uid() = patient_id);
