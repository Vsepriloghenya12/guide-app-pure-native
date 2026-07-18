import type { Category, Listing } from '../../types';
import type { AppMapPoint } from '../../utils/appMap';
import { MapLibrePlaceMap, type MapPlace } from './MapLibrePlaceMap';

type AppMapListing = Listing & {
  category?: Category;
  distanceKm?: number | null;
};

type AppMapProps = {
  places: AppMapListing[];
  selectedPlaceId: string | null;
  userLocation?: AppMapPoint | null;
  emptyMessage?: string;
  onSelectPlace: (placeId: string) => void;
  onClearSelectedPlace?: () => void;
};

function toMapPlace(place: AppMapListing): MapPlace {
  return {
    id: place.id,
    title: place.title,
    lat: Number(place.lat),
    lng: Number(place.lng),
    address: place.address || place.district || place.location,
    category: place.category?.shortTitle || place.category?.title || place.listingType || place.kind
  };
}

export function AppMap({ places, selectedPlaceId, userLocation, emptyMessage, onSelectPlace, onClearSelectedPlace }: AppMapProps) {
  const mapPlaces = places.map(toMapPlace);
  const hasSelected = selectedPlaceId != null && mapPlaces.some((p) => p.id === selectedPlaceId);

  return (
    <section className={`app-map-shell app-map-shell--maplibre${hasSelected ? ' has-selected-place' : ''}`} aria-label="Карта приложения">
      {mapPlaces.length === 0 && emptyMessage ? <div className="app-map-empty-note app-map-empty-note--maplibre">{emptyMessage}</div> : null}
      <MapLibrePlaceMap
        places={mapPlaces}
        selectedPlaceId={selectedPlaceId}
        userLocation={userLocation}
        className="app-map-canvas app-map-canvas--maplibre"
        onSelectPlace={onSelectPlace}
        onClearSelectedPlace={onClearSelectedPlace}
      />
    </section>
  );
}
