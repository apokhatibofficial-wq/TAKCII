-- 0007 added nearest_available_driver(double precision, double precision, uuid[] default '{}')
-- but the original 2-arg version from 0003 still exists as a separate overload.
-- Because the new arg has a default, calling with exactly 2 args (as request_ride
-- does) is now ambiguous between the two signatures. Drop the old one.
drop function if exists nearest_available_driver(double precision, double precision);
