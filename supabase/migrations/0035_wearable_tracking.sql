-- A lever David controls per patient from Manage, not something
-- automatically tied to what they're paying for. Defaults on the moment a
-- patient signs up for Athena Athlete (src/lib/membershipFulfillment.ts),
-- but David can flip it for any patient regardless of tier.
alter table public.patients
  add column wearable_tracking_enabled boolean not null default false;
