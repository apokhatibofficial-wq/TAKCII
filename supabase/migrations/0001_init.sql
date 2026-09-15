-- TAK-C.TAXI — initial schema.
-- Mirrors packages/shared/src/types.ts; keep both in sync by hand until we switch
-- to `supabase gen types typescript`.

create extension if not exists pgcrypto;

create type user_status      as enum ('active','suspended');
create type driver_status    as enum ('pending','active','suspended');
create type ride_status      as enum ('searching','toPickup','arrived','onTrip','done','cancelled');
create type message_audience as enum ('all','users','drivers','one');
create type ad_audience      as enum ('all','users','drivers');
create type currency_code    as enum ('SYP','TRY','USD');

-- the spec's "users" table — named `riders` to avoid clashing with Supabase's
-- own auth.users
create table riders (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  email text not null,
  username text unique not null,
  photo_url text,
  status user_status not null default 'active',
  created_at timestamptz not null default now()
);

create table drivers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  email text not null,
  username text unique not null,
  plate text not null,
  car text not null,
  selfie_url text,
  car_photo_url text,
  status driver_status not null default 'pending',
  online boolean not null default false,
  lat double precision,
  lng double precision,                 -- pushed by the Android app's background location task
  accepted_count int not null default 0,
  rejected_count int not null default 0,
  updated_at timestamptz not null default now()
);

create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  kind text,                            -- set on OSM imports (مشفى/سوق/…)
  lat double precision not null,
  lng double precision not null,
  source text not null default 'manual' check (source in ('manual','osm')),
  created_at timestamptz not null default now()
);

create table rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references riders(id),
  driver_id uuid references drivers(id),
  pickup_name text not null, pickup_lat double precision not null, pickup_lng double precision not null,
  dest_name text not null, dest_lat double precision not null, dest_lng double precision not null,
  status ride_status not null default 'searching',
  km double precision, minutes double precision,
  fare_amount numeric, fare_currency currency_code,
  wait_seconds int not null default 0,
  wait_runs int not null default 0,
  wait_fare numeric not null default 0,
  eta_minutes int,
  requested_at timestamptz not null default now(),
  matched_at timestamptz, arrived_at timestamptz, started_at timestamptz, completed_at timestamptz, cancelled_at timestamptz
);
create index rides_rider_id_idx on rides (rider_id);
create index rides_driver_id_idx on rides (driver_id);
create index rides_status_idx on rides (status);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id),
  driver_id uuid not null references drivers(id),
  rider_id uuid not null references riders(id),
  stars smallint not null check (stars between 1 and 5),
  edited_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (ride_id)
);
create index ratings_driver_id_idx on ratings (driver_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience message_audience not null,
  target_kind text check (target_kind in ('user','driver')),   -- set only when audience='one'
  target_id uuid,
  created_at timestamptz not null default now()
);

create table ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  audience ad_audience not null default 'all',
  button_label text,
  button_url text,
  image_fit text not null default 'cover' check (image_fit in ('cover','contain')),
  height int not null default 270,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table pricing (                  -- one row per currency
  currency currency_code primary key,
  base numeric not null,
  per_km numeric not null,
  per_min numeric not null,
  min_fare numeric not null,
  round_to numeric not null,
  per_wait_hour numeric not null
);

create table pricing_settings (         -- singleton
  id boolean primary key default true check (id),
  active_currency currency_code not null default 'SYP',
  show_to_riders boolean not null default true
);

create table admin_settings (           -- singleton; admin's password lives in Supabase Auth, not here
  id boolean primary key default true check (id),
  admin_username text not null default 'admin'
);

-- draft/publish system ("نظام المسوّدة والنشر") — the real-schema equivalent of
-- the prototype's db(draft)/live(published) pair, scoped to admin-editable tables.
-- Admin-tab writes append here instead of touching the live table directly; the
-- publish-changes Edge Function applies every queued patch in one transaction,
-- in id order, then clears the queue. discard just clears it.
create table admin_pending_changes (
  id bigint generated always as identity primary key,
  table_name text not null,
  op text not null check (op in ('insert','update','delete')),
  row_id uuid,
  patch jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- seed data — matches النشر.md's trial accounts and the prototype's SEED_* / DEFAULT_PRICING
insert into places (name, area, lat, lng) values
  ('ساحة الدانا الرئيسية', 'الدانا', 36.2128, 36.7607),
  ('السوق القديم', 'الدانا', 36.2105, 36.7580),
  ('شارع الجامع الكبير', 'الدانا', 36.2156, 36.7551),
  ('كراج سرمدا', 'سرمدا', 36.1861, 36.7275),
  ('دوار سرمدا الشمالي', 'سرمدا', 36.1925, 36.7240),
  ('مشفى سرمدا', 'سرمدا', 36.1889, 36.7188),
  ('معبر باب الهوى', 'باب الهوى', 36.2244, 36.6656),
  ('كفر لوسين', 'كفر لوسين', 36.2333, 36.6833);

insert into pricing (currency, base, per_km, per_min, min_fare, round_to, per_wait_hour) values
  ('SYP', 3,   2,  0.2, 5,  1, 60),
  ('TRY', 20,  12, 1,   35, 5, 200),
  ('USD', 0.5, 0.35, 0.03, 1, 0.25, 5);

insert into pricing_settings (id, active_currency, show_to_riders) values (true, 'SYP', true);
insert into admin_settings (id, admin_username) values (true, 'admin');

-- Row Level Security — enabled now; policies land alongside auth in Stage 2/6
-- so nothing is readable/writable from the client until each policy is deliberate.
alter table riders enable row level security;
alter table drivers enable row level security;
alter table places enable row level security;
alter table rides enable row level security;
alter table ratings enable row level security;
alter table messages enable row level security;
alter table ads enable row level security;
alter table pricing enable row level security;
alter table pricing_settings enable row level security;
alter table admin_settings enable row level security;
alter table admin_pending_changes enable row level security;
