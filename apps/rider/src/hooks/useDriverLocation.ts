import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface DriverLocation {
  lat: number;
  lng: number;
}

// "riders view matched driver" (0003_stage4_rides.sql) already opens the
// full driver row — lat/lng included — once the ride reaches toPickup, so
// this needs no new policy, just a realtime subscription on top of the
// one-shot fetch RidePanel already does for name/car/plate/phone.
export function useDriverLocation(driverId: string | null): DriverLocation | null {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setLocation(null);
    if (!driverId) return;

    let cancelled = false;
    supabase
      .from('drivers')
      .select('lat,lng')
      .eq('id', driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.lat != null && data.lng != null) setLocation({ lat: data.lat, lng: data.lng });
      });

    channelRef.current = supabase
      .channel(`driver-location:${driverId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` }, (payload) => {
        const row = payload.new as { lat: number | null; lng: number | null };
        if (row.lat != null && row.lng != null) setLocation({ lat: row.lat, lng: row.lng });
      })
      .subscribe();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [driverId]);

  return location;
}
