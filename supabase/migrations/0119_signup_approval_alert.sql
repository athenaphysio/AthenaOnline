-- Anyone can now create their own account from the standard login page as
-- well as a brand's own page; every such account still waits for David's
-- approval. This records when David was emailed about one, so he is told
-- exactly once.
alter table public.patients add column if not exists approval_alert_sent_at timestamptz;
