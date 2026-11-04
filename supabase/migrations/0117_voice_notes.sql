-- Voice notes: after any practice, in any programme, a client can tap one
-- button and tell Dr David Silver PhD how it went. The audio is sent
-- straight to speech to text and never stored; only the transcript is
-- kept, tied to the programme, week, day and session it is about.
-- Switched on per client from their record, off by default.

alter table public.patients add column voice_notes_enabled boolean not null default false;

create table public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete set null,
  workout_id uuid,
  week_number integer,
  day_of_week smallint check (day_of_week is null or day_of_week between 1 and 7),
  -- What the client was looking at when they recorded it, e.g. the card or
  -- session title, so the note reads sensibly even if the session is
  -- later renamed or removed.
  context_title text,
  transcript text not null,
  duration_seconds integer,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index voice_notes_patient_created on public.voice_notes (patient_id, created_at desc);

alter table public.voice_notes enable row level security;

create policy "Clients can read their own voice notes" on public.voice_notes
  for select using (auth.uid() = patient_id);
