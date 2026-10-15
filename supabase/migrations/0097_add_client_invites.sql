-- "Add a client": only David can let a client in. invited_at is set when he
-- invites them; password_set_at when they choose their password. A client
-- with no invited_at (everyone who joined before this) counts as Active.
alter table public.patients add column invited_at timestamptz;
alter table public.patients add column password_set_at timestamptz;
alter table public.patients add column clinic_notes text;

insert into public.email_templates (key, name, subject, body, status) values (
  'client_invite',
  'Client invitation',
  'Welcome to Athena',
  E'Hi {{first_name}},\n\nI have set you up on the Athena app, which is where you will find your programme, log your sessions and keep track of how things are going. Click the button below to choose a password and you are in.\n\nIf you have any trouble getting in, just reply to this email and I will sort it out.\n\nDr David Silver PhD',
  'approved'
)
on conflict (key) do nothing;
