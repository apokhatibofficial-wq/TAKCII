import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CITY_CENTER } from '@takc/shared';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'me' | 'dest' | 'driver';
  title?: string;
}

interface MapViewProps {
  markers: MapMarker[];
  routeGeometry?: [number, number][] | null;
}

// Ported from index.html's icon()/syncMap()/drawMarkers()/drawRoute() — same
// marker styling, same imperative-update pattern (Leaflet owns its DOM node;
// React only diffs the marker/route data going in).
function iconFor(kind: MapMarker['kind']): L.DivIcon {
  if (kind === 'driver') {
    return L.divIcon({
      className: '',
      iconSize: [30, 30],
      html: '<div style="width:30px;height:30px;border-radius:10px;background:#fde403;border:2px solid #181619;display:grid;place-items:center;font:800 12px/1.35 Tajawal,sans-serif;color:#181619;box-shadow:0 4px 10px rgba(0,0,0,.3)">T</div>'
    });
  }
  if (kind === 'me') {
    return L.divIcon({
      className: '',
      iconSize: [22, 22],
      html: '<div style="width:22px;height:22px;border-radius:50%;background:#008637;border:3px solid #fff;box-shadow:0 0 0 6px rgba(0,134,55,.2)"></div>'
    });
  }
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    html: '<div style="width:16px;height:16px;border-radius:3px;background:#181619;border:3px solid #fde403"></div>'
  });
}

export default function MapView({ markers, routeGeometry }: MapViewProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const routeRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;
    const map = L.map(nodeRef.current, { zoomControl: true }).setView(CITY_CENTER, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      routeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const keep = new Set<string>();
    markers.forEach((m) => {
      keep.add(m.id);
      const existing = markersRef.current[m.id];
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        return;
      }
      const marker = L.marker([m.lat, m.lng], { icon: iconFor(m.kind) }).addTo(map);
      if (m.title) marker.bindTooltip(m.title, { direction: 'top' });
      markersRef.current[m.id] = marker;
    });
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      if (!keep.has(id)) {
        map.removeLayer(marker);
        delete markersRef.current[id];
      }
    });
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
      routeRef.current = null;
    }
    if (routeGeometry && routeGeometry.length > 1) {
      const line = L.polyline(routeGeometry, { color: '#008637', weight: 5, opacity: 0.85 }).addTo(map);
      routeRef.current = line;
      try {
        map.fitBounds(line.getBounds().pad(0.25));
      } catch {
        // route may be a single degenerate point — ignore
      }
    }
  }, [routeGeometry]);

  return <div ref={nodeRef} style={{ position: 'absolute', inset: 0, background: '#e9e4d4' }} />;
}
