-- An optional headshot of the client, shown at the centre of Client
-- background. The client can add one on the registration form (it is never
-- required), and the clinic can add or change it on the client's record.
-- Photos are resized in the browser before upload, which also drops any
-- location data held in the original file.

alter table public.registrations add column photo_path text;
alter table public.patients add column photo_path text;

insert into storage.buckets (id, name, public)
values ('client-photos', 'client-photos', false)
on conflict (id) do nothing;
