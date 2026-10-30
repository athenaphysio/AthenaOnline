-- Baseline data pack: the tests in the standard Regenerate baseline pack
-- (first client RG-001, October 2026) added to the Human Passport.
--
-- Three pieces:
--   1. passport_results.value_qualifier, for results a lab reports as a
--      bound rather than a number, such as qFIT "under 7". The value column
--      holds the 7 and this column holds "<".
--   2. passport_findings, for one-off results that are not a single number
--      to trend over time: genetic tests, the food IgG panel and the
--      written ECG interpretation. Same draft then released rule as
--      passport_results, so a client only ever sees a finding once a
--      clinician has released it.
--   3. New markers in the marker library for body composition (Tanita
--      MC-780), resting ECG measurements and the bowel screen.

alter table public.passport_results
  add column if not exists value_qualifier text
    check (value_qualifier in ('<', '>'));

create table if not exists public.passport_findings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  category text not null
    check (category in ('genetic', 'food_sensitivity', 'ecg_report', 'other')),
  finding_key text not null,
  title text not null,
  -- What the passport shows, in plain words, e.g. "Average UK risk".
  result_label text not null,
  -- What the lab printed, kept for the clinician where it differs,
  -- e.g. the type 1 diabetes gauge reading "Moderate".
  lab_label text,
  -- The detail behind it: genotypes, scores, the full food list.
  detail jsonb not null default '{}'::jsonb,
  -- Genetic results are measured once; everything else can be repeated.
  remeasured boolean not null default true,
  timepoint text not null default 'baseline'
    check (timepoint in ('baseline', 'month_3', 'month_6', 'review')),
  taken_on date not null,
  source text,
  clinician_note text,
  status text not null default 'draft'
    check (status in ('draft', 'released')),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, finding_key, taken_on)
);

create index if not exists passport_findings_patient_idx
  on public.passport_findings (patient_id, category, taken_on);

alter table public.passport_findings enable row level security;

create policy "Clients can read their own released passport findings"
  on public.passport_findings for select to authenticated
  using (auth.uid() = patient_id and status = 'released');

insert into public.passport_markers
  (marker_key, domain, panel, name, unit, explanation, range_low, range_high, better, sort_order)
values
  ('body_movement.weight', 'body_movement', 'Body composition', 'Weight', 'kg',
   'Your total body weight, measured on the body composition scale.', null, null, 'in_range', 100),
  ('body_movement.body-fat', 'body_movement', 'Body composition', 'Body fat', '%',
   'The share of your body weight that is fat. The healthy range depends on age and sex; the one shown is for men aged 40 to 59.', 11.0, 22.0, 'in_range', 101),
  ('body_movement.fat-mass', 'body_movement', 'Body composition', 'Fat mass', 'kg',
   'The weight of fat in your body.', 8.3, 19.0, 'in_range', 102),
  ('body_movement.fat-free-mass', 'body_movement', 'Body composition', 'Fat free mass', 'kg',
   'Everything that is not fat: muscle, bone, organs and water.', null, null, 'higher', 103),
  ('body_movement.muscle-mass', 'body_movement', 'Body composition', 'Muscle mass', 'kg',
   'The weight of muscle in your body, including the water it holds.', null, null, 'higher', 104),
  ('body_movement.bmi', 'body_movement', 'Body composition', 'Body mass index', null,
   'Weight compared with height. A rough guide that cannot tell muscle from fat, so it is read alongside body fat.', 18.5, 25.0, 'in_range', 105),
  ('body_movement.visceral-fat', 'body_movement', 'Body composition', 'Visceral fat rating', 'rating',
   'An estimate of the fat stored around your internal organs. Lower is healthier, and 1 to 12 is the healthy range.', 1, 12, 'lower', 106),
  ('body_movement.metabolic-age', 'body_movement', 'Body composition', 'Metabolic age', 'years',
   'How your resting metabolism compares with the average for each age.', null, null, 'lower', 107),
  ('body_movement.bmr', 'body_movement', 'Body composition', 'Basal metabolic rate', 'kcal',
   'The energy your body uses each day at complete rest.', null, null, 'in_range', 108),
  ('body_movement.total-body-water', 'body_movement', 'Body composition', 'Total body water', '%',
   'The share of your body weight that is water.', null, null, 'in_range', 109),
  ('body_movement.ecw-tbw-ratio', 'body_movement', 'Body composition', 'Extracellular water ratio', '%',
   'The share of your body water held outside the cells. Rises with inflammation or fluid retention.', null, null, 'in_range', 110),
  ('body_movement.bone-mass', 'body_movement', 'Body composition', 'Bone mass', 'kg',
   'An estimate of the mineral weight of your skeleton.', null, null, 'in_range', 111),
  ('body_movement.leg-muscle-score', 'body_movement', 'Body composition', 'Leg muscle score', 'score',
   'How your leg muscle compares with your body weight. Higher means stronger legs for your size.', null, null, 'higher', 112),
  ('heart_recovery.ecg-heart-rate', 'heart_recovery', 'Resting ECG', 'Heart rate on ECG', 'bpm',
   'Your heart rate during the resting heart tracing. Fit people often sit below 60.', 60, 100, 'in_range', 200),
  ('heart_recovery.ecg-pr-interval', 'heart_recovery', 'Resting ECG', 'PR interval', 'ms',
   'The time for each beat''s signal to travel from the upper to the lower chambers of the heart.', 120, 200, 'in_range', 201),
  ('heart_recovery.ecg-qrs-duration', 'heart_recovery', 'Resting ECG', 'QRS duration', 'ms',
   'The time the lower chambers take to activate with each beat.', null, 120, 'in_range', 202),
  ('heart_recovery.ecg-qtc', 'heart_recovery', 'Resting ECG', 'QTc interval', 'ms',
   'The time the heart takes to reset between beats, corrected for heart rate. Under 450 is normal for men.', null, 450, 'in_range', 203),
  ('gut.calprotectin', 'gut', 'Bowel screen', 'Calprotectin', 'ng/ml',
   'A protein released when the bowel is inflamed. Under 43.47 is negative and over 104.35 is positive.', null, 43.47, 'lower', 300),
  ('gut.qfit', 'gut', 'Bowel screen', 'qFIT, blood in stool', 'µg Hb/g',
   'A sensitive test for hidden blood in the stool. Under 10 is negative.', null, 10, 'lower', 301)
on conflict (marker_key) do nothing;
