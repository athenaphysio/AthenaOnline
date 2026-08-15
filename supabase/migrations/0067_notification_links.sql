-- Notifications had no way to point anywhere -- the bell dropdown showed
-- "David sent you a form" with no link to the actual form, since the
-- generic notification centre (0008_notifications.sql) never carried a
-- destination. Nullable: only notification types that genuinely have
-- somewhere to go (form_sent) will ever set it.
alter table public.notifications add column link text;
