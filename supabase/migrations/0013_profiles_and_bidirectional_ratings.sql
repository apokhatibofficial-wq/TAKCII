-- Split ratings.stars (rider's rating of the driver) so a driver can also
-- rate the rider on the same ride, without breaking the existing
-- unique(ride_id) "one record per ride" shape. Whichever side rates first
-- creates the row; the other side's rate_ride() call fills in their column.
alter table ratings rename column stars to driver_stars;
alter table ratings alter column driver_stars drop not null;
alter table ratings add column rider_stars smallint check (rider_stars between 1 and 5);

drop policy if exists "riders insert rating for own completed ride" on ratings;

-- All rating writes now go through rate_ride() below instead of raw
-- policies -- it needs to pick an insert vs. update-in-place on the shared
-- row depending on who's already rated, which a WITH CHECK expression
-- can't express cleanly. SELECT policies (own ratings, admin) are unchanged.
create or replace function rate_ride(p_ride_id uuid, p_stars smallint)
returns ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride rides;
  v_result ratings;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'stars must be between 1 and 5';
  end if;

  select * into v_ride from rides where id = p_ride_id;
  if v_ride is null then
    raise exception 'ride not found';
  end if;
  if v_ride.status <> 'done' then
    raise exception 'ride is not completed yet';
  end if;

  if auth.uid() = v_ride.rider_id then
    insert into ratings (ride_id, driver_id, rider_id, driver_stars)
    values (p_ride_id, v_ride.driver_id, v_ride.rider_id, p_stars)
    on conflict (ride_id) do update set driver_stars = excluded.driver_stars
    returning * into v_result;
  elsif auth.uid() = v_ride.driver_id then
    insert into ratings (ride_id, driver_id, rider_id, rider_stars)
    values (p_ride_id, v_ride.driver_id, v_ride.rider_id, p_stars)
    on conflict (ride_id) do update set rider_stars = excluded.rider_stars
    returning * into v_result;
  else
    raise exception 'not authorized to rate this ride';
  end if;

  return v_result;
end;
$$;
grant execute on function rate_ride(uuid, smallint) to authenticated;

-- Riders get a real profile screen now (name + photo), so they need a
-- self-update path back -- migration 0010 dropped it entirely because
-- nothing legitimate needed it yet. Mirrors drivers' own pattern exactly:
-- row-scoped RLS plus a column-scoped trigger blocking self-reactivation.
create or replace function riders_restrict_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() and new.status is distinct from old.status then
    raise exception 'only an admin can change a rider''s status';
  end if;
  return new;
end;
$$;
drop trigger if exists riders_restrict_privileged_columns_trigger on riders;
create trigger riders_restrict_privileged_columns_trigger
before update on riders
for each row execute function riders_restrict_privileged_columns();

create policy "riders update own row" on riders for update using (auth.uid() = id) with check (auth.uid() = id);

-- Public avatar storage. Public read (avatars are meant to be visible to
-- whoever the app shows them to -- the other party on a ride, admin, etc.)
-- with per-user write access scoped by the uploaded path's first segment
-- ({auth.uid()}/...), which every app's upload call controls directly.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "users upload their own avatar" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update their own avatar" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own avatar" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
