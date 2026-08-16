-- Phase 2 of the email-audit brief: one real, editable entry per
-- automated email the platform can send, so changing wording is a form
-- on /clinic/content/email-templates, never a code change.
--
-- key is the stable identifier email.ts looks up by (matches each
-- send function's own name/type, e.g. "programme_ready"). subject/body
-- are plain text, not HTML -- the surrounding layout (button, colours,
-- logo) stays fixed in code; only the words are editable here.
-- {{double_brace}} placeholders mark the dynamic parts.
--
-- status gates whether a send function is allowed to actually send at
-- all -- see getEmailTemplate/isTemplateApproved in
-- src/lib/emailTemplates.ts. This is also Phase 1's kill switch: the
-- three access_window_* rows below seed as 'pending_review' so fixing
-- the CRON_SECRET auth gap does not also let three never-reviewed
-- emails start firing the moment cron auth works again. The other five
-- are seeded 'approved' since they're already live in production today;
-- this migration only formalises tracking for them, it doesn't
-- silently switch off something that already works.
create table public.email_templates (
  key text primary key,
  name text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved')),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.email_templates enable row level security;
-- No policy for anon or authenticated -- clinic-only content, same
-- service-role-only model as every other clinic table.

insert into public.email_templates (key, name, subject, body, status) values
(
  'programme_ready',
  'Programme ready',
  E'Your programme''s ready',
  E'Hi {{first_name}},\n\nDavid''s built your programme and it''s live now. Open the app to get started.',
  'approved'
),
(
  'membership_ready',
  'Membership set up',
  E'You''re set up',
  E'Hi {{first_name}},\n\nYour {{tier_name}} membership is active. Open the app to see what''s included.',
  'approved'
),
(
  'programme_owned',
  'Programme bought outright',
  E'Yours to keep',
  E'Hi {{first_name}},\n\n{{programme_title}} is yours now, for good. No expiry, no subscription attached to it. Open the app whenever you want it.',
  'approved'
),
(
  'new_message_alert',
  'New message alert (to David)',
  E'New message from {{patient_name}}',
  E'"{{message_preview}}"',
  'approved'
),
(
  'new_registration_alert',
  'New registration alert (to David)',
  E'New registration from {{patient_name}}',
  E'{{patient_name}} has completed a registration form, waiting for you to review.',
  'approved'
),
(
  'access_window_warning',
  'Programme closing, 7 day warning',
  E'Your programme access ends in a week',
  E'Your programme''s access window closes in 7 days. Choose a plan to keep your exercises and session plan running without a break.',
  'pending_review'
),
(
  'access_window_closed',
  'Programme closing, day of closure',
  E'Your programme has ended',
  E'Your programme''s access window has closed. Your exercises and session plan are paused until you choose a plan to continue.',
  'pending_review'
),
(
  'access_window_followup',
  'Programme closing, follow-up nudge',
  E'Your programme is still here when you''re ready',
  E'Your programme access closed a few days ago. Your exercises and session plan are exactly as you left them, whenever you choose a plan to continue.',
  'pending_review'
);
