// End-to-end tests for the ride lifecycle against the real Supabase project
// (there is no separate staging instance) -- every ride/user this suite
// creates is force-cleaned after each test and deleted in afterAll, the
// same pattern proven manually while building the ads-analytics migration
// earlier in this project. Needs tests/.env.test.local (see
// tests/.env.test.example) with a service-role key: creating/deleting
// throwaway auth users has no anon-key equivalent.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY -- copy tests/.env.test.example to tests/.env.test.local and fill them in.'
  );
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const freshClient = () => createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });

// Dana-area test coordinates -- driverA starts right at the pickup point,
// driverB well outside it, so "nearest driver" matching is unambiguous.
const PICKUP = { lat: 36.21, lng: 36.76, name: 'اختبار آلي - نقطة الانطلاق' };
const DEST = { lat: 36.215, lng: 36.77, name: 'اختبار آلي - الوجهة' };
const NEAR_POS = { lat: 36.2101, lng: 36.7601 };
const FAR_POS = { lat: 36.05, lng: 36.6 };

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

const createdAuthIds: string[] = [];
const createdRideIds: string[] = [];

async function createTestUser(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = 'TestPass123!';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('failed to create test user');
  createdAuthIds.push(data.user.id);
  const client = freshClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

let rider: TestUser;
let driverA: TestUser;
let driverB: TestUser;
let otherOnlineDriverIds: string[] = [];

beforeAll(async () => {
  // This suite runs against the live production database (no separate
  // staging instance) -- a real driver online near the test pickup point
  // would otherwise make "nearest driver" matching nondeterministic
  // (observed: a real online driver near Dana got matched instead of the
  // synthetic driverA/driverB). Take any other online+active driver
  // temporarily offline for the run, restored exactly in afterAll.
  const { data: others, error: othersErr } = await admin.from('drivers').select('id').eq('status', 'active').eq('online', true);
  if (othersErr) throw othersErr;
  otherOnlineDriverIds = (others ?? []).map((d) => d.id);
  if (otherOnlineDriverIds.length) {
    const { error } = await admin.from('drivers').update({ online: false }).in('id', otherOnlineDriverIds);
    if (error) throw error;
  }

  rider = await createTestUser('rider');
  driverA = await createTestUser('driverA');
  driverB = await createTestUser('driverB');

  const { error: riderErr } = await admin
    .from('riders')
    .insert({ id: rider.id, name: 'راكب اختبار آلي', email: rider.email, username: `rider-test-${Date.now()}` });
  if (riderErr) throw riderErr;
  // phone lives on its own table now (0021), not on riders/drivers directly.
  const { error: riderContactErr } = await admin.from('rider_contacts').insert({ rider_id: rider.id, phone: '0900000001' });
  if (riderContactErr) throw riderContactErr;

  const { error: driverAErr } = await admin.from('drivers').insert({
    id: driverA.id, name: 'سائق اختبار آلي أ', email: driverA.email,
    username: `driverA-test-${Date.now()}`, plate: 'TEST-A', car: 'Test Car', status: 'active',
    online: true, lat: NEAR_POS.lat, lng: NEAR_POS.lng
  });
  if (driverAErr) throw driverAErr;
  const { error: driverAContactErr } = await admin.from('driver_contacts').insert({ driver_id: driverA.id, phone: '0900000002' });
  if (driverAContactErr) throw driverAContactErr;

  const { error: driverBErr } = await admin.from('drivers').insert({
    id: driverB.id, name: 'سائق اختبار آلي ب', email: driverB.email,
    username: `driverB-test-${Date.now()}`, plate: 'TEST-B', car: 'Test Car', status: 'active',
    online: true, lat: FAR_POS.lat, lng: FAR_POS.lng
  });
  if (driverBErr) throw driverBErr;
  const { error: driverBContactErr } = await admin.from('driver_contacts').insert({ driver_id: driverB.id, phone: '0900000003' });
  if (driverBContactErr) throw driverBContactErr;
});

// Force every ride created so far to a terminal state after each test, so a
// ride left "dispatched" or mid-trip by one test can never make driverA/B
// look unavailable to nearest_available_driver() in the next one.
afterEach(async () => {
  if (createdRideIds.length) {
    await admin.from('rides').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).in('id', createdRideIds);
  }
});

