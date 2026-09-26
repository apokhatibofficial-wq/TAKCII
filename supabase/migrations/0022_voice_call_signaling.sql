-- In-app voice calling between a ride's rider and driver, signaled over a
-- Supabase Realtime private Broadcast channel (topic `ride-call:<rideId>`)
-- rather than any table -- there is nothing to persist, only SDP offers/
-- answers and ICE candidates in transit for the life of one call. Private
-- channels are authorized by RLS on realtime.messages itself (realtime.topic()
-- returns the channel topic being joined/sent to); with RLS already enabled
-- there and no existing policy, every private channel is currently
-- unreachable by anyone until a matching policy exists.
create policy "ride participants use call signaling channel" on realtime.messages
for select
to authenticated
using (
  exists (
    select 1 from rides
    where realtime.topic() = 'ride-call:' || rides.id::text
      and (rides.rider_id = auth.uid() or rides.driver_id = auth.uid())
      and rides.status in ('dispatched', 'toPickup', 'arrived', 'onTrip')
  )
);
