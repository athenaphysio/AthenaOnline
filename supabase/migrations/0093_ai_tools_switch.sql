-- Step 1 of the "hide all in-app AI" brief: one more switch on the same
-- clinic_settings singleton row (see 0090_clinic_settings.sql), off by
-- default. Nothing about the AI code itself is touched -- this only
-- controls whether its entry points are offered.
alter table public.clinic_settings add column ai_tools_enabled boolean not null default false;
