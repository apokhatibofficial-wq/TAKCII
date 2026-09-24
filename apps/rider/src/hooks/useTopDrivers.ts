import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface TopDriver {
  id: string;
  name: string;
  selfieUrl: string | null;
  avgRating: number;
  ratingsCount: number;
}

// Shown before the rider types a destination, in the slot the old
// quick-pick-places row used to occupy -- a simple, informational "these
// are our best drivers" row (not a request-this-driver flow; dispatch still
// assigns nearest-available). Backed by the top_rated_drivers() RPC, which
// only ever returns name/photo/rating -- no phone, plate, or location.
export function useTopDrivers() {
  const [drivers, setDrivers] = useState<TopDriver[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('top_rated_drivers', { p_limit: 8 })
      .then(({ data }) => {
        if (!cancelled && data) {
          setDrivers(
            data.map((d) => ({
              id: d.id,
              name: d.name,
              selfieUrl: d.selfie_url,
              avgRating: Number(d.avg_rating),
              ratingsCount: Number(d.ratings_count)
            }))
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return drivers;
}
