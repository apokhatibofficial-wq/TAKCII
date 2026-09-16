// Real map data for TAK-C.TAXI — OpenStreetMap (Overpass) + real road routing (OSRM).
// Ported from osm.js. Distance/route caching now lives at the call site (Stage 3 —
// the prototype's localStorage cache is replaced by the shared `places` table plus
// whatever offline strategy the rider app's service worker applies).

export interface AreaDef {
  key: string;
  name: string;
  bbox: [number, number, number, number]; // S, W, N, E
}

export const AREAS: Record<string, AreaDef> = {
  dana: { key: 'dana', name: 'الدانا', bbox: [36.195, 36.735, 36.24, 36.79] },
  sarmada: { key: 'sarmada', name: 'سرمدا', bbox: [36.165, 36.69, 36.21, 36.755] }
};
export const BBOX_ALL: [number, number, number, number] = [36.165, 36.69, 36.24, 36.79];

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';

const HW = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian';

const KIND: Record<string, string> = {
  motorway: 'طريق سريع', trunk: 'طريق رئيسي', primary: 'شارع رئيسي', secondary: 'شارع فرعي',
  tertiary: 'شارع فرعي', unclassified: 'شارع', residential: 'شارع سكني', living_street: 'شارع سكني', pedestrian: 'ممشى',
  hospital: 'مشفى', clinic: 'عيادة', pharmacy: 'صيدلية', school: 'مدرسة', university: 'جامعة',
  marketplace: 'سوق', bus_station: 'كراج', fuel: 'محطة وقود', place_of_worship: 'جامع', townhall: 'بلدية', police: 'مخفر',
  supermarket: 'سوبرماركت', bus_stop: 'موقف', city: 'مدينة', town: 'بلدة', village: 'قرية',
  neighbourhood: 'حي', suburb: 'حي', quarter: 'حي', hamlet: 'مزرعة'
};

export interface OsmPlace {
  id: string;
  name: string;
  area: string;
  kind: string;
  lat: number;
  lng: number;
  source: 'osm';
}

export interface StreetsPayload {
  updatedAt: number;
  count: number;
  places: OsmPlace[];
}

function areaOf(lat: number, lng: number): string {
  for (const a of Object.values(AREAS)) {
    const [s, w, n, e] = a.bbox;
    if (lat >= s && lat <= n && lng >= w && lng <= e) return a.name;
  }
  return 'ريف إدلب';
}

/** Download every named street/place in Dana + Sarmada from live OpenStreetMap. Admin-triggered only. */
export async function fetchStreets(onProgress?: (msg: string) => void): Promise<StreetsPayload> {
  const [s, w, n, e] = BBOX_ALL;
  const q = `[out:json][timeout:90];
(
  way["highway"~"^(${HW})$"]["name"](${s},${w},${n},${e});
  node["place"~"^(city|town|village|neighbourhood|suburb|quarter|hamlet)$"]["name"](${s},${w},${n},${e});
  node["amenity"~"^(hospital|clinic|pharmacy|school|university|marketplace|bus_station|fuel|place_of_worship|townhall|police)$"]["name"](${s},${w},${n},${e});
  way["amenity"~"^(hospital|marketplace|bus_station|school|university)$"]["name"](${s},${w},${n},${e});
  node["shop"="supermarket"]["name"](${s},${w},${n},${e});
  node["highway"="bus_stop"]["name"](${s},${w},${n},${e});
);
out tags center;`;

  let data: OverpassResponse | null = null;
  let lastErr: unknown = null;
  for (const url of OVERPASS) {
    try {
      onProgress?.('نتصل بخادم OpenStreetMap…');
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = (await res.json()) as OverpassResponse;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!data) throw lastErr ?? new Error('تعذّر الوصول إلى خادم الخرائط');

  const seen = new Set<string>();
  const out: OsmPlace[] = [];
  for (const el of data.elements ?? []) {
    const t = el.tags ?? {};
    const name = t['name:ar'] || t.name;
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const key = name + '|' + lat.toFixed(3) + '|' + lng.toFixed(3);
    if (seen.has(key)) continue;
    seen.add(key);
    const kindTag = t.highway === 'bus_stop' ? 'bus_stop' : t.place || t.amenity || t.shop || t.highway;
    out.push({
      id: 'osm' + el.type[0] + el.id,
      name,
      area: areaOf(lat, lng),
      kind: (kindTag && KIND[kindTag]) || 'مكان',
      lat,
      lng,
      source: 'osm'
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return { updatedAt: Date.now(), count: out.length, places: out };
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
interface OverpassResponse {
  elements?: OverpassElement[];
}

export const haversineKm = (a: [number, number], b: [number, number]): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

export interface RouteResult {
  km: number;
  minutes: number;
  geometry: [number, number][];
  estimated: boolean;
}

/** Real driving distance + duration along the road network (OSRM). */
export async function drivingRoute(a: [number, number], b: [number, number]): Promise<RouteResult> {
  const url = `${OSRM}${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const r = j.routes?.[0];
  if (!r) throw new Error('لا يوجد مسار');
  return {
    km: r.distance / 1000,
    minutes: r.duration / 60,
    geometry: (r.geometry?.coordinates ?? []).map((c: [number, number]) => [c[1], c[0]] as [number, number]),
    estimated: false
  };
}

/** Never blocks the UI: falls back to a road-factor estimate when the router is unreachable. */
export async function distanceOrEstimate(a: [number, number], b: [number, number]): Promise<RouteResult> {
  try {
    return await drivingRoute(a, b);
  } catch {
    const km = haversineKm(a, b) * 1.32; // typical street-network detour factor
    return { km, minutes: (km / 28) * 60, geometry: [a, b], estimated: true };
  }
}

interface NominatimReverse {
  display_name?: string;
  address?: Record<string, string>;
}

/** Labels a point the user picked directly on the map. Never throws — a
 * generic label is fine, this is just for display, not matching. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ar`;
    // Nominatim's usage policy rejects requests with no app-identifying
    // User-Agent or Referer (a generic script UA gets a 403). Browsers
    // silently drop a JS-set User-Agent and send their own — that plus the
    // page's own Referer already satisfies the policy there; this header
    // only actually matters for non-browser callers.
    const res = await fetch(url, { headers: { 'Accept-Language': 'ar', 'User-Agent': 'TAK-C.TAXI (tak-c.taxi)' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = (await res.json()) as NominatimReverse;
    const a = j.address ?? {};
    return a.road || a.suburb || a.village || a.town || a.neighbourhood || j.display_name || 'الموقع المحدد على الخريطة';
  } catch {
    return 'الموقع المحدد على الخريطة';
  }
}
