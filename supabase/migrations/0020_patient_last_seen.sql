-- The only uniform, delivery-mode-agnostic activity signal available.
-- session_completions only ever fires for Scheduled programmes (Open
-- routines deliberately have no "done" concept), so it can't tell David
-- when an Open-only patient last opened the app. This is touched once per
-- /session load (src/app/session/page.tsx), server-side, in a context that
-- has already proven ownership of the row being updated.
alter table public.patients add column last_seen_at timestamptz;
