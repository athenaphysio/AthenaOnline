-- Removes a programme's active access without deleting the programme or
-- any of its content -- used both by a clinician manually pausing access
-- (the "unassign" action on the patient record, which didn't previously
-- exist as its own mechanism) and automatically when a patient's
-- membership lapses. Null means active; a timestamp records when access
-- was paused and by what.
alter table public.programmes
  add column access_paused_at timestamptz;
