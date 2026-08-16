-- Phase 5 of the access-window brief: three separate "already sent"
-- timestamps, one per moment, so the daily cron job
-- (/api/cron/access-window-emails) never double-sends any of the three.
-- All null for every existing programme, same as access_window_weeks
-- itself -- a programme with no access window never has any of these
-- set, since there's nothing to warn about or close.
alter table public.programmes add column access_warning_sent_at timestamptz;
alter table public.programmes add column access_closed_email_sent_at timestamptz;
alter table public.programmes add column access_followup_sent_at timestamptz;
