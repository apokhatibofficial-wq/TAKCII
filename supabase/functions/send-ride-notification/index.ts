// Called by the rider/driver client right after a ride-mutating RPC succeeds
// (request_ride, accept_ride, reject_ride, advance_trip, cancel_ride). Reads
// the ride's current row itself rather than trusting any client-supplied
// status/content, so a malicious caller can at most re-trigger a real
// notification early — never forge one. No Postgres trigger/pg_net involved:
// every ride mutation already goes through a small, known set of RPCs (see
// migrations 0007/0010), so each of their call sites just invokes this
// function once afterwards instead of duplicating that fan-out server-side.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendPushToUser } from '../_shared/push.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface RideNotification {
  targetUserId: string;
  title: string;
  body: string;
}

// Set when the rider's pickup point comes from live GPS or a dropped map pin
// rather than a named place (see apps/rider/src/screens/Home.tsx and
// packages/shared/src/osm.ts's reverseGeocode) — meaningless once it leaks
// into a notification shown to the driver, so resolvePickupLabel below
// swaps it for a distance instead.
const GENERIC_PICKUP_NAMES = new Set(['موقعك الحالي', 'الموقع المحدد على الخريطة']);

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function resolvePickupLabel(ride: Record<string, unknown>, admin: ReturnType<typeof createClient>): Promise<string> {
  const name = ride.pickup_name as string;
  if (!GENERIC_PICKUP_NAMES.has(name)) return name;
  const driverId = ride.driver_id as string | null;
  if (!driverId) return name;
  const { data: driver } = await admin.from('drivers').select('lat, lng').eq('id', driverId).maybeSingle();
  if (!driver || driver.lat == null || driver.lng == null) return name;
  const meters = Math.round(haversineMeters(driver.lat, driver.lng, ride.pickup_lat as number, ride.pickup_lng as number) * 1.32);
  return `الراكب على بعد ${meters} متر منك`;
}

// The one place that maps a ride's current state to "who gets notified,
// saying what" — every RPC call site below shares this instead of each
// guessing at copy.
async function notificationFor(ride: Record<string, unknown>, admin: ReturnType<typeof createClient>): Promise<RideNotification | null> {
  const status = ride.status as string;
  if (status === 'dispatched' && ride.driver_id) {
    const pickupLabel = await resolvePickupLabel(ride, admin);
    return { targetUserId: ride.driver_id as string, title: 'طلب رحلة جديد', body: `${pickupLabel} إلى ${ride.dest_name}` };
  }
  if (status === 'toPickup' && ride.rider_id) {
    return { targetUserId: ride.rider_id as string, title: 'تم العثور على سائق', body: 'السائق في طريقه إليك الآن' };
  }
  if (status === 'arrived' && ride.rider_id) {
    return { targetUserId: ride.rider_id as string, title: 'السائق بانتظارك', body: 'وصل السائق إلى نقطة الانطلاق' };
  }
  if (status === 'onTrip' && ride.rider_id) {
    return { targetUserId: ride.rider_id as string, title: 'بدأت الرحلة', body: 'أنت في الطريق إلى وجهتك الآن' };
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

    const notification = await notificationFor(ride as unknown as Record<string, unknown>, admin);
    if (!notification) {
      return new Response(JSON.stringify({ sent: false }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    await sendPushToUser(admin, notification.targetUserId, notification.title, notification.body, { rideId });

    return new Response(JSON.stringify({ sent: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request', message: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
});
