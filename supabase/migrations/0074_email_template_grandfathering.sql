-- Phase 3/4 of the email-audit brief. status alone can't tell "brand
-- new, never confirmed working, must be blocked until approved" apart
-- from "already live in production today, just now getting a real
-- review" -- both need to show as pending_review to David, but only
-- one of them should actually stop sending. grandfathered is that
-- distinction: true means this template was migrated in from
-- already-working code, so pending_review does not block it (Phase 3 --
-- "keep it sending exactly as it does today"). false (the default) is
-- the real hard gate (Phase 4) -- a pending template with
-- grandfathered = false genuinely cannot send to a patient no matter
-- what triggers it, until David flips it to approved.
--
-- See isTemplateSendable in src/lib/emailTemplates.ts, the one place
-- this column is ever read.
alter table public.email_templates add column grandfathered boolean not null default false;

-- The five already-live emails (everything except the three
-- access-window ones, which stay freshly pending_review with
-- grandfathered = false, genuinely gated). Text is untouched here --
-- rows 1/3 already carry David's own fresh drafts from the previous
-- pass, rows 6/7/8 already carry the verbatim original code wording --
-- this migration only changes status and grandfathered, nothing about
-- the words.
update public.email_templates
set status = 'pending_review', grandfathered = true
where key in ('new_message_alert', 'new_registration_alert', 'programme_ready', 'membership_ready', 'programme_owned');
