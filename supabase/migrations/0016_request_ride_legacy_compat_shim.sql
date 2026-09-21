-- Migration 0015 dropped the pre-existing 10-arg request_ride(..., p_fare_amount,
-- p_fare_currency) and replaced it with an 8-arg version. Any client still running
-- the pre-0015 frontend build (i.e. not yet redeployed) calls the old 10-arg shape,
-- which PostgREST can no longer match to any function at all (PGRST202) -- so ride
-- requests from that client fail outright until it is redeployed.
--
-- This restores a 10-arg overload purely for backward compatibility during rollout.
-- It never trusts the caller's p_fare_amount/p_fare_currency -- it discards them and
-- forwards everything else into the real, secure 8-arg request_ride, which still
-- computes fare_amount server-side from live pricing and still rejects an
-- implausible p_km. It does not reopen the vulnerability fixed in 0015.
--
-- Safe to drop (drop function request_ride(text, double precision, double precision,
-- text, double precision, double precision, double precision, double precision,
-- numeric, currency_code);) once every deployed client is confirmed to be on the new
-- 8-arg call.
create or replace function request_ride(
  p_pickup_name text, p_pickup_lat double precision, p_pickup_lng double precision,
  p_dest_name text, p_dest_lat double precision, p_dest_lng double precision,
  p_km double precision, p_minutes double precision, p_fare_amount numeric, p_fare_currency currency_code
) returns rides
language plpgsql
security definer
set search_path = public
as $$
begin
  return request_ride(p_pickup_name, p_pickup_lat, p_pickup_lng, p_dest_name, p_dest_lat, p_dest_lng, p_km, p_minutes);
end;
$$;
grant execute on function request_ride(
  text, double precision, double precision, text, double precision, double precision,
  double precision, double precision, numeric, currency_code
) to authenticated;
