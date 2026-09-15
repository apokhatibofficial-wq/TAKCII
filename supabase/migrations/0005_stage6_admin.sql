-- Stage 6: admin identity + full access.
--
-- Simplification, flagged deliberately: admin writes here apply immediately
-- (direct RLS grant below), not staged behind the prototype's "نشر التغييرات"
-- draft/publish outbox (admin_pending_changes exists in the schema but isn't
-- wired up yet — a real generic apply-on-publish needs either dynamic SQL or
-- a typed per-table Edge Function, and given the driver app still has to be
-- built today, direct-apply ships first).

create table admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);
alter table admin_users enable row level security;
create policy "admins read own row" on admin_users for select using (auth.uid() = id);

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(select 1 from admin_users au where au.id = auth.uid());
$$;
grant execute on function is_admin() to authenticated;

-- One additional permissive policy per table grants admins full CRUD; existing
-- owner-scoped policies are untouched (Postgres ORs permissive policies for
-- the same command, so a rider's own-row policy still works for riders).
create policy "admin full access riders" on riders for all using (is_admin()) with check (is_admin());
create policy "admin full access drivers" on drivers for all using (is_admin()) with check (is_admin());
create policy "admin full access places" on places for all using (is_admin()) with check (is_admin());
create policy "admin full access rides" on rides for all using (is_admin()) with check (is_admin());
create policy "admin full access ratings" on ratings for all using (is_admin()) with check (is_admin());
create policy "admin full access messages" on messages for all using (is_admin()) with check (is_admin());
create policy "admin full access ads" on ads for all using (is_admin()) with check (is_admin());
create policy "admin full access pricing" on pricing for all using (is_admin()) with check (is_admin());
create policy "admin full access pricing_settings" on pricing_settings for all using (is_admin()) with check (is_admin());
create policy "admin full access admin_settings" on admin_settings for all using (is_admin()) with check (is_admin());
create policy "admin full access admin_pending_changes" on admin_pending_changes for all using (is_admin()) with check (is_admin());
create policy "admin full access admin_users" on admin_users for all using (is_admin()) with check (is_admin());

-- messages/ads had RLS enabled since Stage 1 but no rider/driver-facing
-- policies at all yet (only admin could touch them, as of the grants above) —
-- these are what actually let the inbox/announcement features work.
create policy "riders read own messages" on messages for select using (
  exists (select 1 from riders where riders.id = auth.uid())
  and (audience in ('all', 'users') or (audience = 'one' and target_kind = 'user' and target_id = auth.uid()))
);
create policy "drivers read own messages" on messages for select using (
  exists (select 1 from drivers where drivers.id = auth.uid())
  and (audience in ('all', 'drivers') or (audience = 'one' and target_kind = 'driver' and target_id = auth.uid()))
);
create policy "riders read active ads" on ads for select using (
  active = true and audience in ('all', 'users') and exists (select 1 from riders where riders.id = auth.uid())
);
create policy "drivers read active ads" on ads for select using (
  active = true and audience in ('all', 'drivers') and exists (select 1 from drivers where drivers.id = auth.uid())
);
