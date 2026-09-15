-- Split from 0007 because Postgres requires a new enum value to be committed
-- before it can be referenced (including from inside a function body created
-- in the same transaction) — this file must run, and commit, first.
alter type ride_status add value 'dispatched' before 'toPickup';
alter table rides add column dispatched_at timestamptz;
alter table rides add column declined_driver_ids uuid[] not null default '{}';
