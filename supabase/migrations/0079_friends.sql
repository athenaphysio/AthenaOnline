-- "Meet David and Friends" -- a new content type David manages himself, no
-- code change needed to add, edit, reorder or remove someone, same pattern
-- as equipment. Not tied into exercises/tags the way equipment is, so no
-- usage tracking is needed before a delete.
create table public.friends (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  job_title text,
  photo_url text,
  bio_text text,
  weblink text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.friends enable row level security;

-- Same trust boundary as equipment: public read (the patient-facing /about
-- page reads this with the anon key), writes only via the service-role key
-- used throughout /clinic.
create policy "Public read access" on public.friends for select using (true);
