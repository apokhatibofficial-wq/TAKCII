-- Mirrors 0003's "riders view matched driver" policy in the other direction:
-- a driver needs to see the rider's name on a ride currently dispatched or
-- active to them (index.html's reqRider on the incoming-request card).
create policy "drivers view rider on assigned ride" on riders for select using (
  exists (
    select 1 from rides
    where rides.rider_id = riders.id
      and rides.driver_id = auth.uid()
      and rides.status in ('dispatched', 'toPickup', 'arrived', 'onTrip')
  )
);
