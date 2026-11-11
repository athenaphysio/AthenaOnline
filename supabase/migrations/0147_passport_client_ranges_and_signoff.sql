-- Two changes to the Human Passport.
--
-- 1. Reference ranges belong to each result, not only to the marker.
--    Labs print ranges that differ by sex, age and laboratory, so the range
--    a client's result is judged against is stored with that result. The
--    marker library keeps a default range, used only when a result carries
--    none of its own. Existing results take a copy of today's library
--    ranges, so nothing a client or clinician sees changes today, and no
--    later upload for another client can change them.
--
-- 2. Multidisciplinary sign-off. Results are reviewed at a multidisciplinary
--    meeting before any of them reaches the client. One sign-off per client
--    per test date records the meeting date and the clinicians who signed
--    it off. A result cannot be released until its test date is signed off.

alter table public.passport_results
  add column if not exists range_low numeric,
  add column if not exists range_high numeric,
  add column if not exists optimal_low numeric,
  add column if not exists optimal_high numeric;

update public.passport_results r
set range_low = m.range_low,
    range_high = m.range_high,
    optimal_low = m.optimal_low,
    optimal_high = m.optimal_high
from public.passport_markers m
where m.marker_key = r.marker_key
  and r.range_low is null and r.range_high is null and r.optimal_low is null and r.optimal_high is null;

create table if not exists public.passport_signoffs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  -- The date the samples or tests were taken, matching passport_results.taken_on.
  taken_on date not null,
  meeting_on date not null,
  -- Names and roles of the clinicians who signed the results off.
  clinicians text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (patient_id, taken_on)
);

-- Clinic only: read and written through the clinic's server routes.
alter table public.passport_signoffs enable row level security;
