-- Multi-image ads (swipeable carousel client-side) plus basic ad analytics.
-- image_url (base64 data-URLs from the admin's FileReader picker) becomes
-- image_urls, an ordered array of real Storage URLs -- both because one ad
-- now needs several images and because inlining base64 in a column that's
-- read on every rider/driver session start doesn't scale past one image.
alter table ads add column image_urls text[] not null default '{}';
update ads set image_urls = array[image_url] where image_url is not null;
alter table ads drop column image_url;

alter table ads add column impressions_count integer not null default 0;
alter table ads add column link_clicks_count integer not null default 0;

-- Riders/drivers only ever had SELECT on ads (see 0005) -- these let an
-- authenticated session bump a counter without a direct UPDATE grant, which
-- would otherwise also let it rewrite title/body/button_url/etc.
-- This project's default privileges grant EXECUTE on every new public-schema
-- function directly to anon (not through PUBLIC -- REVOKE ... FROM PUBLIC is
-- a no-op against that), which would let an unauthenticated anon-key caller
-- bump these too. Revoke from anon by name so only a signed-in session can.
create or replace function track_ad_impression(p_ad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ads set impressions_count = impressions_count + 1 where id = p_ad_id;
end;
$$;
revoke execute on function track_ad_impression(uuid) from anon;
grant execute on function track_ad_impression(uuid) to authenticated;

create or replace function track_ad_link_click(p_ad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ads set link_clicks_count = link_clicks_count + 1 where id = p_ad_id;
end;
$$;
revoke execute on function track_ad_link_click(uuid) from anon;
grant execute on function track_ad_link_click(uuid) to authenticated;

-- Ad images are admin-authored content shown to every rider/driver, so
-- read is public and write is admin-only -- same shape as the avatars
-- bucket in 0013, minus the per-user path scoping (nothing here is
-- per-user).
insert into storage.buckets (id, name, public)
values ('ad-images', 'ad-images', true)
on conflict (id) do nothing;

create policy "ad images are publicly accessible" on storage.objects
  for select using (bucket_id = 'ad-images');
create policy "admin manage ad images" on storage.objects
  for all using (bucket_id = 'ad-images' and is_admin()) with check (bucket_id = 'ad-images' and is_admin());
