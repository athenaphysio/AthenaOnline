-- Preprogrammed generic blocks: same shape as a real programme's exercise
-- grid, but with no patient, audio, share code, or ai_draft -- just an
-- exercise selection that can be picked as a unit and then customised.
create table public.programme_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  block_length_weeks integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.programme_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.programme_templates(id) on delete cascade,
  item_order integer not null
);

create table public.programme_template_item_weeks (
  id uuid primary key default gen_random_uuid(),
  template_item_id uuid not null references public.programme_template_items(id) on delete cascade,
  week_number integer not null,
  exercise_id text not null references public.exercises(exercise_id),
  rationale text,
  sets integer,
  reps integer,
  hold_seconds integer,
  percent_max integer,
  frequency text,
  unique (template_item_id, week_number)
);

alter table public.programme_templates enable row level security;
alter table public.programme_template_items enable row level security;
alter table public.programme_template_item_weeks enable row level security;

create policy "Public read access" on public.programme_templates for select using (true);
create policy "Public read access" on public.programme_template_items for select using (true);
create policy "Public read access" on public.programme_template_item_weeks for select using (true);
