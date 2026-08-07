-- Running Progression: general running-capacity building for someone who
-- can already run some amount, distinct from Return to Run (post-injury
-- rehab). Organised by starting capacity into three tiers -- tier only
-- means anything when category is 'running_progression', same looseness as
-- entry_criteria/stop_rule only meaning anything for 'return_to_run'.
-- coaching_note carries a standing coaching cue repeated across every block
-- in the category (e.g. the cadence cue), shown to the patient alongside
-- the block itself.
--
-- Also splits "running" into treadmill vs outdoor as genuine, separate
-- modality choices -- treadmill gives pace control and is the safer
-- starting point, outdoor uses perceived effort once someone's progressed.
-- Plain "running" is left in place for existing rows (Return to Run) that
-- don't carry that distinction.

-- Category check, found and dropped by its actual definition rather than a
-- guessed name, same technique as 0038_cardio_categories.sql.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.cardio_blocks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%general%return_to_run%'
  loop
    execute format('alter table public.cardio_blocks drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.cardio_blocks add constraint cardio_blocks_category_check
  check (category in ('general', 'return_to_run', 'running_progression'));

-- Modality check, same technique.
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
  check (modality in ('running', 'treadmill', 'outdoor_run', 'cycling', 'ski_erg', 'row_erg', 'cross_trainer', 'any', 'other'));

alter table public.cardio_blocks add column tier text
  check (tier in ('base_building', 'recreational', 'trained'));
alter table public.cardio_blocks add column coaching_note text;
