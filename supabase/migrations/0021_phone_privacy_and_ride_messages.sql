-- Phone numbers move off drivers/riders into dedicated contact tables that
-- never get a cross-party policy -- unlike drivers/riders themselves, whose
-- existing "assigned ride counterparty" policies (0003, 0009) have to stay
-- exactly as they are so the rider's live driver-location tracking keeps
-- working (Realtime's postgres_changes needs the base table's row visible
-- under RLS to the subscriber; it can't be satisfied by a function or a
-- view). Column-level GRANT/REVOKE can't fix this either -- the same
-- `authenticated` role needs full access to its OWN row (own profile) but
-- restricted access to a matched counterparty's row, and Postgres privilege
-- grants apply to the role regardless of which RLS policy admitted the row.
-- A separate table with its own strict RLS is the only construct that
-- actually closes this off at the data layer, not just in the app's own
-- queries (which a raw REST call with a legitimate participant's own JWT
-- could otherwise route around entirely).
create table driver_contacts (
  driver_id uuid primary key references drivers(id) on delete cascade,
  phone text not null
);
create table rider_contacts (
  rider_id uuid primary key references riders(id) on delete cascade,
  phone text not null
);

insert into driver_contacts (driver_id, phone) select id, phone from drivers;
insert into rider_contacts (rider_id, phone) select id, phone from riders;

alter table drivers drop column phone;
alter table riders drop column phone;

alter table driver_contacts enable row level security;
alter table rider_contacts enable row level security;

create policy "drivers select own contact" on driver_contacts for select using (auth.uid() = driver_id);
create policy "drivers insert own contact" on driver_contacts for insert with check (auth.uid() = driver_id);
create policy "drivers update own contact" on driver_contacts for update using (auth.uid() = driver_id) with check (auth.uid() = driver_id);
create policy "admin full access driver_contacts" on driver_contacts for all using (is_admin()) with check (is_admin());

create policy "riders select own contact" on rider_contacts for select using (auth.uid() = rider_id);
create policy "riders insert own contact" on rider_contacts for insert with check (auth.uid() = rider_id);
create policy "riders update own contact" on rider_contacts for update using (auth.uid() = rider_id) with check (auth.uid() = rider_id);
create policy "admin full access rider_contacts" on rider_contacts for all using (is_admin()) with check (is_admin());

-- resolve-login-email (service role, bypasses RLS regardless) now looks
-- phone up here instead of on riders/drivers directly -- see that
-- function's own updated query.

-- In-app messaging, so "only through the app" has a real replacement for
-- the phone-call/SMS habit the number lockdown above removes. One row per
-- message, scoped to a ride's two participants, only while the ride is
-- actually live (matches the same status window RidePanel/driver Home show
-- the counterparty's name/photo for).
create table ride_messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index ride_messages_ride_id_idx on ride_messages (ride_id, created_at);

alter table ride_messages enable row level security;

create policy "ride participants select messages" on ride_messages for select using (
  exists (
    select 1 from rides
    where rides.id = ride_messages.ride_id
      and (rides.rider_id = auth.uid() or rides.driver_id = auth.uid())
  )
);
-- Insert is via send_ride_message() below (needs to check the ride is live
-- and stamp sender_id server-side), not a raw policy -- mirrors rate_ride's
-- own pattern in 0013.
create policy "admin full access ride_messages" on ride_messages for all using (is_admin()) with check (is_admin());

create or replace function send_ride_message(p_ride_id uuid, p_body text)
returns ride_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride rides;
  v_result ride_messages;
begin
  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'message body cannot be empty';
  end if;
  if char_length(p_body) > 1000 then
    raise exception 'message too long';
  end if;

  select * into v_ride from rides where id = p_ride_id;
  if v_ride is null then
    raise exception 'ride not found';
  end if;
  if auth.uid() is distinct from v_ride.rider_id and auth.uid() is distinct from v_ride.driver_id then
    raise exception 'not authorized to message on this ride';
  end if;
  if v_ride.status not in ('dispatched', 'toPickup', 'arrived', 'onTrip') then
    raise exception 'ride is not live';
  end if;

  insert into ride_messages (ride_id, sender_id, body)
  values (p_ride_id, auth.uid(), trim(p_body))
  returning * into v_result;

  return v_result;
end;
$$;
grant execute on function send_ride_message(uuid, text) to authenticated;

-- Without this, a postgres_changes subscription on ride_messages would
-- report SUBSCRIBED and then silently never deliver a single event --
-- see 0011's note on the exact same gap for `drivers`.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ride_messages'
  ) then
    alter publication supabase_realtime add table ride_messages;
  end if;
end $$;
