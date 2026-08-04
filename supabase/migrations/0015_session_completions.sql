-- Minimal, real completion tracking. "Mark as done" was previously local
-- React state only (TodaySession.tsx) -- never persisted, reset on reload.
--
-- Keyed on exercise_id rather than the resolved item's row id: block/workout
-- content is deleted-and-reinserted on every edit (fresh ids each time), so
-- keying on that row id would make completions silently vanish the next
-- time a block/workout is tweaked. exercise_id is stable and only "resets"
-- completion when the actual prescribed exercise genuinely changes.
create table public.session_completions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  exercise_id text not null references public.exercises(exercise_id),
  week_number integer not null,
  day_of_week integer not null check (day_of_week between 1 and 7),
  completed_at timestamptz not null default now(),
  unique (patient_id, programme_id, exercise_id, week_number, day_of_week)
);

alter table public.session_completions enable row level security;

-- A patient can read, add, and remove only their own completion rows --
-- same model as patients/programmes. No update policy: toggling is an
-- insert-if-absent / delete-if-present, never an edit of an existing row.
create policy "Patients can read their own completions" on public.session_completions
  for select using (auth.uid() = patient_id);

create policy "Patients can mark their own completions" on public.session_completions
  for insert with check (auth.uid() = patient_id);

create policy "Patients can unmark their own completions" on public.session_completions
  for delete using (auth.uid() = patient_id);
