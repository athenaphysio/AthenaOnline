-- Step 4: one calendar for the client. Logging for plan-code cards inside an
-- ordinary programme, and the repeat / flare events that go with it.
create table public.programme_card_logs (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  workout_id uuid not null,
  week_number smallint not null,
  completed_quality text check (completed_quality in ('finished', 'partial', 'not_done')),
  pain_score smallint check (pain_score between 0 and 10),
  note text,
  next_morning_answer text check (next_morning_answer in ('better', 'same', 'worse')),
  completed_at timestamptz not null default now(),
  next_morning_answered_at timestamptz,
  unique (programme_id, workout_id, week_number)
);

alter table public.programme_card_logs enable row level security;

create policy "Clients can read their own card logs" on public.programme_card_logs
  for select using (auth.uid() = patient_id);
create policy "Clients can log their own cards" on public.programme_card_logs
  for insert with check (auth.uid() = patient_id);
create policy "Clients can update their own card logs" on public.programme_card_logs
  for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

create table public.programme_events (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('repeat_week', 'flare_up')),
  week_number integer not null,
  created_at timestamptz not null default now()
);

alter table public.programme_events enable row level security;

-- Off by default: the separate Import plan screen and /plan calendar.
alter table public.clinic_settings add column legacy_plan_calendar_enabled boolean not null default false;
