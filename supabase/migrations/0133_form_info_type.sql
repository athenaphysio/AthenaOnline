-- A heading or instructions block in a form, with nothing to answer, so a
-- validated scale shows its own instructions once above its items (first
-- used by the Corporate Athlete Lifestyle check and Wellbeing survey).
alter table public.form_questions drop constraint form_questions_type_check;
alter table public.form_questions add constraint form_questions_type_check
  check (type = any (array['short_text','long_text','multiple_choice','multi_select','scale','yes_no','info']));
