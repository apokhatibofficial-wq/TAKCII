import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { rowToCamel, type CurrencyCode, type Database, type Ride, type RideStatus } from '@takc/shared';

interface RequestParams {
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  destName: string;
  destLat: number;
  destLng: number;
  km: number;
  minutes: number;
  fareAmount: number;
  fareCurrency: CurrencyCode;
}

const DEMO_ADVANCE: Partial<Record<RideStatus, RideStatus>> = { toPickup: 'arrived', arrived: 'onTrip', onTrip: 'done' };

export function useRide() {
  const [ride, setRide] = useState<Ride | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subscribeToRide = useCallback((rideId: string) => {
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`ride:${rideId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` }, (payload) => {
        setRide(rowToCamel<Ride>(payload.new as Record<string, unknown>));
      })
      .subscribe();
  }, []);

  const requestRide = useCallback(
    async (p: RequestParams) => {
      const { data, error } = await supabase.rpc('request_ride', {
        p_pickup_name: p.pickupName,
        p_pickup_lat: p.pickupLat,
        p_pickup_lng: p.pickupLng,
        p_dest_name: p.destName,
        p_dest_lat: p.destLat,
        p_dest_lng: p.destLng,
        p_km: p.km,
        p_minutes: p.minutes,
        p_fare_amount: p.fareAmount,
        p_fare_currency: p.fareCurrency
      });
      if (error || !data) throw error ?? new Error('request_ride returned no row');
      const r = rowToCamel<Ride>(data);
      setRide(r);
      subscribeToRide(r.id);
      return r;
    },
    [subscribeToRide]
  );

  // TEMPORARY for Stage 4 (no driver app yet): advances the trip on a timer
  // so the flow is demoable end-to-end today. The rider side only ever reacts
  // to ride.status via Realtime, so Stage 5's real driver-triggered updates
  // drop in without touching anything here except deleting this effect.
  useEffect(() => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    if (!ride) return;
    const next = DEMO_ADVANCE[ride.status];
    if (!next) return;
    demoTimerRef.current = setTimeout(async () => {
      const patch: Database['public']['Tables']['rides']['Update'] = { status: next };
      if (next === 'arrived') patch.arrived_at = new Date().toISOString();
      if (next === 'onTrip') patch.started_at = new Date().toISOString();
      if (next === 'done') patch.completed_at = new Date().toISOString();
      await supabase.from('rides').update(patch).eq('id', ride.id);
    }, 6000);
    return () => {
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    };
  }, [ride]);

  const cancelRide = useCallback(async () => {
    if (!ride) return;
    await supabase.from('rides').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', ride.id);
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setRide(null);
  }, [ride]);

  const resetRide = useCallback(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setRide(null);
  }, []);

  useEffect(
    () => () => {
      channelRef.current?.unsubscribe();
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    },
    []
  );

  return { ride, requestRide, cancelRide, resetRide };
}
