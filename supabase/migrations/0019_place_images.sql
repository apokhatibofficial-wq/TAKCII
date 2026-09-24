-- Lets an admin attach an image/icon to a place from the admin panel,
-- shown next to it in the rider app's destination search results.
alter table places add column if not exists image_url text;

-- Same shape as 0014's ad-images bucket: admin-authored content shown to
-- every rider, so read is public and write is admin-only.
insert into storage.buckets (id, name, public)
values ('place-images', 'place-images', true)
on conflict (id) do nothing;

create policy "place images are publicly accessible" on storage.objects
  for select using (bucket_id = 'place-images');
create policy "admin manage place images" on storage.objects
  for all using (bucket_id = 'place-images' and is_admin()) with check (bucket_id = 'place-images' and is_admin());
