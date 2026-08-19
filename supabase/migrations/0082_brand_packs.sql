-- Brand packs: a named set of six image components plus two colours that
-- everywhere in the app can pull branding from instead of the fixed
-- Athena crimson/cream default. One row is always the fallback
-- (is_default = true) -- the app must never be able to end up with no
-- pack to fall back to, so that row is seeded here and the builder portal
-- refuses to let it be deleted, renamed off default, or unset.
--
-- Every image column is nullable: a pack can be saved with just a name
-- and two colours, filled in over time. No generic "brand_pack_components"
-- child table -- six fixed, named slots is simpler than a key/value table
-- for a fixed, small set of roles that will never grow arbitrarily.
create table public.brand_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  accent_color text not null,
  background_color text not null,
  logo_mark_url text,
  wordmark_url text,
  cover_square_url text,
  wide_banner_url text,
  small_square_url text,
  background_texture_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforced in Postgres, not just in the builder UI -- a second is_default
-- row would silently break "the app always has a fallback" the moment
-- someone bypasses the app (a script, a manual SQL edit).
create unique index brand_packs_one_default_idx on public.brand_packs (is_default) where is_default;

-- Direct nullable columns on the two things a pack can be assigned to,
-- rather than a generic polymorphic "brand_pack_assignments" table --
-- there are exactly two assignable kinds, both fixed, so a join table
-- buys nothing but an extra query everywhere Feature 2's lookup runs.
-- on delete set null: deleting a pack un-assigns it everywhere rather
-- than blocking the delete or cascading into deleted programmes/patients.
alter table public.programmes add column brand_pack_id uuid references public.brand_packs(id) on delete set null;
alter table public.patients add column brand_pack_id uuid references public.brand_packs(id) on delete set null;

-- Same lockdown as every other clinic-only table (blocks, workouts,
-- equipment): no anon/authenticated policy at all, service_role only.
alter table public.brand_packs enable row level security;

-- The permanent fallback pack -- David's own crimson/cream scheme,
-- confirmed as the default in the component spec. Placeholder images
-- reuse what already exists in the app (public/icons) rather than the
-- literal Fitter-era filenames named in earlier drafts, which don't
-- exist anywhere in this project; David can replace them with the real
-- spec-sized assets through the builder portal at any time -- this row
-- only needs to exist, not be complete.
insert into public.brand_packs (name, is_default, accent_color, background_color, logo_mark_url, cover_square_url, small_square_url)
values (
  'Athena Physio (default)',
  true,
  '#B83A60',
  '#EFEAE6',
  'https://lmqzuijbnlcfeogqbdqj.supabase.co/storage/v1/object/public/images/brand-packs/seed/athena-mark.png',
  'https://lmqzuijbnlcfeogqbdqj.supabase.co/storage/v1/object/public/images/brand-packs/seed/athena-cover.png',
  'https://lmqzuijbnlcfeogqbdqj.supabase.co/storage/v1/object/public/images/brand-packs/seed/athena-small.png'
);
