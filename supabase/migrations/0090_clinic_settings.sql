-- Step 1 of the new athena-plan-v1 direction: hide the old AI-driven
-- Running Builder and Running ladders from David's menu without deleting
-- either their code or their data, and give him a simple on/off switch to
-- bring them back later. Singleton table, same "exactly one row, ever"
-- pattern as running_deload_settings.
create table public.clinic_settings (
  id boolean primary key default true,
  running_builder_enabled boolean not null default false,
  running_ladders_enabled boolean not null default false,
  constraint clinic_settings_singleton check (id)
);

insert into public.clinic_settings (running_builder_enabled, running_ladders_enabled) values (false, false);

alter table public.clinic_settings enable row level security;
