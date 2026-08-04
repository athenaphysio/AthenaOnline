-- A simple, append-only log of which exercises/blocks Dr Silver actually
-- picks in the Workout Builder, and the brief context active at the time.
-- This is read back by the ranking prompt (src/lib/rankLibrary.ts) as a
-- genuine personal-preference signal on top of clinical judgement -- it only
-- ever influences ranking ORDER, never what's available to browse.
create table public.picker_selection_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pool text not null check (pool in ('exercises', 'blocks')),
  item_id text not null,
  slot_type text check (slot_type in ('warm_up', 'activation', 'main_body', 'injury_prevention', 'cool_down')),
  focus text,
  equipment text,
  experience_level text,
  tags text[]
);

create index picker_selection_history_pool_slot_idx
  on public.picker_selection_history (pool, slot_type, created_at desc);

-- Same shared-content security model as blocks/workouts (see 0009): no
-- anon/authenticated policy at all, service_role only.
alter table public.picker_selection_history enable row level security;
