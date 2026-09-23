-- The only thing that ever moved a 'dispatched' ride off an unresponsive
-- driver was a 20-second countdown living entirely in the driver app's own
-- JS memory (apps/driver/src/hooks/useDriverRide.ts, COUNTDOWN_SECONDS). It
-- only runs while that screen is mounted. If the driver's app isn't open at
-- the moment a ride is dispatched to them, the countdown never starts, so
-- the ride just sits at 'dispatched' -- with no server-side time limit at
-- all -- until that driver happens to open the app again, however long
-- that takes (observed: a day or two). Two real symptoms follow from this:
--   * nearest_available_driver() treats any 'dispatched' ride as making
--     that driver busy, so a driver stuck holding a stale offer is also
--     excluded from every new match until the offer resolves -- with few
--     drivers online, this can leave a rider's own request stuck at
--     'searching' with nothing to retry it, forever (no timeout there
--     either).
--   * When the stuck driver eventually opens the app, its one-time startup
--     query for "is there a ride assigned to me" has no age check, so it
--     surfaces the ancient offer as if it just arrived.
-- This migration makes the 20-second offer window (and an overall give-up
-- point) a server-side guarantee instead of something that only happens if
-- the right client happens to be open.

-- A 'dispatched' ride only counts as making its driver busy while the
-- offer is still within its 20-second window; nearest_available_driver()
-- has to know this too so a stale offer stops blocking new matches to that
-- driver the moment it goes stale, not just whenever the sweep next runs.
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
      select 1 from rides r where r.driver_id = d.id
        and (
          r.status in ('toPickup', 'arrived', 'onTrip')
          or (r.status = 'dispatched' and r.dispatched_at > now() - interval '20 seconds')
        )
    )
  order by point(d.lng, d.lat) <-> point(p_lng, p_lat)
  limit 1;
$$;

-- Server-side backstop, meant to run on a schedule (see cron.schedule below):
--   1. gives up on anything nobody has picked up in 5 minutes, so a rider
--      gets a clear "no driver available" instead of an endless spinner;
--   2. re-offers any 'dispatched' ride whose 20s window expired to the
--      next-nearest driver, the same reassignment reject_ride() already
--      does -- except nothing calls reject_ride if the driver's app was
--      never open to run its countdown out. rejected_count is deliberately
--      left untouched here: the driver never saw and declined the offer,
--      so it isn't a real rejection for reputation purposes.
--   3. retries matching for rides still stuck at 'searching', which
--      previously never got a second attempt once a driver became
--      available.
-- Not granted to authenticated/anon -- this is only meant to be invoked by
-- the scheduled job below, not by client apps.
create or replace function sweep_stale_rides()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_next_driver uuid;
  v_declined uuid[];
begin
  update rides set status = 'cancelled', cancelled_at = now()
  where status in ('searching', 'dispatched') and requested_at <= now() - interval '5 minutes';

  for r in
    select * from rides where status = 'dispatched' and dispatched_at <= now() - interval '20 seconds'
  loop
    v_declined := r.declined_driver_ids || r.driver_id;
    v_next_driver := nearest_available_driver(r.pickup_lat, r.pickup_lng, v_declined);
    update rides set
      driver_id = v_next_driver,
      declined_driver_ids = v_declined,
      status = (case when v_next_driver is null then 'searching' else 'dispatched' end)::ride_status,
      dispatched_at = (case when v_next_driver is null then null else now() end)
    where id = r.id;
  end loop;

  for r in
    select * from rides where status = 'searching'
  loop
    v_next_driver := nearest_available_driver(r.pickup_lat, r.pickup_lng, r.declined_driver_ids);
    if v_next_driver is not null then
      update rides set driver_id = v_next_driver, status = 'dispatched', dispatched_at = now()
      where id = r.id;
    end if;
  end loop;
end;
$$;
-- authenticated/anon (i.e. the app itself) must never be able to force a
-- sweep on demand; service_role is trusted backend-only credential (used
-- here by the test suite, and by any future ops tooling), never shipped to
-- a client app, so it's fine to let it invoke this directly.
revoke execute on function sweep_stale_rides() from public;
grant execute on function sweep_stale_rides() to service_role;

create extension if not exists pg_cron with schema extensions;

select cron.schedule('sweep-stale-rides', '* * * * *', $$ select sweep_stale_rides(); $$);
