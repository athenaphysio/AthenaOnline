-- Buying a patient's own existing programme outright (the "keep it
-- forever" one-off purchase) records into this same purchases table --
-- it's genuinely a purchase, and belongs on the clinic Purchases page
-- alongside everything else bought. It just isn't tied to a shop listing
-- the way a template purchase is, so section_slug/programme_slug have
-- nothing to point at -- loosened to nullable, required only for
-- purchase_type = 'template' (enforced in the webhook, not a check
-- constraint, same approach used throughout this app for conditional
-- fields).
alter table public.purchases
  add column purchase_type text not null default 'template' check (purchase_type in ('template', 'buy_outright')),
  alter column section_slug drop not null,
  alter column programme_slug drop not null;
