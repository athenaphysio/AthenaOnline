-- A genuinely new system: David builds a form (title + questions), sends it
-- to a patient or a group, the patient answers it in their app, and the
-- answer lands on their record. Submissions may contain health information,
-- so this gets the exact same protection as the rest of a patient's
-- clinical record -- RLS scoped to auth.uid() = patient_id, Owner access
-- only via supabaseAdmin through the password-gated /clinic/* surface.

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  question_order integer not null,
  type text not null check (type in ('short_text', 'long_text', 'multiple_choice', 'scale', 'yes_no')),
  prompt text not null,
  -- multiple_choice only: array of option strings. scale is a fixed 1-5,
  -- yes_no is fixed -- neither needs configuration, keeping this simple.
  options jsonb,
  required boolean not null default true
);

-- One "send" = one assignment of a form to one patient, at a point in time.
-- Sending to a group fans out into one row per current member -- a
-- snapshot at send time, not a live binding, matching how every other
-- "assign" action in this app already works. Deliberately no uniqueness
-- constraint: a check-in form needs to be sendable again and again.
create table public.form_sends (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  sent_at timestamptz not null default now()
);

-- One response per send (a send is pending until this exists, then done).
-- Tied to the send, not just the form, so a submission stays exactly what
-- the patient actually saw even if the form's questions are edited later.
create table public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_send_id uuid not null references public.form_sends(id) on delete cascade unique,
  patient_id uuid not null references public.patients(id) on delete cascade,
  submitted_at timestamptz not null default now()
);

create table public.form_answers (
  id uuid primary key default gen_random_uuid(),
  form_response_id uuid not null references public.form_responses(id) on delete cascade,
  question_id uuid not null references public.form_questions(id),
  patient_id uuid not null references public.patients(id) on delete cascade,
  -- All 5 question types serialise to text (a number for scale, "Yes"/"No",
  -- the chosen option) -- no polymorphic column needed for something this
  -- simple.
  answer_text text,
  unique (form_response_id, question_id)
);

alter table public.forms enable row level security;
alter table public.form_questions enable row level security;
-- Shared clinical content, same trust boundary as blocks/workouts/exercises
-- (0009_content_hierarchy.sql) -- no anon/authenticated policy is created,
-- so both deny all access by default. Owner-only via supabaseAdmin.

alter table public.form_sends enable row level security;
create policy "Patients can read their own sends" on public.form_sends
  for select using (auth.uid() = patient_id);
-- No insert/update/delete policy for patients -- Owner creates sends via supabaseAdmin.

alter table public.form_responses enable row level security;
create policy "Patients can read their own responses" on public.form_responses
  for select using (auth.uid() = patient_id);
create policy "Patients can submit their own responses" on public.form_responses
  for insert with check (auth.uid() = patient_id);
-- No update/delete -- once submitted, a response is a record, not a toggle.

alter table public.form_answers enable row level security;
create policy "Patients can read their own answers" on public.form_answers
  for select using (auth.uid() = patient_id);
create policy "Patients can submit their own answers" on public.form_answers
  for insert with check (auth.uid() = patient_id);
