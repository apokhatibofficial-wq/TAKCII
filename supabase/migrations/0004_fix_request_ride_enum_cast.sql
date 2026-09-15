-- Fix: a bare `case when ... then 'searching' else 'toPickup' end` resolves to
-- text, and Postgres won't implicitly cast that into the ride_status enum
-- column (unlike a plain literal in a VALUES list). Caught by testing
-- request_ride() against the live seeded drivers before any client used it.
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
    (case when v_driver_id is null then 'searching' else 'toPickup' end)::ride_status,
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
