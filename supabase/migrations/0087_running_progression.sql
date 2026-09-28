-- Step 4 of the Running Builder brief: logging each run, asking the next
-- morning how it felt, and moving a client up (or back) their ladder from
-- that. Three new tables plus a few columns on tables that already exist.

-- Per-client preferences, not per-programme -- a client keeps the same
-- pain limit and the same "ask me first vs automatic" choice across
-- however many running programmes they're ever built. David can change
-- either any time from the patient record.
alter table public.patients add column running_pain_limit smallint not null default 3 check (running_pain_limit between 0 and 10);
alter table public.patients add column running_progression_mode text not null default 'ask_first' check (running_progression_mode in ('ask_first', 'automatic'));

-- Captured at "Mark complete" time for a Run block only -- the two quick
-- questions from the brief ("did you finish it as written" / pain 0-10).
-- Both null for every exercise/cardio completion, and for a run completion
-- from before this migration existed.
alter table public.session_completions add column run_completion_quality text check (run_completion_quality in ('finished', 'partial', 'not_done'));
alter table public.session_completions add column run_pain_score smallint check (run_pain_score between 0 and 10);

-- The next-morning question, tied to the specific run completion it's
-- asking about -- one answer per completed run, never re-asked once
-- answered. Runs through the patient's own authenticated client, same as
-- session_completions itself.
create table public.run_morning_checkins (
  id uuid primary key default gen_random_uuid(),
  session_completion_id uuid not null references public.session_completions(id) on delete cascade unique,
  patient_id uuid not null references public.patients(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  answer text not null check (answer in ('better', 'same', 'worse')),
  answered_at timestamptz not null default now()
);

alter table public.run_morning_checkins enable row level security;

create policy "Patients can read their own morning check-ins" on public.run_morning_checkins
  for select using (auth.uid() = patient_id);

create policy "Patients can answer their own morning check-ins" on public.run_morning_checkins
  for insert with check (auth.uid() = patient_id);

-- The live state of one running programme once approved -- which ladder,
-- which rung it's actually on right now, and which two workouts (Quality
-- run, Easy run) carry that rung's content and need updating when the
-- client moves. One row per programme; created by the approve route only
-- when the draft matched a real ladder and starting rung. Clinic-only, so
-- RLS is enabled with no policies, same as running_ladders/running_rungs.
create table public.running_programme_state (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade unique,
  patient_id uuid not null references public.patients(id) on delete cascade,
  ladder_id uuid not null references public.running_ladders(id),
  current_rung_number integer not null,
  quality_run_workout_id uuid references public.workouts(id),
  easy_run_workout_id uuid references public.workouts(id),
  -- How many good runs (finished as written, at/under the pain limit,
  -- better/same the next morning) have landed in a row since the last
  -- rung change -- reset to 0 the moment two are reached and acted on.
  consecutive_good_runs smallint not null default 0,
  -- How many mornings in a row have come back "worse" -- reset to 0 the
  -- moment it either breaks or triggers a drop-back.
  consecutive_worse_mornings smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.running_programme_state enable row level security;

-- Every "ready to move up," "moved up automatically," or "dropped back"
-- moment -- the thing David actually sees and, for ask_first clients,
-- Approves or Holds. A dropped_back or automatic-mode row is created
-- already resolved (status 'approved'); an ask_first ready_to_progress row
-- starts 'pending' until David acts. Clinic-only, RLS enabled, no policies.
create table public.running_progression_events (
  id uuid primary key default gen_random_uuid(),
  programme_state_id uuid not null references public.running_programme_state(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('ready_to_progress', 'progressed_automatic', 'dropped_back')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'held')),
  from_rung_number integer not null,
  to_rung_number integer not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.running_progression_events enable row level security;
