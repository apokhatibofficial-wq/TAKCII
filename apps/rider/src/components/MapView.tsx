import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CITY_CENTER } from '@takc/shared';
import taxiMarkerUrl from '../assets/taxi-marker.png';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'me' | 'dest' | 'driver' | 'place';
  title?: string;
  imageUrl?: string | null;
  onClick?: () => void;
}

interface MapViewProps {
  markers: MapMarker[];
  routeGeometry?: [number, number][] | null;
  onMapClick?: (lat: number, lng: number) => void;
}

// A place's image_url is admin-controlled (uploaded through the admin panel's
// own file input, stored under a crypto.randomUUID() path -- never taken
// from a rider), but it still goes into an HTML string handed to Leaflet's
// divIcon, so it gets the same attribute-escaping any interpolated value
// would need regardless of how trusted the source is.
function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Ported from index.html's icon()/syncMap()/drawMarkers()/drawRoute() — same
// marker styling, same imperative-update pattern (Leaflet owns its DOM node;
// React only diffs the marker/route data going in).
function iconFor(kind: MapMarker['kind'], imageUrl?: string | null): L.Icon | L.DivIcon {
  if (kind === 'driver') {
    // Top-down car artwork supplied as-is (unmodified) — iconSize is the
    // asset's own 1x display size; the file itself is exported @2x for a
    // crisp marker on high-DPI phone screens.
    return L.icon({ iconUrl: taxiMarkerUrl, iconSize: [34, 76], iconAnchor: [17, 38] });
  }
  if (kind === 'me') {
    return L.divIcon({
      className: '',
      iconSize: [22, 22],
      html: '<div style="width:22px;height:22px;border-radius:50%;background:#008637;border:3px solid #fff;box-shadow:0 0 0 6px rgba(0,134,55,.2)"></div>'
    });
  }
  // Same circular photo treatment for the selected destination and for a
  // 'place' pin shown while still choosing one -- imageUrl presence, not
  // which of the two kinds it is, is what decides this look.
  if (imageUrl) {
    const size = kind === 'place' ? 34 : 42;
    return L.divIcon({
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;background:#fff;border:3px solid #fde403;box-shadow:0 2px 10px rgba(24,22,25,.4)"><img src="${escapeHtmlAttr(imageUrl)}" style="width:100%;height:100%;object-fit:cover;display:block" /></div>`
    });
  }
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    html: '<div style="width:16px;height:16px;border-radius:3px;background:#181619;border:3px solid #fde403"></div>'
  });
}

export default function MapView({ markers, routeGeometry, onMapClick }: MapViewProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const routeRef = useRef<L.Polyline | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;
    const map = L.map(nodeRef.current, { zoomControl: true }).setView(CITY_CENTER, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => onMapClickRef.current?.(e.latlng.lat, e.latlng.lng));
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
        // 'dest' keeps the same marker id across different selected places,
        // so its icon (which depends on that place's imageUrl) has to be
        // refreshed here too -- otherwise picking a new destination would
        // keep showing the previous one's photo (or lack of one).
        existing.setIcon(iconFor(m.kind, m.imageUrl));
        return;
      }
      const marker = L.marker([m.lat, m.lng], { icon: iconFor(m.kind, m.imageUrl) }).addTo(map);
      // Several 'place' pins can be on screen at once while the rider is
      // still choosing a destination -- showing every name at all times
      // would clutter the map, so the label only opens on tap/click, same
      // as any other marker's tooltip.
      if (m.title) {
        marker.bindTooltip(
          m.title,
          m.kind === 'place'
            ? { direction: 'top', className: 'place-label-tooltip', offset: [0, -20] }
            : { direction: 'top' }
        );
      }
      marker.on('click', () => {
        marker.openTooltip();
        m.onClick?.();
      });
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
