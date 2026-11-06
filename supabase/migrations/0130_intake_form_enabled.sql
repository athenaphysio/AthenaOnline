-- Whether a client sees the Programme intake form on their home screen.
-- Off by default, because most clients have a one to one consultation
-- instead; Dr David Silver PhD switches it on per client from their
-- dashboard, and sending the intake form (Add client or Approve as remote)
-- switches it on too.

alter table public.patients add column intake_form_enabled boolean not null default false;
