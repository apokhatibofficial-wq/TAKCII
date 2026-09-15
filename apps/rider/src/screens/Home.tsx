import { useMemo, useState, type CSSProperties } from 'react';
import MapView, { type MapMarker } from '../components/MapView';
import { usePlacesSearch } from '../hooks/usePlacesSearch';
import { useFare } from '../hooks/useFare';

interface Pickup {
  lat: number;
  lng: number;
  name: string;
}

// Default matches the prototype's seed pickup (ساحة الدانا الرئيسية) so the
// screen is meaningful before GPS permission is granted.
const DEFAULT_PICKUP: Pickup = { lat: 36.2112, lng: 36.759, name: 'ساحة الدانا الرئيسية' };

interface HomeProps {
  onRequestRide: (destId: string, destName: string, pickup: Pickup) => void;
}

// Ported from index.html's uHome / stIdle block: map + top bar + bottom sheet
// with search, results (real OSRM distance), selected destination, and a live
// fare estimate. Ride-request wiring (searching/matched/trip) lands in Stage 4.
export default function Home({ onRequestRide }: HomeProps) {
  const [pickup, setPickup] = useState<Pickup>(DEFAULT_PICKUP);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [destId, setDestId] = useState<string | null>(null);

  const from = useMemo<[number, number]>(() => [pickup.lat, pickup.lng], [pickup.lat, pickup.lng]);
  const { results, routes } = usePlacesSearch(from, query);
  const { format, fareFor, settings } = useFare();

  const dest = useMemo(() => results.find((p) => p.id === destId) ?? null, [results, destId]);
  const destRoute = dest ? routes[dest.id] : null;

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [{ id: 'me', lat: pickup.lat, lng: pickup.lng, kind: 'me', title: 'موقعك' }];
    if (dest) list.push({ id: 'dest', lat: dest.lat, lng: dest.lng, kind: 'dest', title: dest.name });
    return list;
  }, [pickup, dest]);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'موقعك الحالي' });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fare = dest && destRoute ? fareFor(destRoute.km, destRoute.minutes) : null;
  const fareVisible = settings?.showToRiders !== false;

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MapView markers={markers} routeGeometry={destRoute?.geometry ?? null} />
      </div>

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
          padding: '14px 18px 20px',
          maxHeight: '68%',
          overflow: 'auto'
        }}
      >
        <div style={{ width: 44, height: 4, borderRadius: 4, background: '#e2dcca', margin: '0 auto 14px' }} />

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
              <button
                key={r.id}
                onClick={() => {
                  setDestId(r.id);
                  setQuery('');
                }}
                style={resultRowStyle}
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
              <span style={{ display: 'block', font: "500 11.5px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
                {dest.area}
              </span>
            </span>
            <button onClick={() => setDestId(null)} style={{ background: 'none', border: 'none', color: '#575757', cursor: 'pointer', fontSize: 15 }}>
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

        <button
          onClick={() => dest && onRequestRide(dest.id, dest.name, pickup)}
          disabled={!dest}
          style={{ ...requestBtnStyle, opacity: dest ? 1 : 0.5, cursor: dest ? 'pointer' : 'not-allowed' }}
        >
          اطلب تكسي الآن
        </button>
      </div>
    </div>
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
