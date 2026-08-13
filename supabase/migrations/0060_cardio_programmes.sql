-- Multi-week cardio programmes -- a distinct concept from cardio_blocks
-- (one fixed single-session prescription): a whole plan spanning several
-- weeks, each with its own days, that maps to a cardio phase rather than
-- one session. Same template pattern as everything else reusable in this
-- app: one shared row per programme, referenced rather than copied.
--
-- Day content is deliberately plain text (cardio_programme_days.description)
-- rather than forced into cardio_blocks' structured reps/work/rest fields --
-- these day prescriptions are genuinely loose ("try the Workout of the
-- Day, any intensity", "pick your own format") in a way that model doesn't
-- fit, and forcing a false structure onto them would misrepresent the
-- source.
--
-- No Vault builder UI yet -- this is schema plus the first real content
-- (catalog of the 9 Concept2 official multi-week plans, and the one full
-- plan given in detail, "From Couch to Consistency"). Building the rest
-- of the catalog out day-by-day, and any UI to manage this, is future
-- work per athena_cardio_library_v2.md's own note that only one plan is
-- reproduced in full "for now".
create table public.cardio_programmes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text,
  modality text not null check (modality in ('running', 'cycling', 'ski_erg', 'row_erg', 'cross_trainer', 'any', 'other')),
  total_weeks integer,
  suggested_phase text,
  source_url text,
  source_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cardio_programme_days (
  id uuid primary key default gen_random_uuid(),
  cardio_programme_id uuid not null references public.cardio_programmes(id) on delete cascade,
  week_number integer not null,
  day_number integer not null,
  description text not null,
  sort_order integer not null,
  unique (cardio_programme_id, week_number, day_number)
);

alter table public.cardio_programmes enable row level security;
alter table public.cardio_programme_days enable row level security;

-- Same read-only widening as cardio_blocks (0036_cardio_blocks.sql) --
-- shared clinical content, not patient data.
create policy "Coaches can read the cardio programme library" on public.cardio_programmes
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

create policy "Coaches can read cardio programme days" on public.cardio_programme_days
  for select to authenticated
  using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.role = 'coach'));

-- The catalog: all 9 of Concept2's official multi-week plans, by name,
-- goal and suggested phase tag, per athena_cardio_library_v2.md Section 1.
-- total_weeks left null where the source doesn't state a week count in
-- the plan's own name -- not guessed. "Half Marathon Row" and "Marathon
-- Row" are set to row_erg specifically (the name itself says Row, unlike
-- the general RowErg/SkiErg/BikeErg note the rest fall under); "1000m
-- BikeErg Race" plans are bike-specific for the same reason.
insert into public.cardio_programmes (name, goal, modality, total_weeks, suggested_phase, source_url, source_label) values
  ('From Couch to Consistency', 'Build a consistent habit from a standing start', 'any', 6,
   'Early / return to activity', 'https://www.concept2.com/training/plans/couch-to-consistency', 'Concept2 official'),
  ('4 Minute Erg Test', 'Prep for a short, max-effort test', 'any', null,
   'Performance', 'https://www.concept2.com/training/plans', 'Concept2 official'),
  ('500m Erg Test', 'Prep for a sprint test', 'any', null,
   'Performance', 'https://www.concept2.com/training/plans', 'Concept2 official'),
  ('5k Erg Test', 'Prep for a longer test', 'any', null,
   'Building capacity / performance', 'https://www.concept2.com/training/plans', 'Concept2 official'),
  ('2k Erg Test (4 week)', 'Improve 2000m time, short runway', 'any', 4,
   'Building capacity / performance', 'https://www.concept2.com/training/plans', 'Concept2 official'),
  ('2k Erg Test (12 week)', 'Improve 2000m time, full runway', 'any', 12,
   'Building capacity / performance', 'https://www.concept2.com/training/plans', 'Concept2 official'),
  ('1000m BikeErg Race (6 week)', 'Prep for a 1000m bike test', 'cycling', 6,
   'Building capacity / performance', 'https://www.concept2.com/training/plans', 'Concept2 official'),
  ('1000m BikeErg Race (8 week)', 'Prep for a 1000m bike test', 'cycling', 8,
   'Building capacity / performance', 'https://www.concept2.com/training/plans', 'Concept2 official'),
  ('Half Marathon Row', 'Endurance, half-marathon row distance', 'row_erg', null,
   'Performance / endurance', 'https://www.concept2.com/training/plans', 'Concept2 official'),
  ('Marathon Row', 'Endurance, full marathon row distance', 'row_erg', null,
   'Performance / endurance', 'https://www.concept2.com/training/plans', 'Concept2 official');

