-- Body-part tagging for the exercise library (Vault Phase 4). Many-to-many
-- since a single exercise can target more than one joint and/or muscle at
-- once (e.g. a knee exercise that's also a hamstring exercise). The seed
-- list is a working draft for David to correct or extend, not a fixed
-- taxonomy.
create table public.body_parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('joint', 'muscle'))
);

create table public.exercise_body_parts (
  exercise_id text not null references public.exercises(exercise_id) on delete cascade,
  body_part_id uuid not null references public.body_parts(id) on delete cascade,
  primary key (exercise_id, body_part_id)
);

-- Same trust boundary as exercises itself (0001_initial_schema.sql): public
-- read, writes only via the service-role key used throughout /clinic.
alter table public.body_parts enable row level security;
alter table public.exercise_body_parts enable row level security;

create policy "Public read access" on public.body_parts for select using (true);
create policy "Public read access" on public.exercise_body_parts for select using (true);

insert into public.body_parts (name, type) values
  ('Cervical spine', 'joint'),
  ('Thoracic spine', 'joint'),
  ('Lumbar spine', 'joint'),
  ('Shoulder', 'joint'),
  ('Elbow', 'joint'),
  ('Wrist/hand', 'joint'),
  ('Hip', 'joint'),
  ('Knee', 'joint'),
  ('Ankle/foot', 'joint'),
  ('SI joint', 'joint'),
  ('Rotator cuff', 'muscle'),
  ('Deltoids', 'muscle'),
  ('Pecs', 'muscle'),
  ('Lats', 'muscle'),
  ('Biceps', 'muscle'),
  ('Triceps', 'muscle'),
  ('Forearms', 'muscle'),
  ('Core/abdominals', 'muscle'),
  ('Erector spinae (lower back)', 'muscle'),
  ('Glutes', 'muscle'),
  ('Hip flexors', 'muscle'),
  ('Adductors', 'muscle'),
  ('Abductors', 'muscle'),
  ('Quadriceps', 'muscle'),
  ('Hamstrings', 'muscle'),
  ('Calves', 'muscle');
