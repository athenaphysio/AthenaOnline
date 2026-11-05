-- When the Quick update form went out automatically for a programme, a week
-- before its block ends, so it is only ever sent once per programme.
alter table public.programmes add column if not exists quick_update_sent_at timestamptz;
