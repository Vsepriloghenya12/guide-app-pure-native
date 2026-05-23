import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppMap } from '../components/map/AppMap';
import { PageHeader } from '../components/layout/PageHeader';
import { ListingCard } from '../components/listing/ListingCard';
import { useFavorites } from '../hooks/useFavorites';
import { useGuideContent } from '../hooks/useGuideContent';
import { usePageMeta } from '../hooks/usePageMeta';
import { useUserLocation } from '../hooks/useUserLocation';
import type { GuideCategoryId, Listing } from '../types';
import { hasAppMapCoordinates } from '../utils/appMap';
import { comparePlacesByPriority, formatDistance, haversineDistanceKm, toListingLike } from '../utils/places';

export function MapPage() {
  usePageMeta({
    title: 'Карта',
    description: 'Карта Дананга с отмеченными местами, фильтрами категорий и быстрыми карточками.'
  });

  const { places, categories, loading, error } = useGuideContent();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPlaceSlug = searchParams.get('place');
  const { isFavorite, toggleFavorite } = useFavorites();
  const { location: userLocation, state: geoState, message: geoMessage, requestLocation, clearLocation } = useUserLocation();
  const [categoryFilter, setCategoryFilter] = useState<'all' | GuideCategoryId>('all');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.visible).sort((left, right) => (left.sortOrder ?? 100) - (right.sortOrder ?? 100)),
    [categories]
  );

  const mapListings = useMemo(() => {
    return places
      .filter((place) => place.status === 'published')
      .filter(hasAppMapCoordinates)
      .filter((place) => categoryFilter === 'all' || place.categoryId === categoryFilter)
      .map((place) => {
        const listing = toListingLike(place as Listing);
        const category = categories.find((item) => item.id === listing.categoryId || item.slug === listing.categorySlug);
        const distanceKm = userLocation ? haversineDistanceKm(userLocation, { lat: listing.lat!, lng: listing.lng! }) : null;
        return { ...listing, category, distanceKm };
      })
      .sort((left, right) => {
        if (left.distanceKm !== null && right.distanceKm !== null && left.distanceKm !== right.distanceKm) {
          return left.distanceKm - right.distanceKm;
        }
        if (left.distanceKm !== null && right.distanceKm === null) return -1;
        if (left.distanceKm === null && right.distanceKm !== null) return 1;
        return comparePlacesByPriority(left, right);
      });
  }, [places, categories, categoryFilter, userLocation]);

  const placesWithoutCoordinatesCount = useMemo(
    () => places.filter((place) => place.status === 'published' && !hasAppMapCoordinates(place)).length,
    [places]
  );

  const selectedPlace = useMemo(() => {
    if (!mapListings.length) {
      return null;
    }

    return mapListings.find((place) => place.id === selectedPlaceId) ?? (requestedPlaceSlug ? mapListings.find((place) => place.slug === requestedPlaceSlug) : null) ?? null;
  }, [mapListings, requestedPlaceSlug, selectedPlaceId]);

  const closestPlaces = mapListings.filter((place) => place.distanceKm !== null).slice(0, 3);

  const clearRequestedPlace = () => {
    if (!requestedPlaceSlug) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('place');
    setSearchParams(nextParams, { replace: true });
  };

  const handleSelectPlace = (placeId: string) => {
    clearRequestedPlace();
    setSelectedPlaceId(placeId);
  };

  const handleClearSelectedPlace = () => {
    clearRequestedPlace();
    setSelectedPlaceId(null);
  };

  const handleCategoryChange = (nextCategoryId: 'all' | GuideCategoryId) => {
    clearRequestedPlace();
    setCategoryFilter(nextCategoryId);
    setSelectedPlaceId(null);
  };

  return (
    <div className="page-stack travel-page travel-page--app-map client-tab-page">
      <PageHeader title="Карта" subtitle="Карта Дананга с отмеченными местами, фильтрами категорий и быстрыми карточками." showBack />

      <section className="client-tab-controls app-map-controls" aria-label="Фильтры карты">
        <div className="app-map-toolbar__top">
          <div>
            <strong>{mapListings.length} мест на карте</strong>
            <span>{placesWithoutCoordinatesCount > 0 ? `${placesWithoutCoordinatesCount} карточек пока без точки на карте` : 'Все опубликованные точки показаны'}</span>
          </div>
          <button className="travel-secondary-button" type="button" onClick={() => setShowList((value) => !value)}>
            {showList ? 'Скрыть список' : 'Список'}
          </button>
        </div>

        <div className="app-map-category-scroll" role="list" aria-label="Категории карты">
          <button
            className={`app-map-category-pill${categoryFilter === 'all' ? ' is-active' : ''}`}
            type="button"
            onClick={() => handleCategoryChange('all')}
          >
            Все
          </button>
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              className={`app-map-category-pill${categoryFilter === category.id ? ' is-active' : ''}`}
              type="button"
              onClick={() => handleCategoryChange(category.id)}
            >
              {category.shortTitle || category.title}
            </button>
          ))}
        </div>

        <div className="app-map-toolbar__geo">
          <button className="travel-primary-button" type="button" onClick={requestLocation} disabled={geoState === 'loading'}>
            {geoState === 'loading' ? 'Определяю…' : userLocation ? 'Обновить геолокацию' : 'Моё местоположение'}
          </button>
          {userLocation ? (
            <button className="travel-secondary-button" type="button" onClick={clearLocation}>
              Очистить
            </button>
          ) : null}
          <p>{geoMessage}</p>
        </div>
      </section>

      {loading ? <div className="client-tab-state">Загружаю карту приложения…</div> : null}
      {error ? <div className="client-tab-state">{error}</div> : null}

      {!loading ? (
        <AppMap
          places={mapListings}
          selectedPlaceId={selectedPlace?.id ?? null}
          userLocation={userLocation}
          emptyMessage="Карта Дананга загружена. Точки появятся после того, как владелец отметит места на карте в карточках."
          onSelectPlace={handleSelectPlace}
          onClearSelectedPlace={handleClearSelectedPlace}
        />
      ) : null}

      {closestPlaces.length > 0 ? (
        <section className="client-tab-section app-map-nearest-list">
          <div className="travel-section__header">
            <h2>Ближе всего</h2>
            <Link to="/search">Поиск</Link>
          </div>
          <div className="app-map-nearest-list__grid">
            {closestPlaces.map((place) => (
              <button key={place.id} className="app-map-nearest-row" type="button" onClick={() => handleSelectPlace(place.id)}>
                <strong>{place.title}</strong>
                <span>{place.category?.shortTitle || place.category?.title || 'Место'}</span>
                <small>{formatDistance(place.distanceKm)}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showList && mapListings.length > 0 ? (
        <section className="travel-listing-stack app-map-list-section client-tab-listing-section">
          {mapListings.map(({ category, distanceKm: _distanceKm, ...listing }) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              accent={category?.accent}
              isFavorite={isFavorite(listing.slug)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
