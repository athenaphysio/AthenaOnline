-- Testing surfaced two problems with the original design: (1) form_answers.
-- question_id had no ON DELETE rule, so both editing a form (PATCH does a
-- delete-then-insert-fresh on form_questions) and deleting a form that had
-- ever been answered failed outright with a foreign key violation; (2) even
-- if that were fixed with a plain cascade, the answer rows -- and the
-- prompts they were answered against -- would be silently destroyed on the
-- next edit, contradicting the stated intent that "a submission stays
-- exactly what the patient actually saw even if the form's questions are
-- edited later." The fix is to snapshot the prompt and order onto the
-- answer at submission time, so display never depends on the live
-- form_questions row still existing.

alter table public.form_answers add column prompt_snapshot text;
alter table public.form_answers add column question_order_snapshot integer;

alter table public.form_answers alter column question_id drop not null;
alter table public.form_answers drop constraint form_answers_question_id_fkey;
alter table public.form_answers
  add constraint form_answers_question_id_fkey
  foreign key (question_id) references public.form_questions(id) on delete set null;
