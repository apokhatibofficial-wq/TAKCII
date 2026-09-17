-- Security review finding: several RLS policies let an authenticated client
-- write far more than the app's own UI ever asks for, since Postgres RLS is
-- row-scoped, not column-scoped, and these policies had no column checks.
-- Anyone with the (public, by design) anon key could bypass every RPC's
-- business logic entirely via a raw REST/SDK call. Concretely, before this
-- migration:
--   * a rider could INSERT a `rides` row directly (bypassing request_ride())
--     with any fare_amount/driver_id/status they liked, or UPDATE an
--     existing ride's fare_amount after a driver already agreed to it;
--   * a driver could UPDATE their assigned ride's fare_amount, or
--     wait_seconds/wait_runs/wait_fare past the intended two-run cap
--     (that cap was only ever enforced client-side);
--   * a suspended rider, or a pending/suspended driver, could set their own
--     `status` back to 'active' directly, bypassing admin review entirely;
--   * a rider could insert a `ratings` row for any driver_id of their
--     choosing, not necessarily whoever actually drove them.
-- This migration removes the raw table access that made all of that
-- possible and replaces the two legitimate write paths (rider cancel,
-- driver trip-advance) with SECURITY DEFINER functions that only perform
-- the exact state transition they're meant to, computing money-relevant
-- fields (wait_fare) server-side instead of trusting a client-supplied
-- value. It does not touch the admin policies (`is_admin()`-gated) at all.

-- --- rides: only request_ride()/accept_ride()/reject_ride() may create or
-- freely mutate a row from here on (all SECURITY DEFINER, already correct);
-- riders/drivers get narrow RPCs for the two things their own UI actually
-- needs to do themselves.
drop policy if exists "riders create own rides" on rides;
drop policy if exists "riders update own rides" on rides;
drop policy if exists "drivers update assigned rides" on rides;

create or replace function cancel_ride(p_ride_id uuid)
returns rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride rides;
begin
  update rides set status = 'cancelled', cancelled_at = now()
  where id = p_ride_id and rider_id = auth.uid() and status not in ('done', 'cancelled')
  returning * into v_ride;
  if v_ride.id is null then
    raise exception 'ride cannot be cancelled';
  end if;
  return v_ride;
end;
$$;
grant execute on function cancel_ride(uuid) to authenticated;

-- Mirrors useDriverRide.ts's ADVANCE map exactly (toPickup->arrived->onTrip->done).
-- wait_seconds/wait_runs are still client-measured (a physical stopwatch the
-- driver starts/stops has no independent server-side source of truth without
-- a bigger redesign to server-timestamped start/stop events) but wait_runs is
-- clamped to the intended two-run cap and wait_fare is always computed here
-- from pricing, never taken from the client directly.
create or replace function advance_trip(p_ride_id uuid, p_wait_seconds int default 0, p_wait_runs int default 0)
returns rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride rides;
  v_next ride_status;
  v_wait_seconds int;
  v_wait_runs int;
  v_wait_fare numeric;
  v_per_wait_hour numeric;
begin
  select * into v_ride from rides where id = p_ride_id and driver_id = auth.uid();
  if v_ride.id is null then
    raise exception 'ride not found for this driver';
  end if;

  v_next := case v_ride.status
    when 'toPickup' then 'arrived'
    when 'arrived' then 'onTrip'
    when 'onTrip' then 'done'
    else null
  end;
  if v_next is null then
    raise exception 'ride cannot be advanced from status %', v_ride.status;
  end if;

  if v_next = 'done' then
    v_wait_seconds := greatest(0, coalesce(p_wait_seconds, 0));
    v_wait_runs := least(2, greatest(0, coalesce(p_wait_runs, 0)));
    select per_wait_hour into v_per_wait_hour from pricing where currency = v_ride.fare_currency;
    v_wait_fare := (v_wait_seconds::numeric / 3600) * coalesce(v_per_wait_hour, 0);

    update rides set
      status = 'done', completed_at = now(),
      wait_seconds = v_wait_seconds, wait_runs = v_wait_runs, wait_fare = v_wait_fare
    where id = p_ride_id
    returning * into v_ride;
  else
    update rides set
      status = v_next,
      arrived_at = case when v_next = 'arrived' then now() else arrived_at end,
      started_at = case when v_next = 'onTrip' then now() else started_at end
    where id = p_ride_id
    returning * into v_ride;
  end if;

  return v_ride;
end;
$$;
grant execute on function advance_trip(uuid, int, int) to authenticated;

-- --- riders: the rider app has no legitimate use for a raw self-update at
-- all (it only ever inserts its own row once, at signup) — dropping this
-- closes the self-reactivate-after-suspension hole with no functional loss.
drop policy if exists "riders update own row" on riders;

-- --- drivers: online/lat/lng are genuinely self-editable (the toggle button
-- and the background location task); status is not — that's what let a
-- pending or suspended driver approve/unsuspend themselves.
create or replace function drivers_restrict_self_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() and new.status is distinct from old.status then
    raise exception 'only an admin can change a driver''s status';
  end if;
  return new;
end;
$$;
drop trigger if exists drivers_restrict_self_status_trigger on drivers;
create trigger drivers_restrict_self_status_trigger
before update on drivers
for each row execute function drivers_restrict_self_status();

-- --- ratings: a rider's own completed ride must actually have been driven
-- by the driver_id they're rating.
drop policy if exists "riders insert rating for own completed ride" on ratings;
create policy "riders insert rating for own completed ride" on ratings for insert with check (
  auth.uid() = rider_id
  and exists (
    select 1 from rides
    where rides.id = ride_id and rides.rider_id = auth.uid() and rides.status = 'done' and rides.driver_id = driver_id
  )
);
