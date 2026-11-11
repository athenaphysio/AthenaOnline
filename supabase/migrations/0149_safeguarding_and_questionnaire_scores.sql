-- Safeguarding and questionnaire scores.
--
-- 1. Who the safeguarding alert goes to. The clinic owner always receives
--    it; any further addresses here (for example the supervising physician)
--    receive it too.
--
-- 2. A record of every safeguarding alert, so one can never be lost to a
--    failed email: each stays on the clinic home page until a clinician
--    marks it as reviewed.
--
-- 3. Markers for questionnaire scores, so the Wellbeing survey and Lifestyle
--    check scores land in the Human Passport as drafts and can be followed
--    over time. Default ranges follow the scoring bands already used for
--    each questionnaire in the app, written as the highest (or lowest)
--    score still inside the band, since range limits count as inside.
--    For example PHQ-9 10 or more is flagged, so its range ends at 9.

alter table public.clinic_settings
  add column if not exists safeguarding_alert_emails text[] not null default '{}';

create table if not exists public.safeguarding_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  form_response_id uuid,
  form_title text,
  email_sent boolean not null default false,
  email_error text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists safeguarding_alerts_open_idx on public.safeguarding_alerts (reviewed_at, created_at desc);
alter table public.safeguarding_alerts enable row level security;

insert into public.passport_markers
  (marker_key, domain, panel, name, unit, explanation, range_low, range_high, better, sort_order)
values
  ('mind_behaviour.phq-9', 'mind_behaviour', 'Questionnaires', 'PHQ-9 (mood)', 'score', 'A short questionnaire about low mood over the last two weeks.', null, 9, 'lower', 10),
  ('mind_behaviour.gad-7', 'mind_behaviour', 'Questionnaires', 'GAD-7 (anxiety)', 'score', 'A short questionnaire about worry and anxiety over the last two weeks.', null, 9, 'lower', 11),
  ('mind_behaviour.dass-21-stress', 'mind_behaviour', 'Questionnaires', 'DASS-21 stress', 'score', 'A questionnaire about how much stress you have felt recently.', null, 14, 'lower', 12),
  ('mind_behaviour.who-5', 'mind_behaviour', 'Questionnaires', 'WHO-5 wellbeing', 'score', 'A five question measure of your general wellbeing.', 51, null, 'higher', 13),
  ('mind_behaviour.cbi-personal-burnout', 'mind_behaviour', 'Questionnaires', 'Personal burnout (CBI)', 'score', 'How physically and emotionally drained you have felt.', null, 49.9, 'lower', 14),
  ('mind_behaviour.cbi-work-burnout', 'mind_behaviour', 'Questionnaires', 'Work burnout (CBI)', 'score', 'How drained you have felt in relation to your work.', null, 49.9, 'lower', 15),
  ('mind_behaviour.brief-resilience-scale', 'mind_behaviour', 'Questionnaires', 'Resilience (BRS)', 'score', 'How quickly you feel you bounce back from difficult times.', 3, null, 'higher', 16),
  ('mind_behaviour.fatigue-assessment-scale', 'mind_behaviour', 'Questionnaires', 'Fatigue (FAS)', 'score', 'How much tiredness has affected you recently.', null, 21, 'lower', 17),
  ('mind_behaviour.audit-c', 'mind_behaviour', 'Questionnaires', 'Alcohol (AUDIT-C)', 'score', 'Three questions about how much and how often you drink.', null, 4, 'lower', 18),
  ('sleep_energy.jenkins-sleep-scale', 'sleep_energy', 'Questionnaires', 'Sleep disturbance (Jenkins)', 'score', 'How often your sleep has been disturbed over the last month.', null, 11, 'lower', 20),
  ('sleep_energy.epworth-sleepiness-scale', 'sleep_energy', 'Questionnaires', 'Daytime sleepiness (Epworth)', 'score', 'How likely you are to doze off during everyday situations.', null, 10, 'lower', 21),
  ('sleep_energy.stop-bang', 'sleep_energy', 'Questionnaires', 'Sleep apnoea screen (STOP-Bang)', 'score', 'A short screen for signs that breathing may pause during sleep.', null, 2, 'lower', 22)
on conflict (marker_key) do nothing;
