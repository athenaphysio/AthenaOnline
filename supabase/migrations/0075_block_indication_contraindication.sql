-- Structured indication/contraindication fields on blocks, same shape and
-- same column names as exercises.condition_use_case/contraindication_flags
-- (0001_initial_schema.sql), so a block can carry the same "when this is
-- right, when it isn't" reasoning exercises already do. Lives on
-- block_notes rather than blocks itself, alongside notes/ai_draft, since
-- all three are clinician-authored content about a block rather than the
-- block's own defining structure.
alter table public.block_notes add column condition_use_case text;
alter table public.block_notes add column contraindication_flags text;
