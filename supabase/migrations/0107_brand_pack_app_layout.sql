-- What a client sees in the app, set per brand pack: the bottom toolbar
-- and its tabs, the home page items, the sign-off and the team. Stored as
-- one settings object; anything missing falls back to the Athena app as it
-- was (see src/lib/appLayout.ts), so every existing pack is unchanged.
alter table public.brand_packs add column if not exists app_layout jsonb not null default '{}'::jsonb;
