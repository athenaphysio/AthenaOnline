-- A sample programme for testing the patient-facing page end to end.
-- Share link will be: /p/test123
with new_programme as (
  insert into public.programmes (patient_first_name, title, share_code)
  values ('Sam', 'Return to Running – Week 1', 'test123')
  returning id
)
insert into public.programme_items (programme_id, exercise_id, item_order, sets, reps, hold_seconds, frequency, rationale)
select new_programme.id, v.exercise_id, v.item_order, v.sets, v.reps, v.hold_seconds, v.frequency, v.rationale
from new_programme, (values
  ('EX-050', 1, 3, null::int, null::int, '3x per week', 'Rebuilding your sprint mechanics gradually — this keeps hip drive sharp without overloading the calf.'),
  ('EX-010', 2, 3, null::int, 30, 'Daily', 'Light, quick contact work to wake up the foot and ankle before your run.'),
  ('EX-123', 3, 2, 10, null::int, 'Daily', 'Your ankle has been a bit stiff into dorsiflexion — this keeps range open so it does not limit your stride.')
) as v(exercise_id, item_order, sets, reps, hold_seconds, frequency, rationale);
