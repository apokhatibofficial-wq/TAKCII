import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { distanceOrEstimate, type RouteResult } from '@takc/shared';

export interface SearchPlace {
  id: string;
  name: string;
  area: string;
  kind: string | null;
  lat: number;
  lng: number;
  imageUrl: string | null;
}

// Ported from index.html's `results` computation in renderVals(): filters the
// place list client-side, then lazily measures real driving distance (OSRM)
// for whatever is on screen, caching each pair so re-renders don't re-fetch.
export function usePlacesSearch(from: [number, number] | null, query: string) {
  const [places, setPlaces] = useState<SearchPlace[]>([]);
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('places')
      .select('id,name,area,kind,lat,lng,image_url')
      .then(({ data }) => {
        if (!cancelled && data) setPlaces(data.map((p) => ({ ...p, imageUrl: p.image_url })));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return places.filter((p) => (p.name + ' ' + p.area).includes(q)).slice(0, 8);
  }, [places, query]);

  // Places an admin bothered to add an icon/photo for are the ones worth
  // surfacing before the rider types anything -- a quick-pick row so
  // choosing a common destination doesn't need typing its name at all.
  const featured = useMemo(() => places.filter((p) => p.imageUrl), [places]);

  useEffect(() => {
    if (!from) return;
    for (const p of results) {
      if (routes[p.id] || inFlight.current.has(p.id)) continue;
      inFlight.current.add(p.id);
      distanceOrEstimate(from, [p.lat, p.lng]).then((r) => {
        inFlight.current.delete(p.id);
        setRoutes((prev) => ({ ...prev, [p.id]: r }));
      });
    }
  }, [results, from, routes]);

  return { results, routes, featured };
}
