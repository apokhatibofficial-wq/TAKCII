// Called by the rider/driver client right after send_ride_message() succeeds.
// Re-reads the message and its ride itself rather than trusting any
// client-supplied body/sender, same principle as send-ride-notification: a
// malicious caller can at most re-trigger a real notification for a message
// that already exists -- never forge one or send someone else's text.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendPushToUser } from '../_shared/push.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const PREVIEW_LENGTH = 80;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
    });
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const { messageId } = await req.json();
    if (!messageId) {
      return new Response(JSON.stringify({ error: 'messageId is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: message } = await admin.from('ride_messages').select('*').eq('id', messageId).maybeSingle();
    if (!message) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const { data: ride } = await admin.from('rides').select('rider_id, driver_id').eq('id', message.ride_id).maybeSingle();
    if (!ride) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // The other party to the ride, whichever side actually sent this message.
    const targetUserId = message.sender_id === ride.rider_id ? ride.driver_id : ride.rider_id;
    if (!targetUserId) {
      return new Response(JSON.stringify({ sent: false }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const body: string = message.body;
    const preview = body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH)}…` : body;
    await sendPushToUser(admin, targetUserId, 'رسالة جديدة', preview, { rideId: message.ride_id });

    return new Response(JSON.stringify({ sent: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request', message: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
});
