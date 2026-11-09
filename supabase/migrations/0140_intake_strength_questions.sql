-- Brings the Programme intake and Regenerate programme intake forms already
-- in the Forms library into line with builderForms.ts: six more strength
-- questions after "How experienced are you with strength training?", and
-- the seven day questions asked as a choice of minutes rather than free
-- text, so the strength and cardio builders know how long each day really
-- is. Past answers keep their own wording (prompt_snapshot), so nothing
-- already submitted changes. Safe to run twice.

do $$
declare
  f record;
  exp_order int;
  day text;
  minutes jsonb := '["Can''t train", "20 minutes", "30 minutes", "45 minutes", "60 minutes", "75 minutes", "90 minutes", "2 hours", "3 hours or more"]'::jsonb;
begin
  for f in select id from public.forms where title in ('Programme intake', 'Regenerate programme intake') loop
    -- The day questions, as minutes.
    foreach day in array array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] loop
      update public.form_questions
        set type = 'multiple_choice',
            prompt = day || ': how long could you train in total?',
            options = minutes
        where form_id = f.id and prompt = day || ': how long could you train? Leave blank if you can''t train that day.';
    end loop;

    -- The strength questions, once.
    if exists (select 1 from public.form_questions where form_id = f.id and prompt like 'What do you currently lift%') then
      continue;
    end if;
    select question_order into exp_order from public.form_questions
      where form_id = f.id and prompt = 'How experienced are you with strength training?';
    if exp_order is null then
      continue;
    end if;
    update public.form_questions set question_order = question_order + 6 where form_id = f.id and question_order > exp_order;
    insert into public.form_questions (form_id, question_order, type, prompt, options, required) values
      (f.id, exp_order + 1, 'long_text', 'What do you currently lift, if anything? For example squat 100 kg for 5, bench press 60 kg for 8, or bodyweight exercises only.', null, false),
      (f.id, exp_order + 2, 'long_text', 'Is there anything specific you want from strength training? For example a stronger squat, fewer niggles when you run, or more power for your sport.', null, false),
      (f.id, exp_order + 3, 'multiple_choice', 'How long would you like each strength session to be?', '["20 minutes", "30 minutes", "45 minutes", "60 minutes", "75 minutes or more"]'::jsonb, false),
      (f.id, exp_order + 4, 'multi_select', 'Which of these can you use for strength training? Tick all that apply.', '["Full gym", "Barbell and rack", "Dumbbells", "Kettlebells", "Cable machine", "Resistance machines", "Bench", "Pull up bar", "Resistance bands", "Step or box", "Nothing, bodyweight only"]'::jsonb, false),
      (f.id, exp_order + 5, 'multiple_choice', 'How would you like your strength sessions arranged?', '["Whole body each time", "Upper body and lower body on different days", "No preference, you decide"]'::jsonb, false),
      (f.id, exp_order + 6, 'long_text', 'Are there any exercises you particularly enjoy, or any you can''t do or would rather avoid?', null, false);
  end loop;
end $$;
