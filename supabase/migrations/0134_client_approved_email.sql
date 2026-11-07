-- The welcome a self sign up client receives when David presses Approve.
-- Until now they were never told their app had opened. Editable like every
-- other template from /clinic/vault/email-templates.
insert into public.email_templates (key, name, subject, body, status) values (
  'client_approved',
  'Client approved (self sign up)',
  'Your {{app_name}} account is ready',
  E'Hi {{first_name}},\n\nThank you for creating your account. I have now confirmed it, so your {{app_name}} app is open and ready for you, with your programme and sessions waiting inside.\n\nUse the button below and log in with the email address and password you chose when you signed up.\n\nIf you have any trouble getting in, just reply to this email and I will sort it out.\n\nDr David Silver PhD',
  'approved'
)
on conflict (key) do nothing;
