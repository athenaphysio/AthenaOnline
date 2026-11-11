-- Diary planner, Phase 1. An executive client's sessions are placed into
-- real slots in their week, by the client or by their PA through a private
-- planner link, and each placed slot appears in an "Athena Training"
-- calendar inside the client's own Google account.
--
-- Every table here is service role only (RLS on, no policies): the client
-- pages and the PA planner both read and write through server routes that
-- check who is asking first. Google tokens never leave the server.

-- Off by default. David switches it on for the clients it suits.
alter table public.patients add column if not exists diary_planner_enabled boolean not null default false;

-- One placed session. Keyed on the programme_workouts row plus the week,
-- because the same workout can appear more than once in a week and a row
-- with no week_number repeats every week.
create table public.diary_slots (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  programme_workout_id uuid not null references public.programme_workouts(id) on delete cascade,
  week_number smallint not null check (week_number >= 1),
  starts_at timestamptz not null,
  duration_minutes smallint not null check (duration_minutes in (20, 30, 45, 60, 90)),
  location text not null default 'home' check (location in ('home', 'office', 'gym', 'hotel', 'travel')),
  placed_by text not null check (placed_by in ('client', 'pa', 'clinic')),
  google_event_id text,
  google_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (programme_workout_id, week_number)
);

create index diary_slots_patient_idx on public.diary_slots (patient_id, starts_at);
alter table public.diary_slots enable row level security;

-- The private link a client gives their PA. Anyone holding the token can
-- place sessions for that one client and see nothing else: no clinical
-- detail, no intake answers, no messages. The client records their consent
-- by creating it, and either the client or David can revoke it.
create table public.diary_planner_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  token text not null unique,
  pa_name text not null,
  consent_given_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index diary_planner_links_patient_idx on public.diary_planner_links (patient_id);
alter table public.diary_planner_links enable row level security;

-- The client's link to their own Google Calendar. The app can only see and
-- change the one calendar it creates ("Athena Training"), never the rest of
-- their diary.
create table public.google_calendar_connections (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  google_email text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  calendar_id text,
  connected_at timestamptz not null default now(),
  last_error text
);

alter table public.google_calendar_connections enable row level security;

create table public.google_oauth_states (
  state text primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.google_oauth_states enable row level security;

-- What equipment the client has at each place they train, set by David.
-- Used only to point out exercises that need something not available in
-- a slot's location. An empty list means "not set", and nothing is flagged.
create table public.diary_location_equipment (
  patient_id uuid not null references public.patients(id) on delete cascade,
  location text not null check (location in ('home', 'office', 'gym', 'hotel', 'travel')),
  equipment_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (patient_id, location)
);

alter table public.diary_location_equipment enable row level security;
