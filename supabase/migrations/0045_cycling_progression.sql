-- Cycling Progression: the same structure as Running Progression (interval
-- sessions organised into the same three starting-capacity tiers, holding
-- a stage for several sessions before advancing rather than a fixed
-- formula) applied to cycling instead of running. Cycling is
-- non-weight-bearing, so its volume can generally progress a little more
-- liberally than running's, but that's a content decision for whoever
-- builds the actual sessions, not a schema one -- this migration only adds
-- the category itself. Left empty for now, same as Recreational and
-- Trained under Running Progression.
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
  check (category in ('general', 'return_to_run', 'running_progression', 'cycling_progression'));
