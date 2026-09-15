// Public: self-service driver registration. Drivers have no OTP step by
// design ("لا يوجد رمز تحقق للسائقين" — admin reviews every new driver
// manually via the pending->active approval flow instead), which means the
// account must be created already-confirmed or the driver could never sign
// in at all (this project runs with mailer_autoconfirm off, since riders
// rely on a real emailed OTP). So this mirrors admin-create-account's
// service-role user+row creation, just unauthenticated and hardcoded to a
// single driver row with status 'pending' — it can never create a rider or
// an already-active account.
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

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json();
    const { name, phone, username, password, plate, car } = body;
    if (!name || !phone || !username || !password) return bad(400, 'missing_fields');
    if (String(password).length < 6) return bad(400, 'password_too_short');

    const email = `${String(username).trim()}@tak-c.taxi`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createErr || !created.user) return bad(400, createErr?.message ?? 'auth_create_failed');

    const { error: insertErr } = await admin.from('drivers').insert({
      id: created.user.id,
      name,
      phone,
      email,
      username: String(username).trim(),
      plate: plate || '000000',
      car: car || 'غير محدد',
      status: 'pending',
      online: false
    });
    if (insertErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return bad(400, insertErr.message);
    }

    return new Response(JSON.stringify({ id: created.user.id }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch {
    return bad(400, 'bad_request');
  }
});
