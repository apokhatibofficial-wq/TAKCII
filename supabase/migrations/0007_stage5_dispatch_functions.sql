-- Functions using the new 'dispatched' status — must run after 0006 commits it.

create or replace function nearest_available_driver(p_lat double precision, p_lng double precision, p_exclude uuid[] default '{}')
returns uuid
language sql
security definer
set search_path = public
as $$
  select d.id from drivers d
  where d.status = 'active' and d.online = true
    and not (d.id = any(p_exclude))
    and not exists (
      select 1 from rides r where r.driver_id = d.id and r.status in ('dispatched', 'toPickup', 'arrived', 'onTrip')
    )
  order by point(d.lng, d.lat) <-> point(p_lng, p_lat)
  limit 1;
$$;
grant execute on function nearest_available_driver(double precision, double precision, uuid[]) to authenticated;

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
    status, km, minutes, fare_amount, fare_currency, dispatched_at
  ) values (
    auth.uid(), v_driver_id, p_pickup_name, p_pickup_lat, p_pickup_lng, p_dest_name, p_dest_lat, p_dest_lng,
    (case when v_driver_id is null then 'searching' else 'dispatched' end)::ride_status,
    p_km, p_minutes, p_fare_amount, p_fare_currency,
    case when v_driver_id is null then null else now() end
  )
  returning * into v_ride;
  return v_ride;
end;
$$;

-- Driver accepts: only the currently-dispatched driver, only while still
-- 'dispatched' (guards a race against a timeout/rejection landing first).
create or replace function accept_ride(p_ride_id uuid)
returns rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride rides;
begin
  update rides set status = 'toPickup', matched_at = now()
  where id = p_ride_id and driver_id = auth.uid() and status = 'dispatched'
  returning * into v_ride;
  if v_ride.id is null then
    raise exception 'ride is no longer available to accept';
  end if;
  update drivers set accepted_count = accepted_count + 1 where id = auth.uid();
  return v_ride;
end;
$$;
grant execute on function accept_ride(uuid) to authenticated;

-- Driver rejects (or the 20s window in the app times out and calls this the
-- same way): tries the next-nearest driver excluding everyone who's declined
-- so far; falls back to 'searching' if none are left.
create or replace function reject_ride(p_ride_id uuid)
returns rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride rides;
  v_next_driver uuid;
  v_declined uuid[];
begin
  select * into v_ride from rides where id = p_ride_id and driver_id = auth.uid() and status = 'dispatched';
  if v_ride.id is null then
    raise exception 'ride is no longer available to reject';
  end if;
  update drivers set rejected_count = rejected_count + 1 where id = auth.uid();

  v_declined := v_ride.declined_driver_ids || auth.uid();
  v_next_driver := nearest_available_driver(v_ride.pickup_lat, v_ride.pickup_lng, v_declined);

  update rides set
    driver_id = v_next_driver,
    declined_driver_ids = v_declined,
    status = (case when v_next_driver is null then 'searching' else 'dispatched' end)::ride_status,
    dispatched_at = (case when v_next_driver is null then null else now() end)
  where id = p_ride_id
  returning * into v_ride;
  return v_ride;
end;
$$;
grant execute on function reject_ride(uuid) to authenticated;

-- Drivers need to see rides dispatched to them (Stage 4 only granted select
