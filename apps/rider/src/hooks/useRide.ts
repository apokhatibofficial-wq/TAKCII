import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifyRideChange, rowToCamel, type CurrencyCode, type Ride } from '@takc/shared';

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

export function useRide() {
  const [ride, setRide] = useState<Ride | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
      notifyRideChange(supabase, r.id);
      return r;
    },
    [subscribeToRide]
  );

  const cancelRide = useCallback(async () => {
    if (!ride) return;
    await supabase.rpc('cancel_ride', { p_ride_id: ride.id });
    notifyRideChange(supabase, ride.id);
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setRide(null);
  }, [ride]);

  const resetRide = useCallback(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setRide(null);
  }, []);

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  return { ride, requestRide, cancelRide, resetRide };
}
