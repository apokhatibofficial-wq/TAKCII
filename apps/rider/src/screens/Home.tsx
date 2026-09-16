import { useMemo, useState, type CSSProperties } from 'react';
import MapView, { type MapMarker } from '../components/MapView';
import RidePanel from '../components/RidePanel';
import AdOverlay from '../components/AdOverlay';
import { usePlacesSearch, type SearchPlace } from '../hooks/usePlacesSearch';
import { useFare } from '../hooks/useFare';
import { useRide } from '../hooks/useRide';
import { useActiveAd } from '../hooks/useActiveAd';
import { distanceOrEstimate, reverseGeocode, type RouteResult } from '@takc/shared';

interface Pickup {
  lat: number;
  lng: number;
  name: string;
}

// Default matches the prototype's seed pickup (ساحة الدانا الرئيسية) so the
// screen is meaningful before GPS permission is granted.
const DEFAULT_PICKUP: Pickup = { lat: 36.2112, lng: 36.759, name: 'ساحة الدانا الرئيسية' };

// Ported from index.html's uHome block: map + top bar + bottom sheet. The
// sheet shows the search/pricing UI (stIdle) when there's no active ride, and
// hands off to RidePanel (stSearching/stMatched/stDone) once one exists.
export default function Home() {
  const [pickup, setPickup] = useState<Pickup>(DEFAULT_PICKUP);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [dest, setDest] = useState<SearchPlace | null>(null);
  const [manualRoute, setManualRoute] = useState<RouteResult | null>(null);
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [adDismissed, setAdDismissed] = useState(false);
  const ad = useActiveAd();

  const from = useMemo<[number, number]>(() => [pickup.lat, pickup.lng], [pickup.lat, pickup.lng]);
  const { results, routes } = usePlacesSearch(from, query);
  const { format, fareFor, pricing, settings } = useFare();
  const { ride, requestRide, cancelRide, resetRide } = useRide();

  // Points picked on the map aren't in the places list, so they have no
  // entry in usePlacesSearch's route cache — measured separately below.
  const destRoute = dest ? (routes[dest.id] ?? manualRoute) : null;
  const noResults = query.trim().length > 0 && results.length === 0;

  const selectDest = (place: SearchPlace) => {
    setDest(place);
    setManualRoute(null);
    setQuery('');
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (!pickingOnMap) return;
    setPickingOnMap(false);
    setGeocoding(true);
    const [name, route] = await Promise.all([reverseGeocode(lat, lng), distanceOrEstimate(from, [lat, lng])]);
    setDest({ id: `map:${lat},${lng}`, name, area: '', kind: null, lat, lng });
    setManualRoute(route);
    setQuery('');
    setGeocoding(false);
  };

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [{ id: 'me', lat: pickup.lat, lng: pickup.lng, kind: 'me', title: 'موقعك' }];
    if (dest) list.push({ id: 'dest', lat: dest.lat, lng: dest.lng, kind: 'dest', title: dest.name });
    return list;
  }, [pickup, dest]);

  // A single getCurrentPosition call often resolves with whatever fix is
  // available first (frequently a coarse network/Wi-Fi estimate, off by
  // hundreds of meters) rather than waiting for GPS to lock. watchPosition
  // keeps listening and tracks the best (lowest accuracy radius) reading
  // seen, resolving early once it's genuinely good or after a longer
  // timeout otherwise — this is what "دقة عالية جداً" needs in practice.
  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    let best: GeolocationPosition | null = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(maxTimer);
      if (best) setPickup({ lat: best.coords.latitude, lng: best.coords.longitude, name: 'موقعك الحالي' });
      setLocating(false);
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        if (pos.coords.accuracy <= 20) finish();
      },
      () => finish(),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    const maxTimer = setTimeout(finish, 15000);
  };

  const fare = dest && destRoute ? fareFor(destRoute.km, destRoute.minutes) : null;
  const fareVisible = settings?.showToRiders !== false;

  const doRequestRide = async () => {
    if (!dest || !destRoute || fare == null || !pricing) return;
    setRequesting(true);
    try {
      await requestRide({
        pickupName: pickup.name,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destName: dest.name,
        destLat: dest.lat,
        destLng: dest.lng,
        km: destRoute.km,
        minutes: destRoute.minutes,
        fareAmount: fare,
        fareCurrency: pricing.currency
      });
      setDest(null);
      setManualRoute(null);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <>
      {ad && !adDismissed && <AdOverlay ad={ad} onClose={() => setAdDismissed(true)} />}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, cursor: pickingOnMap ? 'crosshair' : undefined }}>
        <MapView markers={markers} routeGeometry={destRoute?.geometry ?? null} onMapClick={handleMapClick} />
      </div>

      {pickingOnMap && (
        <div style={pickBannerStyle}>
          <span style={{ flex: 1 }}>اضغط في أي مكان على الخريطة لتحديد الموقع</span>
          <button onClick={() => setPickingOnMap(false)} style={pickCancelStyle}>إلغاء</button>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', gap: 8, padding: 12 }}>
        <div
          style={{
            flex: 1,
            background: '#fff',
            borderRadius: 13,
            boxShadow: '0 6px 18px -8px rgba(24,22,25,.5)',
            padding: '9px 13px',
            font: "600 12.5px/1.4 'IBM Plex Sans Arabic',sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-green)', flex: 'none' }} />
          <span style={{ color: '#575757', flex: 'none' }}>موقعك:</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickup.name}</span>
        </div>
        <button onClick={locateMe} disabled={locating} style={roundBtnStyle}>
          {locating ? '…' : '◎'}
        </button>
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          position: 'relative',
          zIndex: 6,
          background: '#fff',
          borderRadius: '26px 26px 0 0',
          boxShadow: '0 -14px 40px -22px rgba(24,22,25,.7)',
          padding: pickingOnMap ? 0 : '14px 18px 20px',
          maxHeight: pickingOnMap ? 0 : '68%',
          overflow: pickingOnMap ? 'hidden' : 'auto',
          transition: 'max-height .2s ease, padding .2s ease'
        }}
      >
        <div style={{ width: 44, height: 4, borderRadius: 4, background: '#e2dcca', margin: '0 auto 14px' }} />

        {ride ? (
          <RidePanel ride={ride} onCancel={cancelRide} onReset={resetRide} />
        ) : (
          <>
            <div style={{ font: "800 18px/1.2 FreePalestine,Tajawal,sans-serif", marginBottom: 12 }}>إلى أين تريد الذهاب؟</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                background: '#faf8f2',
                border: '1.5px solid #e7e1d0',
                borderRadius: 14,
                padding: '12px 13px'
              }}
            >
              <span style={{ color: '#575757' }}>⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="اكتب اسم المنطقة أو الشارع"
                style={{ flex: 1, border: 'none', background: 'none', fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
              {results.map((r) => {
                const route = routes[r.id];
                const distLabel = route
                  ? `${route.km.toFixed(1)} كم · ${Math.max(1, Math.round(route.minutes))} د${route.estimated ? ' (تقديري)' : ' بالسيارة'}`
                  : '… قياس المسار';
                return (
                  <button key={r.id} onClick={() => selectDest(r)} style={resultRowStyle}
                  >
                    <span style={resultIconStyle}>◎</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', font: "700 13.5px/1.3 'IBM Plex Sans Arabic',sans-serif" }}>{r.name}</span>
                      <span style={{ display: 'block', font: "400 11.5px/1.4 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
                        {(r.kind ? r.kind + ' · ' : '') + r.area} · {distLabel}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {noResults && (
              <div style={noResultsStyle}>
                <span>لم نجد نتائج مطابقة</span>
                <button
                  onClick={() => {
                    setPickingOnMap(true);
                    setQuery('');
                  }}
                  style={pickOnMapLinkStyle}
                >
                  تحديد الموقع على الخريطة
                </button>
              </div>
            )}

            {geocoding && <div style={noResultsStyle}>جارٍ تحديد اسم الموقع…</div>}

            {dest && (
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'var(--color-cream)',
                  borderRadius: 14,
                  padding: '12px 13px'
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--color-black)', flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', font: "700 13.5px/1.35 'IBM Plex Sans Arabic',sans-serif" }}>{dest.name}</span>
                  {dest.area && (
                    <span style={{ display: 'block', font: "500 11.5px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
                      {dest.area}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => {
                    setDest(null);
                    setManualRoute(null);
                  }}
                  style={{ background: 'none', border: 'none', color: '#575757', cursor: 'pointer', fontSize: 15 }}
                >
                  ✕
                </button>
              </div>
            )}

            {dest && fareVisible && fare != null && (
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--color-black)',
                  color: 'var(--color-cream)',
                  borderRadius: 16,
                  padding: '14px 15px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 11.5px/1.5 'IBM Plex Sans Arabic',sans-serif", color: 'rgba(244,239,225,.65)' }}>
                    السعر التقريبي للرحلة
                  </div>
                </div>
                <div style={{ font: "900 22px/1.35 FreePalestine,Tajawal,sans-serif", color: 'var(--color-yellow)', direction: 'ltr', flex: 'none' }}>
                  {format(fare)}
                </div>
              </div>
            )}

            {dest && fare == null && (
              <div style={{ marginTop: 10, textAlign: 'center', font: "500 12px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#8b8b8b' }}>
                جارٍ حساب السعر…
              </div>
            )}

            <button
              onClick={doRequestRide}
              disabled={!dest || !destRoute || fare == null || !pricing || requesting}
              style={{
                ...requestBtnStyle,
                opacity: dest && destRoute && fare != null && pricing && !requesting ? 1 : 0.5,
                cursor: dest && destRoute && fare != null && pricing && !requesting ? 'pointer' : 'not-allowed'
              }}
            >
              {requesting ? '...جارٍ الطلب' : 'اطلب تكسي الآن'}
            </button>
          </>
        )}
      </div>
      </div>
    </>
  );
}

const roundBtnStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 13,
  background: '#fff',
  border: '1px solid rgba(24,22,25,.1)',
  boxShadow: '0 6px 18px -8px rgba(24,22,25,.5)',
  fontSize: 14,
  cursor: 'pointer'
};

const pickBannerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 5,
  margin: '0 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'var(--color-black)',
  color: 'var(--color-cream)',
  borderRadius: 13,
  padding: '11px 13px',
  font: "600 12.5px/1.4 'IBM Plex Sans Arabic',sans-serif"
};

const pickCancelStyle: CSSProperties = {
  border: '1px solid rgba(244,239,225,.3)',
  borderRadius: 9,
  background: 'none',
  color: 'var(--color-cream)',
  padding: '6px 10px',
  font: "700 11.5px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};

const noResultsStyle: CSSProperties = {
  marginTop: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '18px 10px',
  textAlign: 'center',
  font: "500 12.5px/1.6 'IBM Plex Sans Arabic',sans-serif",
  color: '#8b8b8b'
};

const pickOnMapLinkStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  color: 'var(--color-green)',
  font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer',
  textDecoration: 'underline'
};

const resultRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  width: '100%',
  textAlign: 'right',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid #f2eee2',
  padding: '12px 4px',
  cursor: 'pointer'
};

const resultIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 11,
  background: 'var(--color-cream)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 14,
  flex: 'none'
};

const requestBtnStyle: CSSProperties = {
  width: '100%',
  marginTop: 14,
  padding: 16,
  border: 'none',
  borderRadius: 16,
  background: 'var(--color-black)',
  color: 'var(--color-yellow)',
  font: "800 15px/1.35 Tajawal,sans-serif"
};
