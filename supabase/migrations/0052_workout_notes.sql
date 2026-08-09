-- Session-level notes, same reasoning and same isolated-table pattern as
-- block_notes.notes (0051_block_notes_text.sql): workouts already has a
-- coach read policy (0017_coach_template_editing.sql), and RLS is
-- row-level not column-level, so a notes column added directly to
-- workouts would be coach-readable. Kept in its own table instead,
-- service_role only, no coach policy.
create table public.workout_notes (
  workout_id uuid primary key references public.workouts(id) on delete cascade,
  notes text
);

alter table public.workout_notes enable row level security;
