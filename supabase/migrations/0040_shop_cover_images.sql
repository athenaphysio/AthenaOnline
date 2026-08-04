-- Lets a real photo replace the placeholder graphic on a shop programme's
-- card and detail page. Mirrors 0003_add_audio.sql exactly: public read (so
-- the shop pages can just play an <Image src>), nothing can write to it
-- except our server-side code using the service_role key, which bypasses
-- storage policies entirely.
alter table public.programme_templates add column cover_image_url text;

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

create policy "Public read access for images"
on storage.objects for select
using (bucket_id = 'images');
