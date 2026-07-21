-- A week can now genuinely change which exercise fills a slot, not just its
-- numbers. exercise_id and rationale move from programme_items (fixed for
-- the whole block) down into programme_item_weeks (one per week). A "flat"
-- slot is just every week repeating the same exercise -- no separate case.
alter table public.programme_item_weeks
  add column exercise_id text references public.exercises(exercise_id),
  add column rationale text,
  add column percent_max integer;

-- Backfill: every existing week row inherits its parent item's exercise and rationale.
update public.programme_item_weeks piw
set exercise_id = pi.exercise_id,
    rationale = pi.rationale
from public.programme_items pi
where pi.id = piw.programme_item_id;

alter table public.programme_item_weeks
  alter column exercise_id set not null;

alter table public.programme_items
  drop column exercise_id,
  drop column rationale;
