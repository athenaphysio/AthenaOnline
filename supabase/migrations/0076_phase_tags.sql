-- Structured "applicable programme phase" tag, using the three-stage
-- vocabulary already established by the clinical model (Awareness,
-- Communication, Creativity -- see the Project Brief). Same shape and same
-- trust boundary as equipment (0054_exercise_equipment.sql): a small
-- lookup table David can extend over time via its own management page,
-- seeded here with only the three canonical stage names, not a fixed
-- closed enum.
create table public.phase_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.phase_tags enable row level security;
create policy "Public read access" on public.phase_tags for select using (true);

insert into public.phase_tags (name) values ('Awareness'), ('Communication'), ('Creativity');

-- One phase per exercise or block, not a tag set -- a movement is primarily
-- Awareness work or primarily Communication work, in the same way a block
-- is one type and not several. Nullable: most existing content predates
-- this and stays unclassified until David reviews it.
alter table public.exercises add column phase_id uuid references public.phase_tags(id) on delete set null;
alter table public.blocks add column phase_id uuid references public.phase_tags(id) on delete set null;
