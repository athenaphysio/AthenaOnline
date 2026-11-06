-- Programme intake forms filled in from a link (/intake, or straight after
-- registering), without the client being logged in to the app.
--
-- Each submission is matched to a client by email. If the client is already
-- in the app, the answers are filed into their record at once (a form send,
-- response and answers, and a Client profile entry), exactly as if they had
-- filled it in inside the app. If not, the submission is held here and filed
-- automatically when Dr David Silver PhD confirms their registration or adds
-- them as a client.

create table public.link_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  brand_pack_id uuid references public.brand_packs(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  -- [{ question_id, prompt, question_order, answer }]
  answers jsonb not null,
  after_registration boolean not null default false,
  patient_id uuid references public.patients(id) on delete set null,
  form_response_id uuid references public.form_responses(id) on delete set null,
  filed_at timestamptz
);

create index link_intake_submissions_email_idx on public.link_intake_submissions (lower(email));

-- Server only: read and written through the service role, never by a
-- client's own login.
alter table public.link_intake_submissions enable row level security;
