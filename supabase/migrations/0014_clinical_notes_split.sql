-- Row Level Security is row-level, not column-level. blocks.ai_draft (the
-- AI-draft description/assumptions/confirmations -- genuinely clinician-only)
-- sits on the same rows a coach otherwise needs to read to see workout
-- content. Rather than trying to hide two columns inside an otherwise-open
-- table, move them out entirely into a table that gets no coach policy at
-- all, so there's no column left to leak.

create table public.block_notes (
  block_id uuid primary key references public.blocks(id) on delete cascade,
  ai_draft jsonb,
  ai_draft_created_at timestamptz
);

insert into public.block_notes (block_id, ai_draft, ai_draft_created_at)
select id, ai_draft, ai_draft_created_at
from public.blocks
where ai_draft is not null;

alter table public.blocks
  drop column ai_draft,
  drop column ai_draft_created_at;

-- programmes.ai_draft/ai_draft_created_at are confirmed dead in current
-- practice (ProgrammeBuilder.tsx never sends them -- the AI-draft flow now
-- feeds Block creation, not Programme creation directly). No data to
-- preserve, so dropped outright rather than given a sibling table.
alter table public.programmes
  drop column ai_draft,
  drop column ai_draft_created_at;

-- Service_role only, same model as blocks/workouts.
alter table public.block_notes enable row level security;