afterAll(async () => {
  if (otherOnlineDriverIds.length) {
    const { error } = await admin.from('drivers').update({ online: true }).in('id', otherOnlineDriverIds);
    if (error) throw new Error(`cleanup: failed to restore other drivers online: ${error.message}`);
  }

  // ratings.ride_id -> rides.id has no ON DELETE CASCADE (confirmed against
  // the live schema), so a rated test ride blocks the whole batch delete
  // below unless its rating is removed first. riders/drivers rows are
  // likewise not cascade-deleted when their auth.users row goes -- delete
  // both explicitly rather than assuming either cascade exists.
  if (createdRideIds.length) {
    const { error: ratingsErr } = await admin.from('ratings').delete().in('ride_id', createdRideIds);
    if (ratingsErr) throw new Error(`cleanup: failed to delete ratings: ${ratingsErr.message}`);
    const { error: ridesErr } = await admin.from('rides').delete().in('id', createdRideIds);
    if (ridesErr) throw new Error(`cleanup: failed to delete rides: ${ridesErr.message}`);
  }
  if (createdAuthIds.length) {
    await admin.from('riders').delete().in('id', createdAuthIds);
    await admin.from('drivers').delete().in('id', createdAuthIds);
  }
  for (const id of createdAuthIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`cleanup: failed to delete auth user ${id}: ${error.message}`);
  }
});

async function requestTestRide(riderClient: SupabaseClient, km = 3.2, minutes = 9) {
  const { data, error } = await riderClient.rpc('request_ride', {
    p_pickup_name: PICKUP.name, p_pickup_lat: PICKUP.lat, p_pickup_lng: PICKUP.lng,
    p_dest_name: DEST.name, p_dest_lat: DEST.lat, p_dest_lng: DEST.lng,
    p_km: km, p_minutes: minutes
  });
  if (error) throw error;
  createdRideIds.push(data.id);
  return data;
}

