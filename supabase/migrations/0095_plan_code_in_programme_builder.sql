-- Plan code drop-in (Step 3): per-week sessions in the programme builder.
-- week_number null keeps today's meaning (the session repeats every week).
alter table public.programme_workouts add column week_number smallint check (week_number is null or week_number >= 1);
alter table public.programme_workouts add column sort_order smallint not null default 0;
alter table public.programme_workouts drop constraint programme_workouts_programme_id_day_of_week_key;
create unique index programme_workouts_every_week_day_key on public.programme_workouts (programme_id, day_of_week) where week_number is null;

-- A session card that came from plan code is a workout that belongs to one
-- programme (programme_id set, so it stays out of the library) and carries
-- its text in plan_session. Clearing programme_id is "Save to library".
alter table public.workouts add column programme_id uuid;
alter table public.workouts add column plan_session jsonb;

alter table public.programmes add column intro text;
alter table public.programmes add column plan_rules jsonb;
alter table public.programmes add column week_labels jsonb;
