// Public: given a username or phone + account kind, returns the email to sign
// in with. Supabase Auth only authenticates by email, so this is the one
// server-side step that lets the login screens accept "username or phone",
// like the prototype, without an open RLS read on riders/drivers. Runs with
// the service role (auto-injected by the platform) to look the row up, and
// only ever returns { email, status } or a generic not-found — never the row.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { loginId, role } = await req.json();
    if (!loginId || (role !== 'rider' && role !== 'driver' && role !== 'admin')) {
      return new Response(JSON.stringify({ error: 'loginId and role are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const id = String(loginId).trim();

    if (role === 'admin') {
      const { data: adminRow, error: adminErr } = await admin.from('admin_users').select('id').eq('username', id).maybeSingle();
      if (adminErr || !adminRow) {
        return new Response(JSON.stringify({ error: 'account_not_found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(adminRow.id);
      if (authErr || !authUser.user?.email) {
        return new Response(JSON.stringify({ error: 'account_not_found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ email: authUser.user.email, status: 'active' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const table = role === 'rider' ? 'riders' : 'drivers';
    const { data, error } = await admin
      .from(table)
      .select('email, status')
      .or(`username.eq.${id},phone.eq.${id}`)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'account_not_found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ email: data.email, status: data.status }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
});
