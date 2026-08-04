-- Records when David manually paused a patient's membership (a
-- conversation-driven decision, never self-service), so the Subscriptions
-- tab can show how long someone's been paused. Null means not paused.
alter table public.patient_memberships
  add column paused_at timestamptz;