describe('critical path: request -> match -> accept -> trip -> done -> rate', () => {
  it('request_ride auto-matches the nearest online driver and sets status=dispatched', async () => {
    const ride = await requestTestRide(rider.client);
    expect(ride.status).toBe('dispatched');
    expect(ride.driver_id).toBe(driverA.id);
    expect(ride.rider_id).toBe(rider.id);
  });

  it('a driver the ride was not dispatched to cannot accept it', async () => {
    const ride = await requestTestRide(rider.client);
    expect(ride.driver_id).toBe(driverA.id);
    const { data, error } = await driverB.client.rpc('accept_ride', { p_ride_id: ride.id });
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it("accept_ride moves the ride to toPickup and increments the driver's accepted_count", async () => {
    const { data: before } = await admin.from('drivers').select('accepted_count').eq('id', driverA.id).single();
    const ride = await requestTestRide(rider.client);
    const { data: accepted, error } = await driverA.client.rpc('accept_ride', { p_ride_id: ride.id });
    expect(error).toBeNull();
    expect(accepted.status).toBe('toPickup');
    const { data: after } = await admin.from('drivers').select('accepted_count').eq('id', driverA.id).single();
    expect(after!.accepted_count).toBe(before!.accepted_count + 1);
  });

  it('advance_trip walks toPickup -> arrived -> onTrip -> done and computes wait_fare server-side', async () => {
    const ride = await requestTestRide(rider.client);
    await driverA.client.rpc('accept_ride', { p_ride_id: ride.id });

    const { data: arrived } = await driverA.client.rpc('advance_trip', { p_ride_id: ride.id });
    expect(arrived.status).toBe('arrived');

    const { data: onTrip } = await driverA.client.rpc('advance_trip', { p_ride_id: ride.id });
    expect(onTrip.status).toBe('onTrip');

    // client claims 999 wait_runs -- advance_trip must clamp this to 2 itself
    const { data: done } = await driverA.client.rpc('advance_trip', { p_ride_id: ride.id, p_wait_seconds: 600, p_wait_runs: 999 });
    expect(done.status).toBe('done');
    expect(done.wait_runs).toBe(2);
    expect(done.completed_at).not.toBeNull();
    expect(Number(done.wait_fare)).toBeGreaterThan(0);
  });

  it('both rider and driver can rate the same completed ride independently', async () => {
    const ride = await requestTestRide(rider.client);
    await driverA.client.rpc('accept_ride', { p_ride_id: ride.id });
    await driverA.client.rpc('advance_trip', { p_ride_id: ride.id });
    await driverA.client.rpc('advance_trip', { p_ride_id: ride.id });
    await driverA.client.rpc('advance_trip', { p_ride_id: ride.id });

    const { data: riderRating, error: riderErr } = await rider.client.rpc('rate_ride', { p_ride_id: ride.id, p_stars: 5 });
    expect(riderErr).toBeNull();
    expect(riderRating.driver_stars).toBe(5);
    expect(riderRating.rider_stars).toBeNull();

    const { data: driverRating, error: driverErr } = await driverA.client.rpc('rate_ride', { p_ride_id: ride.id, p_stars: 4 });
    expect(driverErr).toBeNull();
    expect(driverRating.driver_stars).toBe(5); // untouched by the driver's own call
    expect(driverRating.rider_stars).toBe(4);
  });
});

describe('rejection and reassignment', () => {
  it('reject_ride reassigns to the next-nearest driver and increments rejected_count', async () => {
    const { data: before } = await admin.from('drivers').select('rejected_count').eq('id', driverA.id).single();
    const ride = await requestTestRide(rider.client);
    expect(ride.driver_id).toBe(driverA.id);

    const { data: rejected, error } = await driverA.client.rpc('reject_ride', { p_ride_id: ride.id });
    expect(error).toBeNull();
    expect(rejected.status).toBe('dispatched');
    expect(rejected.driver_id).toBe(driverB.id);
    expect(rejected.declined_driver_ids).toContain(driverA.id);

    const { data: after } = await admin.from('drivers').select('rejected_count').eq('id', driverA.id).single();
    expect(after!.rejected_count).toBe(before!.rejected_count + 1);
  });

  it('falls back to searching once every online driver has declined', async () => {
    const ride = await requestTestRide(rider.client);
    await driverA.client.rpc('reject_ride', { p_ride_id: ride.id });
    const { data: final, error } = await driverB.client.rpc('reject_ride', { p_ride_id: ride.id });
    expect(error).toBeNull();
    expect(final.status).toBe('searching');
    expect(final.driver_id).toBeNull();
  });
});

describe('security invariants (regression protection for migrations 0010 and 0013)', () => {
  it('a driver cannot advance a ride that is not assigned to them', async () => {
    const ride = await requestTestRide(rider.client);
    await driverA.client.rpc('accept_ride', { p_ride_id: ride.id });
    const { data, error } = await driverB.client.rpc('advance_trip', { p_ride_id: ride.id });
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it('a rider cannot cancel a ride that is not their own', async () => {
    const otherRider = await createTestUser('rider-other');
    const ride = await requestTestRide(rider.client);
    const { data, error } = await otherRider.client.rpc('cancel_ride', { p_ride_id: ride.id });
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it('a direct INSERT into ratings is rejected -- rate_ride is the only write path', async () => {
    const ride = await requestTestRide(rider.client);
    await driverA.client.rpc('accept_ride', { p_ride_id: ride.id });
    await driverA.client.rpc('advance_trip', { p_ride_id: ride.id });
    await driverA.client.rpc('advance_trip', { p_ride_id: ride.id });
    await driverA.client.rpc('advance_trip', { p_ride_id: ride.id });

    const { data, error } = await rider.client
      .from('ratings')
      .insert({ ride_id: ride.id, rider_id: rider.id, driver_id: driverA.id, driver_stars: 5 })
      .select();
    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });

  it('a driver cannot self-elevate accepted_count via a raw UPDATE', async () => {
    const { error } = await driverA.client.from('drivers').update({ accepted_count: 99999 }).eq('id', driverA.id);
    expect(error).toBeTruthy();
    const { data: unchanged } = await admin.from('drivers').select('accepted_count').eq('id', driverA.id).single();
    expect(unchanged!.accepted_count).not.toBe(99999);
  });

  it('a driver cannot self-set their own status via a raw UPDATE', async () => {
    const { error } = await driverA.client.from('drivers').update({ status: 'suspended' }).eq('id', driverA.id);
    expect(error).toBeTruthy();
    const { data: unchanged } = await admin.from('drivers').select('status').eq('id', driverA.id).single();
    expect(unchanged!.status).toBe('active');
  });

  it('request_ride computes fare_amount server-side from live pricing, ignoring any client-claimed fare (migration 0015)', async () => {
    const { data: settings, error: settingsErr } = await admin.from('pricing_settings').select('active_currency').eq('id', true).single();
    if (settingsErr) throw settingsErr;
    const { data: pricing, error: pricingErr } = await admin.from('pricing').select('*').eq('currency', settings!.active_currency).single();
    if (pricingErr) throw pricingErr;

    const km = 3.2;
    const minutes = 9;
    const raw = pricing!.base + pricing!.per_km * km + pricing!.per_min * minutes;
    const step = pricing!.round_to || 1;
    const expectedFare = Math.round(Math.max(pricing!.min_fare, raw) / step) * step;

    const ride = await requestTestRide(rider.client, km, minutes);
    expect(ride.fare_currency).toBe(settings!.active_currency);
    expect(Number(ride.fare_amount)).toBe(expectedFare);
  });

  it('request_ride rejects a claimed km smaller than the real straight-line pickup-to-destination distance', async () => {
    // PICKUP -> DEST is ~1.05km apart in a straight line; 0.1km is not
    // achievable by any real road route between them.
    const { data, error } = await rider.client.rpc('request_ride', {
      p_pickup_name: PICKUP.name, p_pickup_lat: PICKUP.lat, p_pickup_lng: PICKUP.lng,
      p_dest_name: DEST.name, p_dest_lat: DEST.lat, p_dest_lng: DEST.lng,
      p_km: 0.1, p_minutes: 9
    });
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});

describe('stale ride sweep (migration 0017)', () => {
  it('nearest_available_driver ignores a dispatched offer past its 20s window when matching new rides', async () => {
    const ride1 = await requestTestRide(rider.client);
    expect(ride1.driver_id).toBe(driverA.id);
    const staleTime = new Date(Date.now() - 25_000).toISOString();
    const { error: backdateErr } = await admin.from('rides').update({ dispatched_at: staleTime }).eq('id', ride1.id);
    if (backdateErr) throw backdateErr;

    // Before migration 0017, driverA's stale-but-still-'dispatched' ride1
    // would keep them "busy" forever from nearest_available_driver's point
    // of view, so ride2 would go to driverB (or nowhere) instead.
    const ride2 = await requestTestRide(rider.client);
    expect(ride2.driver_id).toBe(driverA.id);
  });

  it('sweep_stale_rides reassigns an expired dispatched offer to the next-nearest driver', async () => {
    const ride = await requestTestRide(rider.client);
    expect(ride.driver_id).toBe(driverA.id);
    const staleTime = new Date(Date.now() - 25_000).toISOString();
    await admin.from('rides').update({ dispatched_at: staleTime }).eq('id', ride.id);

    const { error: sweepErr } = await admin.rpc('sweep_stale_rides');
    expect(sweepErr).toBeNull();

    const { data: after } = await admin.from('rides').select('*').eq('id', ride.id).single();
    expect(after!.status).toBe('dispatched');
    expect(after!.driver_id).toBe(driverB.id);
    expect(after!.declined_driver_ids).toContain(driverA.id);
  });

  it('sweep_stale_rides retries matching a searching ride once a driver becomes available', async () => {
    try {
      await admin.from('drivers').update({ online: false }).in('id', [driverA.id, driverB.id]);
      const ride = await requestTestRide(rider.client);
      expect(ride.status).toBe('searching');
      expect(ride.driver_id).toBeNull();

      await admin.from('drivers').update({ online: true }).eq('id', driverA.id);
      const { error: sweepErr } = await admin.rpc('sweep_stale_rides');
      expect(sweepErr).toBeNull();

      const { data: after } = await admin.from('rides').select('*').eq('id', ride.id).single();
      expect(after!.status).toBe('dispatched');
      expect(after!.driver_id).toBe(driverA.id);
    } finally {
      await admin.from('drivers').update({ online: true }).in('id', [driverA.id, driverB.id]);
    }
  });

  it('sweep_stale_rides gives up on a ride nobody has picked up after 5 minutes', async () => {
    const ride = await requestTestRide(rider.client);
    const longAgo = new Date(Date.now() - 6 * 60_000).toISOString();
    await admin.from('rides').update({ requested_at: longAgo }).eq('id', ride.id);

    const { error: sweepErr } = await admin.rpc('sweep_stale_rides');
    expect(sweepErr).toBeNull();

    const { data: after } = await admin.from('rides').select('*').eq('id', ride.id).single();
    expect(after!.status).toBe('cancelled');
    expect(after!.cancelled_at).not.toBeNull();
  });
});
