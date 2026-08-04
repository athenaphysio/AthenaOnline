-- The category a programme's access is protected (or not) by -- this is
-- what stops a lapsed membership from ever touching a programme it has no
-- business touching. Only "subscription_gated" access is ever removed
-- automatically when a membership lapses (see
-- pauseSubscriptionGatedProgrammesForPatient in src/lib/programmeAccess.ts).
-- "owned" (a shop purchase, free or paid, including a future "keep it
-- forever" purchase) and "clinician_assigned" (Quick Assign or anything
-- David gives someone directly, no payment involved) are never touched by
-- any membership lapsing, ever -- only a manual unassign removes them.
--
-- Defaults to clinician_assigned, which also backfills every existing row:
-- the safe direction to default in, since it means nothing already in the
-- database can be wrongly auto-paused by this change.
alter table public.programmes
  add column source text not null default 'clinician_assigned'
    check (source in ('subscription_gated', 'owned', 'clinician_assigned'));
