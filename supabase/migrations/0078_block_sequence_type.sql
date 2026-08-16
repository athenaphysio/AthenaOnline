-- How the exercises inside a block are actually meant to be performed --
-- sets and reps alone don't capture David's own sequencing patterns (e.g.
-- doing every exercise on one limb before switching sides). One value per
-- block, not per exercise, since the badge shown to a patient is
-- block-level ("at the top of that block" per the brief) and every example
-- given (superset, circuit, unilateral, alternating) is a whole-block
-- performance pattern, not a per-exercise one.
alter table public.blocks
  add column sequence_type text not null default 'straight_sets'
  check (sequence_type in ('straight_sets', 'superset', 'circuit', 'unilateral', 'alternating'));
