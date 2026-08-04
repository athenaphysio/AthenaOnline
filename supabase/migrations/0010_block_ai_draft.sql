-- Blocks need to keep the original AI draft reference alongside the
-- editable content, same as programmes did.
alter table public.blocks
  add column ai_draft jsonb,
  add column ai_draft_created_at timestamptz;
