-- Two additions needed to actually fulfil a shop purchase, not just record
-- the payment (0025_purchases.sql only ever recorded the charge):
--
-- programme_id links a purchase to the real programme the webhook built
-- from the linked Programme Template. Nullable, because a shop listing
-- might not have a template linked yet (see ShopProgramme.templateId in
-- src/lib/shopProgrammes.ts) -- the purchase still gets recorded, it just
-- has no programme to point at until David sets one up.
--
-- cooling_off_waived_at records when the patient confirmed, at checkout,
-- that they want immediate access and are waiving the 14-day cancellation
-- right (Consumer Contracts Regulations 2013) -- a Stripe Checkout required
-- checkbox, read back from the session's custom_fields in the webhook. Not
-- inferred from created_at: this is its own explicit consent record.
alter table public.purchases
  add column programme_id uuid references public.programmes(id) on delete set null,
  add column cooling_off_waived_at timestamptz;
