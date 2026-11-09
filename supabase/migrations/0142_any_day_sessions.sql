-- Sessions the client does on any day of a week: a programme_workouts row
-- with week_number set and day_of_week null in a scheduled programme
-- (day_of_week was already allowed to be null for Open programmes). A
-- completion records the day it actually happened, plus the session it
-- belongs to, so the weekly view can tick the session off whichever day it
-- was done.

alter table public.session_completions add column if not exists workout_id uuid references public.workouts(id) on delete set null;
create index if not exists session_completions_workout_idx on public.session_completions (programme_id, workout_id, week_number);
