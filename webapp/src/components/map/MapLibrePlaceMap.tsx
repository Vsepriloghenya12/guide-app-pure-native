import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';

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
  selectedPlaceId?: string | null;
  userLocation?: { lat: number; lng: number } | null;
  zoom?: number;
  className?: string;
  onSelectPlace?: (placeId: string) => void;
  onClearSelectedPlace?: () => void;
};

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDTDtz5ZdNanN19XgrAULyCeBSOe948qaU';

const DEFAULT_CENTER = { lat: 16.047079, lng: 108.20623 };
// Height/width come from the CSS classes (.maplibre-place-map / .app-map-canvas*),
// exactly as the previous OSM map did. Forcing an inline height:100% here would
// override those concrete heights and collapse the map inside its auto-height grid parent.
const MAP_CONTAINER_STYLE = { width: '100%' };

function isValidCoordinate(lat: unknown, lng: unknown): boolean {
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

export function MapLibrePlaceMap({
  places,
  selectedPlaceId,
  userLocation,
  zoom = 12,
  className,
  onSelectPlace,
  onClearSelectedPlace,
}: MapLibrePlaceMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [openInfoWindowId, setOpenInfoWindowId] = useState<string | null>(null);

  const safePlaces = useMemo(
    () => places.filter((p) => isValidCoordinate(p.lat, p.lng)),
    [places]
  );

  const containerClassName = useMemo(
    () => ['maplibre-place-map', className].filter(Boolean).join(' '),
    [className]
  );

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      setMapInstance(map);
      if (safePlaces.length === 0) return;
      if (safePlaces.length === 1) {
        map.setCenter({ lat: safePlaces[0].lat, lng: safePlaces[0].lng });
        map.setZoom(Math.max(zoom, 15));
      } else {
        const bounds = new google.maps.LatLngBounds();
        safePlaces.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, 42);
      }
    },
    [safePlaces, zoom]
  );

  const onUnmount = useCallback(() => {
    setMapInstance(null);
  }, []);

  // Pan to selected place and open its info window
  useEffect(() => {
    if (!mapInstance) return;
    if (!selectedPlaceId) {
      setOpenInfoWindowId(null);
      return;
    }
    const place = safePlaces.find((p) => p.id === selectedPlaceId);
    if (!place) return;
    mapInstance.panTo({ lat: place.lat, lng: place.lng });
    setOpenInfoWindowId(selectedPlaceId);
  }, [selectedPlaceId, safePlaces, mapInstance]);

  const handleMapClick = useCallback(() => {
    onClearSelectedPlace?.();
    setOpenInfoWindowId(null);
  }, [onClearSelectedPlace]);

  if (!isLoaded) {
    return <div className={containerClassName} />;
  }

  const placeIcon = {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: '#1f63c7',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 8,
  };

  const userIcon = {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: '#e84040',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 8,
  };

  const selectedPlace = openInfoWindowId
    ? (safePlaces.find((p) => p.id === openInfoWindowId) ?? null)
    : null;

  return (
    <GoogleMap
      mapContainerClassName={containerClassName}
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={DEFAULT_CENTER}
      zoom={zoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={handleMapClick}
    >
      {safePlaces.map((place) => (
        <MarkerF
          key={place.id}
          position={{ lat: place.lat, lng: place.lng }}
          icon={placeIcon}
          onClick={() => {
            onSelectPlace?.(place.id);
            setOpenInfoWindowId(place.id);
          }}
        />
      ))}

      {selectedPlace && (
        <InfoWindowF
          position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
          onCloseClick={() => setOpenInfoWindowId(null)}
        >
          <div className="maplibre-place-popup">
            <strong>{selectedPlace.title}</strong>
            {selectedPlace.address && <span>{selectedPlace.address}</span>}
            {selectedPlace.category && <small>{selectedPlace.category}</small>}
          </div>
        </InfoWindowF>
      )}

      {userLocation && isValidCoordinate(userLocation.lat, userLocation.lng) && (
        <MarkerF
          position={{ lat: userLocation.lat, lng: userLocation.lng }}
          icon={userIcon}
          title="Вы здесь"
        />
      )}
    </GoogleMap>
  );
}
