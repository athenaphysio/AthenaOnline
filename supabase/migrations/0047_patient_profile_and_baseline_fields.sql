-- Phase 3 of the individual client dashboard: the new fields confirmed
-- with David, smallest addition that covers the mockup without duplicating
-- anything the forms system already owns.
--
-- last_name joins first_name as a plain second field -- patients was
-- first-name-only until now.
--
-- date_of_birth, occupation, sport, assigned_clinician, clinic_location:
-- none of these existed anywhere. occupation and sport are two separate
-- fields, not one combined string, per David's own correction. assigned_
-- clinician is added now even though it's always "David Silver" in
-- practice today (one clinician) -- flagged at proposal time, not
-- objected to, so built as asked; it earns its keep once Coach accounts
-- are genuinely assigned per patient.
--
-- irritability and red_flags join the existing referral columns
-- (presenting_complaint, date_of_onset, mechanism_of_injury, body_region,
-- referred_via, referral_goals_history from 0046_patient_intake.sql) --
-- same intake-import feature fills these in too, one shared place for
-- both features to write to, as asked.
--
-- baseline_pain_score / baseline_outcome_score / baseline_outcome_measure
-- are the ONE-TIME-at-intake values only. Deliberately not adding a
-- "current" pain/outcome score column: that's inherently a repeated
-- measurement taken at multiple points over a programme, which is exactly
-- what the forms system (scale questions, sent periodically, answered
-- into form_responses) already exists to do -- a single column can't
-- honestly hold a time series. No forms exist in production yet to read
-- from, so there's nothing to duplicate today; "current" score should
-- read from the most recent relevant form response once a check-in form
-- exists, not from new schema.
alter table public.patients add column last_name text;
alter table public.patients add column date_of_birth date;
alter table public.patients add column occupation text;
alter table public.patients add column sport text;
alter table public.patients add column assigned_clinician text;
alter table public.patients add column clinic_location text;
alter table public.patients add column irritability text;
alter table public.patients add column red_flags text;
alter table public.patients add column baseline_pain_score integer;
alter table public.patients add column baseline_outcome_score integer;
alter table public.patients add column baseline_outcome_measure text;
