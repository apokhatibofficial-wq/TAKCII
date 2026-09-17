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
--     choosing, not necessarily whoever actually drove them;
--   * a driver could directly inflate their own accepted_count/rejected_count
--     (the reputation stats shown in the driver's own stats row), since the
--     existing "drivers update own row" policy is row-scoped, not column-scoped.
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
-- and the background location task); status and the reputation counters are
-- not — status is what let a pending/suspended driver approve/unsuspend
-- themselves, and the counters are what let a driver inflate their own
-- accepted/rejected stats via a raw PATCH. accept_ride/reject_ride still need
-- to bump these server-side, so they flip a transaction-local flag right
-- before doing it: a SECURITY DEFINER function's own writes bypass RLS, but
-- NOT triggers, so without this escape hatch this trigger would also block
-- their own legitimate increment.
create or replace function drivers_restrict_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() and coalesce(current_setting('takc.trusted_write', true), '') <> 'on' then
    if new.status is distinct from old.status then
      raise exception 'only an admin can change a driver''s status';
    end if;
    if new.accepted_count is distinct from old.accepted_count or new.rejected_count is distinct from old.rejected_count then
      raise exception 'accepted_count/rejected_count cannot be written directly';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists drivers_restrict_self_status_trigger on drivers;
drop trigger if exists drivers_restrict_privileged_columns_trigger on drivers;
create trigger drivers_restrict_privileged_columns_trigger
before update on drivers
for each row execute function drivers_restrict_privileged_columns();

-- accept_ride/reject_ride re-declared to set the trigger's escape hatch
-- immediately before the increment it guards; every other line is identical
-- to the 0007 definitions.
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
  perform set_config('takc.trusted_write', 'on', true);
  update drivers set accepted_count = accepted_count + 1 where id = auth.uid();
  return v_ride;
end;
$$;

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
  perform set_config('takc.trusted_write', 'on', true);
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

-- --- ratings: a rider's own completed ride must actually have been driven
-- by the driver_id they're rating. rides.driver_id must be qualified against
-- ratings.driver_id explicitly: a bare `driver_id` here resolves to the
-- subquery's own rides.driver_id (Postgres prefers the innermost scope),
-- which made the very first version of this check tautologically true and
-- let the arbitrary-driver_id rating through unfiltered.
drop policy if exists "riders insert rating for own completed ride" on ratings;
create policy "riders insert rating for own completed ride" on ratings for insert with check (
  auth.uid() = ratings.rider_id
  and exists (
    select 1 from rides
    where rides.id = ratings.ride_id and rides.rider_id = auth.uid() and rides.status = 'done' and rides.driver_id = ratings.driver_id
  )
);
