-- Rebuilt clean rather than bolted on -- session_completions has zero
-- production rows, so there's nothing to migrate. A row can now represent
-- either a completed item or a skipped whole session, not just
-- "completed by existing":
--   - status = 'completed': the existing per-item shape, exactly one of
--     exercise_id/cardio_block_id set, one row per exercise or cardio
--     block actually ticked off.
--   - status = 'skipped': a whole-session marker, both exercise_id and
--     cardio_block_id null -- the patient is treating this entire
--     week/day as skipped, not any one item within it.
-- completed_at is renamed to occurred_at since it now records when either
-- action happened, not only a completion.
drop table if exists public.session_completions;

create table public.session_completions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  week_number integer not null,
  day_of_week integer not null check (day_of_week between 1 and 7),
  status text not null check (status in ('completed', 'skipped')),
  exercise_id text references public.exercises(exercise_id),
  cardio_block_id uuid references public.cardio_blocks(id),
  occurred_at timestamptz not null default now(),
  constraint session_completions_shape check (
    (status = 'completed' and (exercise_id is not null) <> (cardio_block_id is not null))
    or
    (status = 'skipped' and exercise_id is null and cardio_block_id is null)
  )
);

-- One completed row per exercise or cardio block per session slot --
-- Postgres never treats two NULLs as equal, so each partial index is
-- inert for the other item kind, no combined index needed.
create unique index session_completions_exercise_unique
  on public.session_completions (patient_id, programme_id, exercise_id, week_number, day_of_week)
  where status = 'completed' and exercise_id is not null;

create unique index session_completions_cardio_unique
  on public.session_completions (patient_id, programme_id, cardio_block_id, week_number, day_of_week)
  where status = 'completed' and cardio_block_id is not null;

-- One skip row per whole session slot, regardless of item.
create unique index session_completions_skip_unique
  on public.session_completions (patient_id, programme_id, week_number, day_of_week)
  where status = 'skipped';

alter table public.session_completions enable row level security;

create policy "Patients can read their own completions" on public.session_completions
  for select using (auth.uid() = patient_id);

create policy "Patients can mark their own completions" on public.session_completions
  for insert with check (auth.uid() = patient_id);

create policy "Patients can unmark their own completions" on public.session_completions
  for delete using (auth.uid() = patient_id);

-- New: a status can now transition (e.g. a skip later replaced by a late
-- completion) via upsert rather than only ever delete-then-insert.
create policy "Patients can update their own completions" on public.session_completions
  for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);
