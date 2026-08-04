-- Distinguishes generic reusable cardio blocks from a genuine rehab series
-- (Return to Run) that carries extra safety content the other kind doesn't:
-- entry_criteria is a clinician-facing reminder shown before a block is
-- added to a patient's programme (a prompt for David to confirm, never a
-- hard gate the app enforces); stop_rule is shown to the patient alongside
-- the block itself, not just kept in David's own notes.
alter table public.cardio_blocks add column category text not null default 'general'
  check (category in ('general', 'return_to_run'));
alter table public.cardio_blocks add column entry_criteria text;
alter table public.cardio_blocks add column stop_rule text;

-- 'any' is a genuine, storable default -- a template that's deliberately
-- modality-agnostic until a clinician picks one for a specific patient,
-- not merely "unset". Found and dropped by its actual definition rather
-- than a guessed name, same technique as 0036_cardio_blocks.sql's workout_items
-- constraint swap.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.cardio_blocks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%modality%running%'
  loop
    execute format('alter table public.cardio_blocks drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.cardio_blocks add constraint cardio_blocks_modality_check
  check (modality in ('running', 'cycling', 'ski_erg', 'row_erg', 'cross_trainer', 'any', 'other'));

-- Lets a clinician change modality freely for one specific drop (e.g. this
-- patient does the "Easy Recovery" template on a bike, not a run) without
-- touching the shared template's own default modality, which stays intact
-- for the next patient it's dropped onto.
alter table public.workout_items add column cardio_modality_override text;
alter table public.workout_items add column cardio_modality_other_override text;
