-- A library session dropped onto a client's calendar becomes that client's
-- own copy, so changes made there never reach the library. The copies
-- belong to the programme (programme_id, as plan cards already do) and
-- remember where they came from (source_*), so a block's "Save as default"
-- can update the library block when David chooses to.
alter table public.blocks add column if not exists programme_id uuid;
alter table public.blocks add column if not exists source_block_id uuid;
alter table public.workouts add column if not exists source_workout_id uuid;
create index if not exists blocks_library_idx on public.blocks (name) where programme_id is null;
