-- A programme (and a template) now has a delivery mode: 'scheduled' (today's
-- week/day calendar with per-week progression, unchanged) or 'open' (a flat,
-- unscheduled list of exercises with prescriptions set once). Open reuses
-- the existing content shapes rather than inventing new ones: a Block whose
-- block_length_weeks is 1 already degenerates to a single prescription row
-- (see 0005's comment), and a single programme_workouts row with a null
-- day_of_week means "not tied to any day" -- no new junction table needed.

alter table public.programmes
  add column delivery_mode text not null default 'scheduled'
    check (delivery_mode in ('scheduled', 'open'));

alter table public.programme_templates
  add column delivery_mode text not null default 'scheduled'
    check (delivery_mode in ('scheduled', 'open'));

-- day_of_week becomes optional: an Open programme/template gets exactly one
-- programme_workouts / programme_template_workouts row with day_of_week
-- null, meaning "always, not scheduled to a day."
alter table public.programme_workouts
  alter column day_of_week drop not null;

alter table public.programme_workouts
  drop constraint programme_workouts_day_of_week_check;

alter table public.programme_workouts
  add constraint programme_workouts_day_of_week_check
    check (day_of_week is null or day_of_week between 1 and 7);

alter table public.programme_template_workouts
  alter column day_of_week drop not null;

alter table public.programme_template_workouts
  drop constraint programme_template_workouts_day_of_week_check;

alter table public.programme_template_workouts
  add constraint programme_template_workouts_day_of_week_check
    check (day_of_week is null or day_of_week between 1 and 7);
