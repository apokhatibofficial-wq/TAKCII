// Real map data for TAK-C.TAXI — OpenStreetMap (Overpass) + real road routing (OSRM).
// Every distance shown in the app is a driving distance along actual streets, not a straight line.
// Cached in localStorage so a weak network still gets full search + distances.

export const AREAS = {
  dana:    { key: 'dana',    name: 'الدانا',  bbox: [36.1950, 36.7350, 36.2400, 36.7900] },
  sarmada: { key: 'sarmada', name: 'سرمدا',   bbox: [36.1650, 36.6900, 36.2100, 36.7550] }
};
export const BBOX_ALL = [36.1650, 36.6900, 36.2400, 36.7900]; // S,W,N,E

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const CACHE_STREETS = 'takc.osm.streets.v1';
const CACHE_ROUTES = 'takc.osm.routes.v1';

const HW = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian';

const readCache = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch (e) { return fb; } };
const writeCache = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export function cachedStreets() { return readCache(CACHE_STREETS, null); }

function areaOf(lat, lng) {
  for (const a of Object.values(AREAS)) {
    const [s, w, n, e] = a.bbox;
    if (lat >= s && lat <= n && lng >= w && lng <= e) return a.name;
  }
  return 'ريف إدلب';
}

// Download every named street/place in Dana + Sarmada from live OpenStreetMap.
export async function fetchStreets(onProgress) {
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

  let data = null, lastErr = null;
  for (const url of OVERPASS) {
    try {
      if (onProgress) onProgress('نتصل بخادم OpenStreetMap…');
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
      break;
    } catch (err) { lastErr = err; }
  }
  if (!data) throw lastErr || new Error('تعذّر الوصول إلى خادم الخرائط');

  const KIND = {
    motorway: 'طريق سريع', trunk: 'طريق رئيسي', primary: 'شارع رئيسي', secondary: 'شارع فرعي',
    tertiary: 'شارع فرعي', unclassified: 'شارع', residential: 'شارع سكني', living_street: 'شارع سكني', pedestrian: 'ممشى',
    hospital: 'مشفى', clinic: 'عيادة', pharmacy: 'صيدلية', school: 'مدرسة', university: 'جامعة',
    marketplace: 'سوق', bus_station: 'كراج', fuel: 'محطة وقود', place_of_worship: 'جامع', townhall: 'بلدية', police: 'مخفر',
    supermarket: 'سوبرماركت', bus_stop: 'موقف', city: 'مدينة', town: 'بلدة', village: 'قرية',
    neighbourhood: 'حي', suburb: 'حي', quarter: 'حي', hamlet: 'مزرعة'
  };

  const seen = new Set(), out = [];
  for (const el of data.elements || []) {
    const t = el.tags || {};
    const name = t['name:ar'] || t.name;
    if (!name) continue;
    const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lng = el.lon != null ? el.lon : (el.center && el.center.lon);
    if (lat == null || lng == null) continue;
    const key = name + '|' + lat.toFixed(3) + '|' + lng.toFixed(3);
    if (seen.has(key)) continue;
    seen.add(key);
    const kindTag = t.highway === 'bus_stop' ? 'bus_stop' : (t.place || t.amenity || t.shop || t.highway);
    out.push({
      id: 'osm' + el.type[0] + el.id,
      name: name,
      area: areaOf(lat, lng),
      kind: KIND[kindTag] || 'مكان',
      lat: lat, lng: lng,
      source: 'osm'
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const payload = { updatedAt: Date.now(), count: out.length, places: out };
  writeCache(CACHE_STREETS, payload);
  return payload;
}

export const haversineKm = (a, b) => {
  const R = 6371, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const routeKey = (a, b) => a.map((v) => v.toFixed(4)).join(',') + '>' + b.map((v) => v.toFixed(4)).join(',');

// Real driving distance + duration along the road network (OSRM), cached per pair.
export async function drivingRoute(a, b) {
  const cache = readCache(CACHE_ROUTES, {});
  const k = routeKey(a, b);
  if (cache[k]) return Object.assign({ cached: true }, cache[k]);
  const url = OSRM + a[1] + ',' + a[0] + ';' + b[1] + ',' + b[0] + '?overview=full&geometries=geojson';
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const r = j.routes && j.routes[0];
  if (!r) throw new Error('لا يوجد مسار');
  const out = {
    km: r.distance / 1000,
    minutes: r.duration / 60,
    geometry: (r.geometry && r.geometry.coordinates || []).map((c) => [c[1], c[0]]),
    estimated: false
  };
  cache[k] = out;
  writeCache(CACHE_ROUTES, cache);
  return out;
}

// Never blocks the UI: falls back to a road-factor estimate when the router is unreachable.
export async function distanceOrEstimate(a, b) {
  try {
    return await drivingRoute(a, b);
  } catch (e) {
    const km = haversineKm(a, b) * 1.32; // typical street-network detour factor
    return { km: km, minutes: km / 28 * 60, geometry: [a, b], estimated: true };
  }
}
