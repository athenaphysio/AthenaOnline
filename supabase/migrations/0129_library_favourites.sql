-- Dr David Silver PhD's starred library items: the exercises, blocks,
-- workouts and programmes he uses most. One row per starred item, read by
-- every library list and builder picker so favourites sit at the top and
-- can be shown on their own. The clinic has a single login, so there is no
-- owner column; the app reads and writes this with the service role only.

create table public.library_favourites (
  item_type text not null check (item_type in ('exercise', 'block', 'cardio_block', 'workout', 'programme', 'cardio_programme')),
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (item_type, item_id)
);

alter table public.library_favourites enable row level security;
