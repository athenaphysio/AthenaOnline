-- Records each completed membership checkout (subscription or upfront) --
-- written only by the Stripe webhook handler, once Stripe confirms payment,
-- same trust boundary as purchases (0025_purchases.sql). Two jobs: an audit
-- trail of every signup, and the idempotency guard that stops a Stripe
-- webhook retry from double-firing the "you're set up" email -- the unique
-- constraint on stripe_checkout_session_id is what the webhook checks
-- before doing any fulfilment work, same pattern already used for shop
-- purchases.
--
-- This is deliberately separate from patient_memberships
-- (0028_patient_memberships.sql), which holds only the current state. This
-- table is the log of how it got there.
create table public.membership_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tier text not null check (tier in ('member', 'progress', 'performance', 'athlete')),
  billing_type text not null check (billing_type in ('recurring', 'prepay')),
  amount_gbp numeric not null,
  stripe_checkout_session_id text not null unique,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

alter table public.membership_events enable row level security;

-- A patient can read their own membership signup history, same precedent
-- as purchases. No insert/update/delete policy for authenticated users --
-- every write goes through supabaseAdmin from the webhook.
create policy "Patients can read their own membership events" on public.membership_events
  for select using (auth.uid() = patient_id);
