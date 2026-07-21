-- Programmes now run as a block of N weeks, with prescriptions that can
-- progress week to week rather than staying fixed for the whole block.

alter table public.programmes
  add column block_length_weeks integer not null default 4,
  add column start_date timestamptz not null default now(),
  add column ai_draft jsonb,
  add column ai_draft_created_at timestamptz,
  add column updated_at timestamptz not null default now();

-- One row per exercise per week of the block. Replaces the single fixed
-- sets/reps/hold/frequency that used to live on programme_items directly.
-- A "flat" block (same numbers every week) is just this grid repeating the
-- same row for every week_number -- no separate structure needed.
create table public.programme_item_weeks (
  id uuid primary key default gen_random_uuid(),
  programme_item_id uuid not null references public.programme_items(id) on delete cascade,
  week_number integer not null,
  sets integer,
  reps integer,
  hold_seconds integer,
  frequency text,
  unique (programme_item_id, week_number)
);

-- Backfill: every existing programme_item's single prescription becomes the
-- same row repeated for every week in its programme's block length.
insert into public.programme_item_weeks (programme_item_id, week_number, sets, reps, hold_seconds, frequency)
select pi.id, w.week_number, pi.sets, pi.reps, pi.hold_seconds, pi.frequency
from public.programme_items pi
join public.programmes p on p.id = pi.programme_id
cross join lateral generate_series(1, p.block_length_weeks) as w(week_number);

alter table public.programme_items
  drop column sets,
  drop column reps,
  drop column hold_seconds,
  drop column frequency;

alter table public.programme_item_weeks enable row level security;
create policy "Public read access" on public.programme_item_weeks for select using (true);