-- Full week-by-week detail for From Couch to Consistency, the one plan
-- reproduced in full. Weeks 5-6 are given in the source as "repeat the
-- week 4 pattern" (week 5, stored here as an exact copy) then "swap in"
-- three named replacements for week 6 -- the source doesn't say which
-- day-slot each replacement takes, so they're matched here to the day
-- with the closest existing format (steady effort -> Day 1's slot,
-- pyramid/distance -> Day 2's slot, interval work -> Day 4's slot, WOD
-- unchanged in Day 3) rather than a literal transcription. Worth David's
-- eye specifically on that mapping.
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.cardio_programmes where name = 'From Couch to Consistency';

  insert into public.cardio_programme_days (cardio_programme_id, week_number, day_number, description, sort_order) values
    -- Week 1
    (v_id, 1, 1, 'Just Row/Ski/Bike, no setup: 1 min easy/1 min rest/2 min easy/1 min rest/3 min easy/1 min rest/2 min easy/1 min rest/1 min easy.', 1),
    (v_id, 1, 2, 'Single Distance, 2000m: alternate 90 sec comfortable / 30 sec easy until 2000m done.', 2),
    (v_id, 1, 3, 'Single Time, 15 min: steady pace you can hold for 15 minutes.', 3),
    (v_id, 1, 4, '3 x 1000m "loop": half a loop (500m) a little harder, half a loop a little easier.', 4),
    -- Week 2
    (v_id, 2, 1, 'Intervals: 8 x (2 min moderate / 1 min easy).', 5),
    (v_id, 2, 2, '2 x 2000m, 3-5 min rest between.', 6),
    (v_id, 2, 3, '4 laps of the loop (short break after lap 2 if needed).', 7),
    (v_id, 2, 4, 'Single Time, 30 min, varying stroke rate/cadence between two paces (suggested: RowErg 22/26spm, SkiErg 35/42spm, BikeErg 70/90rpm).', 8),
    -- Week 3
    (v_id, 3, 1, 'Try the Concept2 Workout of the Day, any intensity.', 9),
    (v_id, 3, 2, 'Short intervals: 2 sets of 10 x (40 sec work / 20 sec rest), several minutes easy rowing between sets.', 10),
    (v_id, 3, 3, '4000m at a consistent pace.', 11),
    (v_id, 3, 4, 'Pyramid: 1-2-3-4-3-2-1 min, 1 min rest between.', 12),
    -- Week 4
    (v_id, 4, 1, 'Single Time, 40 min (or 40 min on the loop).', 13),
    (v_id, 4, 2, '6 x 500m, 2 min rest between.', 14),
    (v_id, 4, 3, 'Workout of the Day.', 15),
    (v_id, 4, 4, '2 min work intervals, undefined rest; fill rest with 10 reps of a bodyweight exercise (sit-ups, push-ups, air squats).', 16),
    -- Week 5 -- source says "repeat the Week 4 pattern"
    (v_id, 5, 1, 'Single Time, 40 min (or 40 min on the loop).', 17),
    (v_id, 5, 2, '6 x 500m, 2 min rest between.', 18),
    (v_id, 5, 3, 'Workout of the Day.', 19),
    (v_id, 5, 4, '2 min work intervals, undefined rest; fill rest with 10 reps of a bodyweight exercise (sit-ups, push-ups, air squats).', 20),
    -- Week 6 -- three swaps from the source, mapped to the closest-matching
    -- day slot above (see note before this block); WOD day unchanged.
    (v_id, 6, 1, '5000m at a consistent pace.', 21),
    (v_id, 6, 2, 'Distance pyramid: 500-1000-1500-1000-500m, 2 min rest between.', 22),
    (v_id, 6, 3, 'Workout of the Day.', 23),
    (v_id, 6, 4, 'Shorter intervals: 2 sets of 8 x (1 min work / 30 sec rest).', 24);
end $$;
