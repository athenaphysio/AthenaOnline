-- Goal picture, Phase 2 (see the Phase 1 audit): lives on programmes, not
-- patients, since a new programme can mean a new goal. Null means "still
-- showing the default" -- Phase 3/4 (patient/clinician upload) will be the
-- only things that ever set this to a real path.
alter table public.programmes add column goal_image_path text;

-- Same private-bucket-plus-signed-URL pattern as intake-forms
-- (0046_patient_intake.sql), not the public images bucket used for
-- clinician-curated content (exercise covers, equipment icons) -- this is
-- patient-uploaded material, so nothing can read or write it except
-- server-side code with the service-role key.
insert into storage.buckets (id, name, public)
values ('patient-goal-images', 'patient-goal-images', false)
on conflict (id) do nothing;
