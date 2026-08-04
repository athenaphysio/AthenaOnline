-- Records a completed one-off shop purchase. Written only by the Stripe
-- webhook handler (src/app/api/webhooks/stripe/route.ts) via supabaseAdmin,
-- once Stripe itself confirms the payment succeeded -- never written at
-- Checkout Session creation time, so a row here always means money actually
-- changed hands, not just that a patient started checkout.
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  section_slug text not null,
  programme_slug text not null,
  programme_title text not null,
  amount_gbp integer not null,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

-- A patient can read their own purchase history (the shop's "Purchase
-- History" tab). No insert/update/delete policy for authenticated users --
-- every write goes through supabaseAdmin from the webhook, same trust
-- boundary as communications and notifications.
create policy "Patients can read their own purchases" on public.purchases
  for select using (auth.uid() = patient_id);
