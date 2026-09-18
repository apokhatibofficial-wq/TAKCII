// Called by the rider/driver client right after a ride-mutating RPC succeeds
// (request_ride, accept_ride, reject_ride, advance_trip, cancel_ride). Reads
// the ride's current row itself rather than trusting any client-supplied
// status/content, so a malicious caller can at most re-trigger a real
// notification early — never forge one. No Postgres trigger/pg_net involved:
// every ride mutation already goes through a small, known set of RPCs (see
// migrations 0007/0010), so each of their call sites just invokes this
// function once afterwards instead of duplicating that fan-out server-side.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:apokhatib.official@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface RideNotification {
  targetUserId: string;
  title: string;
  body: string;
}

// The one place that maps a ride's current state to "who gets notified,
// saying what" — every RPC call site below shares this instead of each
// guessing at copy.
function notificationFor(ride: Record<string, unknown>): RideNotification | null {
  const status = ride.status as string;
  if (status === 'dispatched' && ride.driver_id) {
    return { targetUserId: ride.driver_id as string, title: 'طلب رحلة جديد', body: `${ride.pickup_name} إلى ${ride.dest_name}` };
  }
  if (status === 'toPickup' && ride.rider_id) {
    return { targetUserId: ride.rider_id as string, title: 'تم العثور على سائق', body: 'السائق في طريقه إليك الآن' };
  }
  if (status === 'arrived' && ride.rider_id) {
    return { targetUserId: ride.rider_id as string, title: 'السائق بانتظارك', body: 'وصل السائق إلى نقطة الانطلاق' };
  }
  if (status === 'cancelled' && ride.driver_id) {
    return { targetUserId: ride.driver_id as string, title: 'تم إلغاء الرحلة', body: 'ألغى الراكب هذه الرحلة' };
  }
  return null;
}

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

    const { rideId } = await req.json();
    if (!rideId) {
      return new Response(JSON.stringify({ error: 'rideId is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: ride } = await admin.from('rides').select('*').eq('id', rideId).maybeSingle();
    if (!ride) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const notification = notificationFor(ride as unknown as Record<string, unknown>);
    if (!notification) {
      return new Response(JSON.stringify({ sent: false }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', notification.targetUserId);
    const staleIds: string[] = [];

    await Promise.all(
      (subs ?? []).map(async (sub) => {
        if (sub.platform === 'expo' && sub.expo_token) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ to: sub.expo_token, title: notification.title, body: notification.body, data: { rideId } })
          }).catch(() => undefined);
          return;
        }
        if (sub.platform === 'web' && sub.web_endpoint && sub.web_p256dh && sub.web_auth && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.web_endpoint, keys: { p256dh: sub.web_p256dh, auth: sub.web_auth } },
              JSON.stringify({ title: notification.title, body: notification.body, rideId })
            );
          } catch (err) {
            // 404/410 means the browser subscription is gone for good
            // (uninstalled, cleared site data) — stop trying it.
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) staleIds.push(sub.id as string);
          }
        }
      })
    );

    if (staleIds.length) {
      await admin.from('push_subscriptions').delete().in('id', staleIds);
    }

    return new Response(JSON.stringify({ sent: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request', message: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
});
