import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { LngLatBounds, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type MapPlace = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  address?: string;
  category?: string;
};

type MapLibrePlaceMapProps = {
  places: MapPlace[];
  center?: [number, number];
  zoom?: number;
  className?: string;
};

const defaultCenter: [number, number] = [108.20623, 16.047079];
const defaultTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function isValidCoordinate(lat: unknown, lng: unknown) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildPopupHtml(place: MapPlace) {
  const address = place.address ? `<span>${escapeHtml(place.address)}</span>` : '';
  const category = place.category ? `<small>${escapeHtml(place.category)}</small>` : '';

  return `
    <div class="maplibre-place-popup">
      <strong>${escapeHtml(place.title)}</strong>
      ${address}
      ${category}
    </div>
  `;
}

export function MapLibrePlaceMap({ places, center = defaultCenter, zoom = 12, className }: MapLibrePlaceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const safePlaces = useMemo(
    () => places.filter((place) => isValidCoordinate(place.lat, place.lng)),
    [places]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const tileUrl = import.meta.env.VITE_MAP_TILE_URL || defaultTileUrl;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center,
      zoom,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm'
          }
        ]
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (safePlaces.length === 0) {
      map.easeTo({ center, zoom, duration: 0 });
      return;
    }

    const bounds = new LngLatBounds();
    safePlaces.forEach((place) => {
      const lngLat: [number, number] = [place.lng, place.lat];
      bounds.extend(lngLat);
      const marker = new maplibregl.Marker({ color: '#1f63c7' })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(buildPopupHtml(place)))
        .addTo(map);
      markersRef.current.push(marker);
    });

    if (safePlaces.length === 1) {
      map.easeTo({ center: [safePlaces[0].lng, safePlaces[0].lat], zoom: Math.max(zoom, 15), duration: 0 });
      return;
    }

    map.fitBounds(bounds, { padding: 42, maxZoom: 15, duration: 0 });
  }, [center, safePlaces, zoom]);

  return <div ref={containerRef} className={['maplibre-place-map', className].filter(Boolean).join(' ')} />;
}
