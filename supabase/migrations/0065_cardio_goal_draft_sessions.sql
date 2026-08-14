-- Phase 4-5 of goal-based cardio scaffolding: the per-patient week-by-week
-- cardio draft. Confirmed in Phase 1's audit and again when scoping this
-- phase: programme_workouts (the Bespoke Build weekly calendar) can't
-- represent content that varies week to week, so this gets its own table
-- rather than being forced into that calendar -- David reviews it in its
-- own panel on the programme edit page, separate from (but alongside) the
-- weekly strength/rehab grid.
--
-- One row per actual session (including 'rest' rows, so a reviewed week
-- reads as complete rather than ambiguous about what's missing). Every
-- row starts review_status 'pending' -- nothing here is ever auto-approved.
create table public.programme_cardio_draft_sessions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  week_number integer not null,
  day_of_week integer not null check (day_of_week between 1 and 7),
  kind text not null check (kind in ('long_run', 'easy_run', 'pace_run', 'cross_train', 'tune_up_race', 'taper_run', 'race_day', 'rest')),
  description text not null,
  distance_value numeric,
  distance_unit text check (distance_unit in ('miles', 'km', 'minutes')),
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed')),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (programme_id, week_number, day_of_week)
);

alter table public.programme_cardio_draft_sessions enable row level security;

create policy "Coaches can read cardio draft sessions" on public.programme_cardio_draft_sessions
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));
