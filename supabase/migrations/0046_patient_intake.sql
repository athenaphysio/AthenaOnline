-- Intake form import: David exports an intake form from Cliniko/Setmore
-- (PDF, screenshot, or photo) and drags it onto a patient's record. The
-- file is read by Claude, the extracted fields are shown back to David as
-- an editable review before anything is saved -- see
-- src/lib/extractIntakeForm.ts and IntakeUploader.tsx.

-- The referral/intake fields themselves live directly on patients, the
-- same way first_name/email already do -- this is "the patient's referral
-- details", not a separate concern with its own lifecycle. All nullable
-- text: intake forms are rarely clean structured data ("date of onset"
-- is as likely to be "about three weeks ago" as a real date), so no type
-- coercion is forced on what's actually free text.
alter table public.patients add column presenting_complaint text;
alter table public.patients add column date_of_onset text;
alter table public.patients add column mechanism_of_injury text;
alter table public.patients add column body_region text;
alter table public.patients add column referred_via text;
alter table public.patients add column referral_goals_history text;

-- The uploaded document itself, kept attached permanently (never deleted
-- after processing) -- a patient may accumulate more than one over time
-- (an updated form, a second clinic's intake), so this is its own table
-- rather than a single column, same reasoning as completion_audio_url
-- living on programmes rather than being folded into patients.
create table public.patient_intake_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.patient_intake_documents enable row level security;

-- Clinic-only content -- Owner reads via the service_role key, which
-- bypasses RLS entirely, same as patients itself. No coach or patient
-- policy: this is referral paperwork, not something either of those
-- roles has been asked to see.

-- Storage bucket for the files themselves. Deliberately NOT public, unlike
-- the audio/images buckets (0003_add_audio.sql, 0040_shop_cover_images.sql)
-- -- those hold coaching cues and cover photos, not real patient
-- documents. Nothing can read or write this bucket except server-side code
-- using the service_role key; viewing a file means generating a short-lived
-- signed URL on demand (see getIntakeFileSignedUrl in
-- src/lib/intakeFileUpload.ts), not a permanent public link.
insert into storage.buckets (id, name, public)
values ('intake-forms', 'intake-forms', false)
on conflict (id) do nothing;
