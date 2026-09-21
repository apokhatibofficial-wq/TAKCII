-- request_ride previously took p_fare_amount/p_fare_currency straight from
-- the client and stored them with no server-side check at all, and p_km
-- could be set to anything regardless of the real pickup/destination
-- distance. Any authenticated rider could call this RPC directly
-- (bypassing the app's own UI entirely, e.g. from a browser console) and
-- create a ride whose displayed fare/km/minutes are completely disconnected
-- from the real trip -- the driver app shows those numbers as fact before
-- the driver decides whether to accept.
--
-- Mirrors how advance_trip already computes wait_fare server-side instead
-- of trusting the client: fare_amount is now computed here from the live
-- pricing row, using the exact formula packages/shared/src/pricing.ts's
-- fareOf() already uses client-side for the estimate the rider sees before
-- requesting. p_fare_currency is dropped entirely in favor of
-- pricing_settings.active_currency -- the whole platform runs one active
-- currency at a time, so a client claiming a different one never made sense
-- to allow. p_km/p_minutes are still client-reported (real road distance
-- needs a routing call this database can't make on its own), but p_km can
-- no longer be smaller than the straight-line pickup-to-destination
-- distance, which is a physical impossibility for road travel and catches
-- the most damaging version of this (a long trip claimed as a short one).
--
-- This changes the function's parameter list, so create-or-replace does not
-- touch the old 10-arg overload -- it has to be dropped explicitly or both
-- versions (one of them still exploitable) would coexist.
drop function if exists request_ride(
  text, double precision, double precision, text, double precision, double precision,
  double precision, double precision, numeric, currency_code
);

create or replace function request_ride(
  p_pickup_name text, p_pickup_lat double precision, p_pickup_lng double precision,
  p_dest_name text, p_dest_lat double precision, p_dest_lng double precision,
  p_km double precision, p_minutes double precision
) returns rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_ride rides;
  v_currency currency_code;
  v_pricing pricing;
  v_straight_km double precision;
  v_fare_amount numeric;
begin
  v_straight_km := 6371 * acos(
    least(1, greatest(-1,
      cos(radians(p_pickup_lat)) * cos(radians(p_dest_lat)) * cos(radians(p_dest_lng) - radians(p_pickup_lng))
      + sin(radians(p_pickup_lat)) * sin(radians(p_dest_lat))
    ))
  );
  if p_km < v_straight_km - 0.05 then -- small tolerance for float rounding
    raise exception 'km cannot be less than the straight-line distance between pickup and destination';
  end if;

  select active_currency into v_currency from pricing_settings where id = true;
  select * into v_pricing from pricing where currency = v_currency;
  if v_pricing.currency is null then
    raise exception 'no active pricing configured';
  end if;

  v_fare_amount := greatest(v_pricing.min_fare, v_pricing.base + v_pricing.per_km * p_km + v_pricing.per_min * p_minutes);
  v_fare_amount := round(v_fare_amount / v_pricing.round_to) * v_pricing.round_to;

  v_driver_id := nearest_available_driver(p_pickup_lat, p_pickup_lng);
  insert into rides (
    rider_id, driver_id, pickup_name, pickup_lat, pickup_lng, dest_name, dest_lat, dest_lng,
    status, km, minutes, fare_amount, fare_currency, dispatched_at
  ) values (
    auth.uid(), v_driver_id, p_pickup_name, p_pickup_lat, p_pickup_lng, p_dest_name, p_dest_lat, p_dest_lng,
    (case when v_driver_id is null then 'searching' else 'dispatched' end)::ride_status,
    p_km, p_minutes, v_fare_amount, v_currency,
    case when v_driver_id is null then null else now() end
  )
  returning * into v_ride;
  return v_ride;
end;
$$;
grant execute on function request_ride(
  text, double precision, double precision, text, double precision, double precision,
  double precision, double precision
) to authenticated;
