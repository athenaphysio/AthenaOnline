-- Step 3/4 of the athena-plan-v1 direction: the client's weekly calendar,
-- logging, the flare button, and David's copy-log.

-- The plan's own start_date (inside raw_json) is never touched -- rule 2
-- of the brief, "never change the content of an imported plan." Repeating
-- a week instead moves this separate column on, which every week-number
-- calculation reads instead of raw_json's own start_date. Starts equal to
-- it at import time.
alter table public.imported_plans add column effective_start_date date;
update public.imported_plans set effective_start_date = start_date;
alter table public.imported_plans alter column effective_start_date set not null;

-- The client reads their own assigned plan directly (same trust model as
-- programmes/session_completions), so the /plan page and every route
-- below can run through their own authenticated client for the ownership
-- check rather than trusting a patient_id sent in the body.
create policy "Patients can read their own imported plans" on public.imported_plans
  for select using (auth.uid() = patient_id);

-- One row per session actually logged -- keyed on the session's own
-- stable id from the plan JSON (unique across the whole plan, enforced by
-- the validator), so a second "Mark complete" on the same id (e.g. after
-- repeating a week) overwrites rather than piling up duplicate history.
create table public.plan_session_logs (
  id uuid primary key default gen_random_uuid(),
  imported_plan_id uuid not null references public.imported_plans(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  session_id text not null,
  completed_quality text check (completed_quality in ('finished', 'partial', 'not_done')),
  pain_score smallint check (pain_score between 0 and 10),
  note text,
  next_morning_answer text check (next_morning_answer in ('better', 'same', 'worse')),
  completed_at timestamptz not null default now(),
  next_morning_answered_at timestamptz,
  unique (imported_plan_id, session_id)
);

alter table public.plan_session_logs enable row level security;

create policy "Patients can read their own plan logs" on public.plan_session_logs
  for select using (auth.uid() = patient_id);
create policy "Patients can log their own plan sessions" on public.plan_session_logs
  for insert with check (auth.uid() = patient_id);
create policy "Patients can update their own plan logs" on public.plan_session_logs
  for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- "Repeat this week" (plain, or via the flare button) and a flare-up are
-- the same underlying action (push effective_start_date on by 7 days) but
-- need to read separately in both the clinic's "notifies David" view and
-- David's copy-log ("Weeks repeated" vs "Flare-ups" are two different
-- lines). Clinic-only read, written by the app via supabaseAdmin after
-- the patient-scoped ownership check, same pattern as the old flare
-- route -- no patient RLS policy needed here.
create table public.plan_events (
  id uuid primary key default gen_random_uuid(),
  imported_plan_id uuid not null references public.imported_plans(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('repeat_week', 'flare_up')),
  week_number integer not null,
  created_at timestamptz not null default now()
);

alter table public.plan_events enable row level security;
