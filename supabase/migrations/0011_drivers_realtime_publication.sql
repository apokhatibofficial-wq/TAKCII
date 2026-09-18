-- 0003 added `rides` to supabase_realtime but never `drivers` — every
-- postgres_changes subscription on the drivers table (the driver app's own
-- useDriverProfile, watching for an admin suspending/force-disconnecting
-- it; the rider app's new live driver-location tracking) has been
-- subscribing successfully (SUBSCRIBED status) but never actually
-- receiving an UPDATE event, because Postgres logical replication never
-- published drivers' row changes to begin with. Confirmed live: a test
-- client subscribed exactly as the app does, a row was updated, and after
-- several seconds waiting no event arrived — only fixable by adding the
-- table to the publication, not by anything on the subscribing side.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'drivers'
  ) then
    alter publication supabase_realtime add table drivers;
  end if;
end $$;
