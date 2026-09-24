// Admin-only: creates a real, confirmed Supabase Auth user plus the matching
// riders/drivers profile row in one call. Needed because admin "add rider" /
// "add driver" (النشر.md's spec) hands out the username+password directly —
// unlike self-signup, there's no OTP step, so this must confirm the account
// itself. Runs with the service role (never exposed to the admin client) and
// checks the caller is an admin before doing anything.
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

    const body = await req.json();
    const { role, name, phone, email, username, password, plate, car } = body;
    if (!role || (role !== 'rider' && role !== 'driver')) return bad(400, 'role must be rider or driver');
    if (!name || !phone || !username || !password) return bad(400, 'missing_fields');
    if (String(password).length < 6) return bad(400, 'password_too_short');

    const finalEmail = email && String(email).trim() ? email : `${String(username).trim()}@tak-c.taxi`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true
    });
    if (createErr || !created.user) return bad(400, createErr?.message ?? 'auth_create_failed');

    const table = role === 'rider' ? 'riders' : 'drivers';
    const row: Record<string, unknown> = { id: created.user.id, name, email: finalEmail, username: String(username).trim(), status: 'active' };
    if (role === 'driver') {
      row.plate = plate || '000000';
      row.car = car || 'غير محدد';
      row.online = false;
    }
    const { error: insertErr } = await admin.from(table).insert(row);
    if (insertErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return bad(400, insertErr.message);
    }
    // Phone lives on its own table (0021), separate from the row above.
    const contactTable = role === 'rider' ? 'rider_contacts' : 'driver_contacts';
    const contactIdCol = role === 'rider' ? 'rider_id' : 'driver_id';
    const { error: contactErr } = await admin.from(contactTable).insert({ [contactIdCol]: created.user.id, phone });
    if (contactErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return bad(400, contactErr.message);
    }

    return new Response(JSON.stringify({ id: created.user.id }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch {
    return bad(400, 'bad_request');
  }
});
