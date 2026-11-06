-- A "tick all that apply" question type for forms, first used by the
-- Regenerate version of the Programme intake form (its medication,
-- facilities and support questions mirror the Corporate Athlete survey).
-- The answer is stored as the ticked options joined by semicolons.
alter table public.form_questions drop constraint form_questions_type_check;
alter table public.form_questions add constraint form_questions_type_check
  check (type = any (array['short_text','long_text','multiple_choice','multi_select','scale','yes_no']));

-- Which intake form a link submission answered, since a pack can now have
-- its own version (Regenerate), so it is filed against the right form.
alter table public.link_intake_submissions add column form_id uuid references public.forms(id) on delete set null;
