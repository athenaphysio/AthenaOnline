-- Goal-based cardio scaffolding, Phase 2-3 (schema only -- see
-- claude_code_instructions_goal_based_cardio.md; Phase 1's audit findings
-- are recorded there, not here). Confirmed via that audit:
--   1. programme_workouts has unique(programme_id, day_of_week) -- one
--      workout per day-of-week for the whole programme, no per-week
--      variation, and cardio_blocks are explicitly one fixed prescription
--      each. Neither can represent week-varying goal-event content, so the
--      actual week-by-week draft (a later phase, not built here) will get
--      its own per-patient structure, mirroring cardio_programmes/
--      cardio_programme_days rather than being forced into this calendar.
--   2. programmes already has block_length_weeks + start_date;
--      programme_templates has neither start_date (patient-agnostic) nor
--      any goal/event concept -- confirming these new fields belong on
--      programmes only, not templates, since a target event date and a
--      capacity baseline are irreducibly patient-specific.
--
-- goal_targets: same lookup pattern as body_parts/equipment.
create table public.goal_targets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('ongoing', 'event')),
  sort_order integer not null default 0
);

alter table public.goal_targets enable row level security;

create policy "Coaches can read goal targets" on public.goal_targets
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

insert into public.goal_targets (name, category, sort_order) values
  ('General cardio fitness', 'ongoing', 1),
  ('General return to running', 'ongoing', 2),
  ('Half marathon', 'event', 1),
  ('Marathon', 'event', 2),
  ('Ironman 70.3', 'event', 3),
  ('Full Ironman', 'event', 4);

-- A programme's cardio side is optional -- most programmes (pure strength/
-- rehab work) have no goal set at all, so all three columns stay null
-- unless David actually turns this on for a given patient.
alter table public.programmes add column cardio_goal_category text check (cardio_goal_category in ('ongoing', 'event'));
alter table public.programmes add column goal_target_id uuid references public.goal_targets(id);
alter table public.programmes add column target_event_date date;

-- weeks_until_event is deliberately not stored -- computed from
-- target_event_date and the programme's own start_date, same principle as
-- patientStatus.ts deriving standing from dates rather than trusting a
-- stored value to stay current.

-- Capacity baseline, Event type only: at most one row per discipline per
-- programme (running always; cycling only for Ironman 70.3/full, enforced
-- in the app, not here, since which disciplines apply depends on the
-- chosen goal_target). source records whether this came from the patient's
-- own logged completions or was typed in/overridden by David.
create table public.programme_cardio_baselines (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  discipline text not null check (discipline in ('running', 'cycling')),
  value_number numeric not null,
  value_unit text not null check (value_unit in ('minutes', 'km', 'miles')),
  source text not null default 'clinician_entered' check (source in ('prefilled', 'clinician_entered')),
  captured_at timestamptz not null default now(),
  unique (programme_id, discipline)
);

alter table public.programme_cardio_baselines enable row level security;

create policy "Coaches can read cardio baselines" on public.programme_cardio_baselines
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));
