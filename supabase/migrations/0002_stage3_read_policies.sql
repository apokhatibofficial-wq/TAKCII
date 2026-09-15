-- Stage 3 (map, search, pricing): places and pricing aren't sensitive — the
-- rider app needs to browse/search them and compute a fare before any auth
-- state matters (the prototype shows the search screen pre-login too), so
-- these are public reads. Drivers/riders stay locked down from Stage 2.
create policy "places public read" on places for select using (true);
create policy "pricing public read" on pricing for select using (true);
create policy "pricing_settings public read" on pricing_settings for select using (true);
