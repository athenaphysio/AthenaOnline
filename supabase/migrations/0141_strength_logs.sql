-- What a client records about each strength exercise when they mark it
-- done: the weight, the reps, how hard it felt out of 10, any pain, a note,
-- and whether they were not sure they were getting it right (a positive
-- engagement signal, never an alert). All optional; marking an exercise
-- done without logging anything stays exactly as before.

create table if not exists public.strength_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  week_number integer not null check (week_number >= 1),
  day_of_week integer not null check (day_of_week between 1 and 7),
  exercise_id text not null references public.exercises(exercise_id),
  weight_kg numeric(6, 2) check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 1000)),
  reps_done integer check (reps_done is null or (reps_done >= 0 and reps_done <= 200)),
  seconds_done integer check (seconds_done is null or (seconds_done >= 0 and seconds_done <= 3600)),
  effort smallint check (effort is null or effort between 1 and 10),
  pain smallint check (pain is null or pain between 0 and 10),
  not_sure boolean not null default false,
  note text,
  logged_at timestamptz not null default now(),
  unique (patient_id, programme_id, exercise_id, week_number, day_of_week)
);

create index if not exists strength_logs_programme_idx on public.strength_logs (programme_id, exercise_id, week_number);

alter table public.strength_logs enable row level security;

create policy "Clients read their own strength logs" on public.strength_logs
  for select using (auth.uid() = patient_id);
create policy "Clients add their own strength logs" on public.strength_logs
  for insert with check (auth.uid() = patient_id);
create policy "Clients update their own strength logs" on public.strength_logs
  for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);
create policy "Clients remove their own strength logs" on public.strength_logs
  for delete using (auth.uid() = patient_id);

-- Dr David Silver PhD's answer to each step up, hold or step back
-- suggestion, so an approved or dismissed one never comes back for the same
-- log. Clinic only: no client policies.

create table if not exists public.strength_decisions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  exercise_id text not null,
  based_on_log_id uuid references public.strength_logs(id) on delete set null,
  kind text not null check (kind in ('step_up', 'step_back')),
  decision text not null check (decision in ('approved', 'dismissed')),
  detail text,
  decided_at timestamptz not null default now()
);

create index if not exists strength_decisions_programme_idx on public.strength_decisions (programme_id, exercise_id);

alter table public.strength_decisions enable row level security;
