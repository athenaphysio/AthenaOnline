-- A read-only audit trail of everything sent to a patient -- the
-- programme-ready/welcome email and its matching in-app notice today, form-
-- request notices, and later on upsell/renewal emails, all logging into one
-- place so David can see, per patient, what went out, when, and through
-- which channel. Distinct from notifications (0008_notifications.sql):
-- notifications drives the patient's own in-app bell (read/unread, RLS-
-- scoped to that patient); this is Owner-facing history only, so like the
-- shared library content tables, no anon/authenticated policy is created --
-- deny by default, read only via supabaseAdmin through the password-gated
-- /clinic/* surface.
create table public.communications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  channel text not null check (channel in ('email', 'in_app')),
  type text not null,
  title text not null,
  body text,
  sent_at timestamptz not null default now()
);

alter table public.communications enable row level security;
