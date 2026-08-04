-- The Atomic Speedworks camp (and any future youth programme) needs a
-- distinct signup path: the account holder is a parent/guardian, not the
-- young athlete, who never gets a login of their own.
--
-- is_under_18 lives on the template -- David marks which templates this
-- applies to. The three participant/guardian fields live on programmes
-- (one row per enrollment) since that's the actual auditable event: who
-- the participant is, and when the guardian confirmed. They're only ever
-- populated when the enrollment's source template is under-18-flagged
-- (enforced server-side in the create-programme route, not just the UI).
--
-- No RLS changes needed: both tables already have row-level policies
-- covering the whole row for Owner (service_role), Patient (own row), and
-- Coach (reachable rows) -- these are just new columns on rows already
-- governed by those same rules.

alter table public.programme_templates
  add column is_under_18 boolean not null default false;

alter table public.programmes
  add column participant_first_name text,
  add column participant_age integer,
  add column guardian_confirmed_at timestamptz;
