-- 0017's "revoke execute ... from public" turned out not to be enough:
-- verified live that 'authenticated' could still call sweep_stale_rides()
-- directly. This schema evidently grants execute on newly created public
-- functions to authenticated/anon directly (not only via PUBLIC), which
-- every other function in this project works around by simply wanting that
-- grant anyway -- this is the first one that deliberately doesn't. Revoke
-- both explicitly so only service_role (already granted in 0017) can call it.
revoke execute on function sweep_stale_rides() from authenticated, anon;
