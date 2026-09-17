// Admin-only: deletes a rider/driver's auth.users row (service role — the
// admin client can't do this itself). riders.id/drivers.id both reference
// auth.users(id) on delete cascade, so this removes the profile row too in
// one step, rather than the admin dashboard deleting only the profile row
// and leaving a still-loginable, profile-less auth account behind (which is
// what happened before this function existed — the account looked deleted
// but the identity persisted). If the account has ride/rating history the
// cascade still hits that table's own (non-cascading) foreign key and this
// fails exactly as a direct table delete would, which is the desired
// behavior — history-bearing accounts should be suspended, not deleted.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return bad(401, 'missing_authorization');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { data: caller } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!caller.user) return bad(401, 'invalid_session');
    const { data: isAdminRow } = await admin.from('admin_users').select('id').eq('id', caller.user.id).maybeSingle();
    if (!isAdminRow) return bad(403, 'not_admin');

    const { id } = await req.json();
    if (!id) return bad(400, 'missing_id');

    // Checked explicitly rather than parsing the cascade's failure: GoTrue
    // wraps any DB error from deleteUser as a generic "Database error
    // deleting user" with no constraint detail to distinguish "has history"
    // from a real failure. Four separate .eq() counts rather than an
    // interpolated .or() filter string, which would otherwise take
    // caller-controlled id straight into PostgREST filter syntax unescaped.
    const counts = await Promise.all([
      admin.from('rides').select('id', { count: 'exact', head: true }).eq('rider_id', id),
      admin.from('rides').select('id', { count: 'exact', head: true }).eq('driver_id', id),
      admin.from('ratings').select('id', { count: 'exact', head: true }).eq('rider_id', id),
      admin.from('ratings').select('id', { count: 'exact', head: true }).eq('driver_id', id)
    ]);
    if (counts.some((c) => (c.count ?? 0) > 0)) return bad(409, 'has_history');

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return bad(400, error.message);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch {
    return bad(400, 'bad_request');
  }
});
