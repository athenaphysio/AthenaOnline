-- Records the Setmore customer made from a registration, so David can see
-- the client went into Setmore without retyping them.
alter table public.registrations add column if not exists setmore_customer_key text;
