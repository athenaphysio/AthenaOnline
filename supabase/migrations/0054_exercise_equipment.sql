-- Equipment tagging for the exercise library, same many-to-many shape as
-- body_parts/exercise_body_parts (0050_exercise_body_parts.sql). icon_url
-- is filled in later by David uploading his own custom icon set per item
-- (via the small management page), not seeded here -- starts null/placeholder
-- for every row.
create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_url text
);

create table public.exercise_equipment (
  exercise_id text not null references public.exercises(exercise_id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  primary key (exercise_id, equipment_id)
);

-- Same trust boundary as body_parts: public read, writes only via the
-- service-role key used throughout /clinic.
alter table public.equipment enable row level security;
alter table public.exercise_equipment enable row level security;

create policy "Public read access" on public.equipment for select using (true);
create policy "Public read access" on public.exercise_equipment for select using (true);

-- Working draft David can correct or extend -- "Plyo box" is a best guess
-- at "climactic box", flagged for David to confirm before this is treated
-- as final.
insert into public.equipment (name) values
  ('Bodyweight (no equipment)'),
  ('Mat'),
  ('Dumbbells'),
  ('Kettlebells'),
  ('Weight plates'),
  ('Barbell'),
  ('Resistance bands'),
  ('Cable machine'),
  ('Gym machine (generic)'),
  ('Gym bench'),
  ('Suspension trainer'),
  ('Foam roller'),
  ('Yoga wedge'),
  ('Gym ball (Swiss ball)'),
  ('Pilates ball'),
  ('Weighted yoga ball'),
  ('Step box'),
  ('Plyo box'),
  ('Stairs');
