-- Roam Messenger: a messaging-only app for the ROAM care team, saved to a
-- clinician's phone home screen. It reads the same client conversations as
-- the clinic (patient_messages), adds a care team channel, locks behind
-- Face ID (a passkey on the phone) and sends notifications that never
-- carry any message content.
--
-- Everything here is reached only through the server with the service
-- key, so row level security is on with no policies, as elsewhere.
--
-- A messenger user is either David (the clinic owner login) or a
-- clinician on the staff table. user_key is 'owner' or 'staff:<uuid>'.

-- Face ID / fingerprint: one row per passkey a user has set up on a phone.
create table public.roam_messenger_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index roam_messenger_passkeys_user_idx on public.roam_messenger_passkeys (user_key);
alter table public.roam_messenger_passkeys enable row level security;

-- Phone notification subscriptions, one per phone per user.
create table public.roam_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index roam_push_subscriptions_user_idx on public.roam_push_subscriptions (user_key);
alter table public.roam_push_subscriptions enable row level security;

-- Care team messages. Never visible to clients. patient_id set means the
-- message is about that client and sits beside their conversation, seen
-- only by team members who may see that client; null means the general
-- team channel.
create table public.roam_team_messages (
  id uuid primary key default gen_random_uuid(),
  author_key text not null,
  author_name text not null,
  patient_id uuid references public.patients(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index roam_team_messages_patient_idx on public.roam_team_messages (patient_id, created_at);
alter table public.roam_team_messages enable row level security;

-- When each user last looked at each team thread, for unread counts.
-- thread_key is 'team' for the general channel or 'team:<patient uuid>'.
create table public.roam_messenger_reads (
  user_key text not null,
  thread_key text not null,
  last_read_at timestamptz not null default now(),
  primary key (user_key, thread_key)
);
alter table public.roam_messenger_reads enable row level security;

-- The keys the server uses to sign phone notifications (VAPID), created
-- by the app the first time it needs them. One row only.
create table public.roam_messenger_config (
  id boolean primary key default true check (id),
  vapid_public_key text not null,
  vapid_private_key text not null,
  created_at timestamptz not null default now()
);
alter table public.roam_messenger_config enable row level security;

-- Who on the team sent a reply to a client, now that more than David can.
alter table public.patient_messages add column if not exists sent_by_key text;
alter table public.patient_messages add column if not exists sent_by_name text;

-- The email David gets for a new ROAM client message. Deliberately carries
-- no name and no message content.
insert into public.email_templates (key, name, subject, body, status)
values (
  'roam_message_alert',
  'Roam Messenger alert (to the care team)',
  E'New client message in Roam Messenger',
  E'A ROAM client has sent a new message. For privacy, nothing from the message is included in this email.\n\nOpen Roam Messenger to read it and reply.',
  'approved'
)
on conflict (key) do nothing;
