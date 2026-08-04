-- Lets a cardio block be marked done the same way an exercise is.
-- exercise_id becomes optional and cardio_block_id is added alongside it,
-- exactly one set per row (mirrors the workout_items three-way pattern from
-- 0036_cardio_blocks.sql, just two-way here since only these two content
-- types can ever appear in a session). A second unique constraint keyed on
-- cardio_block_id gives cardio the same upsert-to-toggle dedup that
-- exercise_id already had -- Postgres never treats two NULLs as equal, so
-- this constraint is silently inert for exercise rows (cardio_block_id is
-- always NULL there) and vice versa, no partial index needed.
alter table public.session_completions add column cardio_block_id uuid references public.cardio_blocks(id);
alter table public.session_completions alter column exercise_id drop not null;

alter table public.session_completions add constraint session_completions_exactly_one_item check (
  (exercise_id is not null) <> (cardio_block_id is not null)
);

alter table public.session_completions add constraint session_completions_cardio_unique
  unique (patient_id, programme_id, cardio_block_id, week_number, day_of_week);
