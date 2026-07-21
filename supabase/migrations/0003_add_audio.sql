-- Coaching-cue audio (one per exercise, reused across every patient) and
-- personal message audio (one per programme).
alter table public.exercises add column audio_url text;
alter table public.programmes add column audio_url text;

-- Storage bucket for both kinds of recording. Public read (so the patient
-- page can just play a URL, same trade-off already accepted for the rest of
-- this no-login phase) but nothing can write to it except our server-side
-- code using the service_role key, which bypasses storage policies entirely.
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do nothing;

create policy "Public read access for audio"
on storage.objects for select
using (bucket_id = 'audio');
