-- Push notification subscriptions — one row per device/browser registration.
-- Separate table (not a column on riders/drivers) since a user can have
-- multiple active subscriptions (e.g. a rider with the PWA open in two
-- browsers), and driver (Expo) vs rider (Web Push) shapes don't overlap.
-- expo_token/web_endpoint use plain (non-partial) unique constraints:
-- Postgres treats every NULL as distinct for uniqueness purposes, so rows
-- of the other platform (which leave that column NULL) never collide —
-- and a plain unique constraint, unlike a partial index, works directly
-- as an ON CONFLICT target from PostgREST's .upsert(onConflict: '...').
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('expo', 'web')),
  expo_token text unique,
  web_endpoint text unique,
  web_p256dh text,
  web_auth text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- A user manages only their own subscriptions; the sender runs as the
-- service role (send-ride-notification Edge Function), which bypasses RLS.
create policy "users manage own push subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
