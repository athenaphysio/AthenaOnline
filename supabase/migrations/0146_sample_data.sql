-- Sample data: example entries put into a real client's account so they
-- can see how the app looks before they have used it. Everything sample
-- hangs off a programme marked is_sample (its sessions, completions,
-- session logs, strength logs and diary slots all delete with it), plus
-- voice notes, which only lose their programme link when it goes, so they
-- carry the mark too. The clinic's "Remove sample data" button deletes
-- exactly these rows and nothing the client entered themselves.

alter table public.programmes add column if not exists is_sample boolean not null default false;
alter table public.voice_notes add column if not exists is_sample boolean not null default false;
