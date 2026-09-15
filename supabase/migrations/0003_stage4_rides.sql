-- Stage 4: realtime ride flow.

create policy "riders create own rides" on rides for insert with check (auth.uid() = rider_id);
create policy "riders view own rides" on rides for select using (auth.uid() = rider_id);
create policy "riders update own rides" on rides for update using (auth.uid() = rider_id) with check (auth.uid() = rider_id);
create policy "drivers view assigned rides" on rides for select using (auth.uid() = driver_id);
create policy "drivers update assigned rides" on rides for update using (auth.uid() = driver_id) with check (auth.uid() = driver_id);

-- A rider can only rate their own completed ride, once.
create policy "riders insert rating for own completed ride" on ratings for insert with check (
  auth.uid() = rider_id
  and exists (select 1 from rides where rides.id = ride_id and rides.rider_id = auth.uid() and rides.status = 'done')
);
create policy "riders view own ratings" on ratings for select using (auth.uid() = rider_id);
create policy "drivers view own ratings" on ratings for select using (auth.uid() = driver_id);

-- Riders otherwise can't read the drivers table at all (Stage 2 policy is
-- owner-only) — this opens exactly the slice they need: the driver assigned
-- to a ride they're actually on, and only while that ride is live/completed.
create policy "riders view matched driver" on drivers for select using (
  exists (
    select 1 from rides
    where rides.driver_id = drivers.id
      and rides.rider_id = auth.uid()
      and rides.status in ('toPickup', 'arrived', 'onTrip', 'done')
  )
);

-- Nearest active, online, unassigned driver — haversine-ish via Postgres's
-- built-in point <-> operator (fine at this city scale; swap for PostGIS if
-- the service area ever grows enough for great-circle error to matter).
create or replace function nearest_available_driver(p_lat double precision, p_lng double precision)
returns uuid
language sql
security definer
set search_path = public
as $$
  select d.id from drivers d
  where d.status = 'active' and d.online = true
    and not exists (
      select 1 from rides r where r.driver_id = d.id and r.status in ('toPickup', 'arrived', 'onTrip')
    )
  order by point(d.lng, d.lat) <-> point(p_lng, p_lat)
  limit 1;
$$;
grant execute on function nearest_available_driver(double precision, double precision) to authenticated;

-- Creates the ride and assigns the nearest driver atomically — avoids a
-- request/assign race between two riders reading the same "nearest driver"
-- a client-side match would be vulnerable to.
create or replace function request_ride(
  p_pickup_name text, p_pickup_lat double precision, p_pickup_lng double precision,
  p_dest_name text, p_dest_lat double precision, p_dest_lng double precision,
  p_km double precision, p_minutes double precision, p_fare_amount numeric, p_fare_currency currency_code
) returns rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_ride rides;
begin
  v_driver_id := nearest_available_driver(p_pickup_lat, p_pickup_lng);
  insert into rides (
    rider_id, driver_id, pickup_name, pickup_lat, pickup_lng, dest_name, dest_lat, dest_lng,
    status, km, minutes, fare_amount, fare_currency, matched_at
  ) values (
    auth.uid(), v_driver_id, p_pickup_name, p_pickup_lat, p_pickup_lng, p_dest_name, p_dest_lat, p_dest_lng,
    case when v_driver_id is null then 'searching' else 'toPickup' end,
    p_km, p_minutes, p_fare_amount, p_fare_currency,
    case when v_driver_id is null then null else now() end
  )
  returning * into v_ride;

  if v_driver_id is not null then
    update drivers set accepted_count = accepted_count + 1 where id = v_driver_id;
  end if;
  return v_ride;
end;
$$;
grant execute on function request_ride(
  text, double precision, double precision, text, double precision, double precision,
  double precision, double precision, numeric, currency_code
) to authenticated;

-- Realtime: rides need row-level change events for the rider's live status
-- screen (and the driver's, from Stage 5 on).
alter publication supabase_realtime add table rides;
