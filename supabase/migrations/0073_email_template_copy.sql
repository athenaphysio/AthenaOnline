-- Loads David's real drafted copy in as the starting text for the five
-- emails that only had placeholder wording, and pulls the three already
-- written in code in verbatim (see the email-audit brief). All five new
-- drafts stay on pending_review -- this is starting text for David to
-- read and adjust, not pre-approved just because it's written out.
--
-- programme_ready (#6) is the one confirmed actually delivering to real
-- patients today, so it stays approved as-is. membership_ready (#7) and
-- programme_owned (#8) haven't been confirmed delivered -- their wording
-- isn't changing, but they move to pending_review so David's eyes land
-- on them too.
--
-- Four of David's five drafts used an em dash (five instances in total,
-- two in the first draft alone); house style (CLAUDE.md) never uses one
-- anywhere, so each spot is rephrased with a comma, colon or full stop
-- instead, wording otherwise unchanged from the draft.
-- Three new placeholders appear that the code didn't previously pass
-- through -- {{inbox_link}}, {{end_date}}, {{sessions_completed}},
-- {{submitted_at}}, {{email}}, {{phone}} -- src/lib/email.ts and the
-- access-window cron route were extended to supply all of them.

update public.email_templates set
  subject = E'New message from {{patient_name}} on Athena Online',
  body = E'{{patient_name}} has sent you a new message on Athena Online.\n\nMessage preview: "{{message_preview}}"\n\nReply here: {{inbox_link}}\n\nThis is an automatic notification. You won''t be able to reply to this email directly.',
  updated_at = now()
where key = 'new_message_alert';

update public.email_templates set
  subject = E'New registration waiting for review: {{patient_name}}',
  body = E'{{patient_name}} has just submitted a registration form for Athena Physio Cobham.\n\nSubmitted: {{submitted_at}}\nContact: {{email}} / {{phone}}\n\nReview and confirm their patient record here: {{review_link}}\n\nThis is an automatic notification.',
  updated_at = now()
where key = 'new_registration_alert';

update public.email_templates set
  subject = E'Your Athena programme access ends in 7 days',
  body = E'Hi {{patient_first_name}},\n\nJust a heads up, your current programme access is due to end on {{end_date}}, in 7 days'' time.\n\nYou''ve completed {{sessions_completed}} sessions so far. To keep your exercises, session plan, and progress, take a look at the membership options below.\n\n{{tier_link}}\n\nThis is an automatic notification from Athena Online.',
  updated_at = now()
where key = 'access_window_warning';

update public.email_templates set
  subject = E'Your Athena programme access has ended',
  body = E'Hi {{patient_first_name}},\n\nYour programme access has now ended. Your exercises and session plan are paused, but nothing is lost: you completed {{sessions_completed}} sessions, and picking a membership tier picks up exactly where you left off.\n\n{{tier_link}}\n\nYou can still use Free Resources and Explore in the meantime.\n\nThis is an automatic notification from Athena Online.',
  updated_at = now()
where key = 'access_window_closed';

update public.email_templates set
  subject = E'Still want to continue your programme?',
  body = E'Hi {{patient_first_name}},\n\nJust checking in, your programme access closed a few days ago, and your exercises are still waiting for you whenever you''re ready to continue.\n\n{{tier_link}}\n\nNo pressure at all, this is just a one-off reminder, we won''t keep emailing about this.\n\nThis is an automatic notification from Athena Online.',
  updated_at = now()
where key = 'access_window_followup';

update public.email_templates set
  subject = E'Your programme''s ready',
  body = E'You''re all set, {{first_name}}.\n\nDavid''s built your programme, it''s live now. Open the app to get started.',
  updated_at = now()
where key = 'programme_ready';

update public.email_templates set
  subject = E'You''re set up',
  body = E'You''re set up, {{first_name}}.\n\nYour {{tier_name}} membership is active. Open the app to see what''s included.',
  status = 'pending_review',
  updated_at = now()
where key = 'membership_ready';

update public.email_templates set
  subject = E'Yours to keep',
  body = E'Yours to keep, {{first_name}}.\n\n{{programme_title}} is yours now, for good. No expiry, no subscription attached to it. Open the app whenever you want it.',
  status = 'pending_review',
  updated_at = now()
where key = 'programme_owned';
