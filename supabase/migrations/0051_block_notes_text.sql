-- General coaching guidance for a whole block, distinct from the
-- clinician-only ai_draft reasoning already stored on block_notes
-- (0014_clinical_notes_split.sql). Unlike ai_draft, this is written
-- directly by David via the block builder, not generated -- kept in the
-- same table since both are "notes about this block that live outside
-- the coach-readable blocks row".
alter table public.block_notes add column notes text;
