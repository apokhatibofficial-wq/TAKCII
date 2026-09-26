-- 0022's policy only covered `for select`, which is enough to authorize
-- *subscribing* to the private ride-call:<rideId> channel (confirmed live:
-- both the rider and the assigned driver do reach SUBSCRIBED) but broadcast
-- *sending* on a private channel is checked separately against the same
-- table -- confirmed live too: a plain public (non-private) channel
-- delivers a broadcast between two clients instantly, but on this private
-- channel, sends succeed client-side (fire-and-forget) yet are never
-- delivered, and enabling delivery receipts (broadcast.ack) shows the send
-- itself times out rather than being acknowledged. Broadening to `for all`
-- (using + with check, same condition) covers send the same way select
-- already covers receive.
drop policy "ride participants use call signaling channel" on realtime.messages;

create policy "ride participants use call signaling channel" on realtime.messages
for all
to authenticated
using (
  exists (
    select 1 from rides
    where realtime.topic() = 'ride-call:' || rides.id::text
      and (rides.rider_id = auth.uid() or rides.driver_id = auth.uid())
      and rides.status in ('dispatched', 'toPickup', 'arrived', 'onTrip')
  )
)
with check (
  exists (
    select 1 from rides
    where realtime.topic() = 'ride-call:' || rides.id::text
      and (rides.rider_id = auth.uid() or rides.driver_id = auth.uid())
      and rides.status in ('dispatched', 'toPickup', 'arrived', 'onTrip')
  )
);
