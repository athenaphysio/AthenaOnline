-- The core one-free-message pipe (see claude_code_instructions_intake_and_
-- messaging.md, Feature 2), confirmed unbuilt by this session's own audit --
-- only decorative copy existed before this, no table, no counter, no send
-- path at all.
--
-- The free-message counter lives directly on programmes, exactly as the
-- spec describes it ("tied to that programme -- does not refresh monthly;
-- a new programme resets it") -- same pattern as every other per-programme
-- flag already on this table (access_paused_at, completion_audio_url).
-- Null means not used yet.
alter table public.programmes add column free_message_used_at timestamptz;

-- The actual two-way thread. Tied to a specific programme (matching the
-- counter's own scoping and where the composer lives, inside that
-- programme's session view) -- the clinic-side inbox aggregates across a
-- patient's every programme for the full picture, this table doesn't need
-- to.
--
-- Deliberately no row here for a gated (blocked) attempt -- the spec is
-- explicit that a blocked message never reaches David and he should do
-- nothing about it; logging it as a real message would put it back in
-- front of him by the back door. A gate event that's worth surfacing in
-- aggregate (Phase 3's "hit free-message limit this week" signal) is
-- logged into communications instead, the existing audit-trail table for
-- exactly this kind of "something happened for this patient, Owner-facing
-- only" record.
create table public.patient_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  sender text not null check (sender in ('patient', 'clinician')),
  body text not null,
  created_at timestamptz not null default now(),
  -- Only ever meaningful for sender = 'patient' -- whether David has seen
  -- it yet, for the inbox's unread count. A clinician's own reply has
  -- nothing to be "read" by David; the patient side has no read-tracking
  -- at all yet, not asked for.
  read_at timestamptz
);

alter table public.patient_messages enable row level security;

-- A patient can read their own thread. No patient insert policy --
-- sending goes through /api/session/messages, which runs the gate/counter/
-- membership check server-side via the service_role key before writing;
-- letting a patient insert directly would mean trusting the client to
-- honour a limit it has every incentive to ignore.
create policy "Patients can read their own messages" on public.patient_messages
  for select using (auth.uid() = patient_id);
