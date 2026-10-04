-- Days (1 = Monday .. 7 = Sunday) David has deliberately marked as rest days
-- in the programme builder. Absence of a session on a day still means rest
-- for the client; this only records that the rest was a choice.
alter table public.programmes add column rest_days smallint[] not null default '{}';
