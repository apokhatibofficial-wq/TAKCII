-- Shown to riders before they've picked a destination, replacing the old
-- quick-pick-places row in that same UI slot: a simple, informational "these
-- are our best drivers" row, not a request-this-specific-driver flow (the
-- dispatch system still assigns nearest-available). SECURITY DEFINER so a
-- rider can see this narrow, safe slice (name + photo + rating only, no
-- phone/plate/car/location) without any broader read access to drivers --
-- today only "own row" and "assigned-ride counterparty" policies exist.
create or replace function top_rated_drivers(p_limit int default 8)
returns table (id uuid, name text, selfie_url text, avg_rating numeric, ratings_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select d.id, d.name, d.selfie_url,
         round(avg(r.driver_stars), 1) as avg_rating,
         count(r.driver_stars) as ratings_count
  from drivers d
  join ratings r on r.driver_id = d.id and r.driver_stars is not null
  where d.status = 'active' and d.online = true
  group by d.id, d.name, d.selfie_url
  having count(r.driver_stars) > 0
  order by avg(r.driver_stars) desc, count(r.driver_stars) desc
  limit greatest(1, least(p_limit, 20))
$$;
grant execute on function top_rated_drivers(int) to authenticated;
