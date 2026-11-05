-- Strength is built automatically for every client unless David switches it
-- off on their record. When a cardio plan opens in the builder, the app reads
-- the client's intake form and consultation notes and, if strength has come
-- up anywhere, fills the plan's strength slots from David's own library.
alter table public.patients add column if not exists auto_strength boolean not null default true;
