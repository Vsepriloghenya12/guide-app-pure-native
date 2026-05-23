import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListingCard } from '../components/listing/ListingCard';
import { AppMap } from '../components/map/AppMap';
import { PageHeader } from '../components/layout/PageHeader';
import { useFavorites } from '../hooks/useFavorites';
import { useGuideContent } from '../hooks/useGuideContent';
import { useUserLocation } from '../hooks/useUserLocation';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  comparePlacesByPriority,
  createGoogleDirectionsUrl,
  estimateTravelTime,
  formatDistance,
  hasCoordinates,
  haversineDistanceKm,
  toListingLike
} from '../utils/places';
import { hasAppMapCoordinates } from '../utils/appMap';
import type { GuideCategoryId } from '../types';

const nearbyCategoryOptions: Array<{ value: 'all' | GuideCategoryId; label: string }> = [
  { value: 'all', label: 'Все категории' },
  { value: 'restaurants', label: 'Еда' },
  { value: 'events', label: 'Досуг' },
  { value: 'wellness', label: 'Оздоровление' },
  { value: 'hotels', label: 'Резорты' },
  { value: 'active-rest', label: 'Активный отдых' },
  { value: 'car-rental', label: 'Транспорт' },
  { value: 'atm', label: 'Финансы' },
  { value: 'shops', label: 'Покупки' },
  { value: 'culture', label: 'Культура и искусство' },
  { value: 'kids', label: 'Детям' },
  { value: 'medicine', label: 'Медицина' },
  { value: 'photo-spots', label: 'Виды города' },
  { value: 'coworkings', label: 'Коворкинги' },
  { value: 'misc', label: 'Разное' }
];

const nearbyRadiusOptions = [
  { value: 2, label: '2 км' },
  { value: 5, label: '5 км' },
  { value: 10, label: '10 км' },
  { value: 25, label: '25 км' }
];

export function NearbyPage() {
  usePageMeta({
    title: 'Рядом',
    description: 'Ближайшие места рядом с пользователем с фильтром по категориям и радиусу.'
  });
  const { isFavorite, toggleFavorite } = useFavorites();
  const { places, categories, loading, error } = useGuideContent();
  const { location: userLocation, state: geoState, message: geoMessage, requestLocation, clearLocation } = useUserLocation();
  const [radiusKm, setRadiusKm] = useState(5);
  const [categoryFilter, setCategoryFilter] = useState<'all' | GuideCategoryId>('all');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const publishedPlaces = useMemo(() => places.filter((place) => place.status === 'published'), [places]);

  const nearbyListings = useMemo(() => {
    return publishedPlaces
      .filter((listing) => categoryFilter === 'all' || listing.categoryId === categoryFilter)
      .map((listing) => {
        const distanceKm =
          userLocation && hasCoordinates(listing)
            ? haversineDistanceKm(userLocation, { lat: listing.lat!, lng: listing.lng! })
            : null;

        return {
          ...listing,
          distanceKm,
          category: categories.find((category) => category.id === listing.categoryId)
        };
      })
      .filter((listing) => listing.distanceKm === null || listing.distanceKm <= radiusKm)
      .sort((left, right) => {
        if (left.distanceKm === null && right.distanceKm === null) return comparePlacesByPriority(left, right);
        if (left.distanceKm === null) return 1;
        if (right.distanceKm === null) return -1;
        if (left.distanceKm !== right.distanceKm) return left.distanceKm - right.distanceKm;
        return comparePlacesByPriority(left, right);
      });
  }, [publishedPlaces, userLocation, categories, radiusKm, categoryFilter]);

  const closestPlaces = nearbyListings.filter((place) => place.distanceKm !== null).slice(0, 3);
  const mapListings = useMemo(
    () =>
      nearbyListings
        .filter(hasAppMapCoordinates)
        .map((place) => ({
          ...toListingLike(place),
          category: place.category,
          distanceKm: place.distanceKm
        })),
    [nearbyListings]
  );

  return (
    <div className="page-stack travel-page travel-page--nearby">
      <PageHeader title="Рядом" subtitle="Ближайшие места вокруг вас с быстрым фильтром по категории и радиусу." showBack />

      <section className="travel-search-panel travel-search-panel--map">
        <div className="client-filter-group">
          <span className="client-filter-group__label">Категория</span>
          <div className="client-chip-scroll" role="list" aria-label="Категории nearby">
            {nearbyCategoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`client-filter-chip${categoryFilter === option.value ? ' is-active' : ''}`}
                onClick={() => setCategoryFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="client-filter-group">
          <span className="client-filter-group__label">Радиус</span>
          <div className="client-chip-scroll client-chip-scroll--soft" role="list" aria-label="Радиус поиска">
            {nearbyRadiusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`client-filter-chip client-filter-chip--soft${radiusKm === option.value ? ' is-active' : ''}`}
                onClick={() => setRadiusKm(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="travel-inline-actions">
          <button className="travel-primary-button" type="button" onClick={requestLocation} disabled={geoState === 'loading'}>
            {geoState === 'loading' ? 'Определяю геопозицию…' : userLocation ? 'Обновить геопозицию' : 'Включить геолокацию'}
          </button>
          {userLocation ? (
            <button className="travel-secondary-button" type="button" onClick={clearLocation}>
              Очистить
            </button>
          ) : null}
        </div>

        <p className="travel-helper-text">{geoMessage}</p>
      </section>

      <AppMap
        places={mapListings}
        selectedPlaceId={selectedPlaceId}
        userLocation={userLocation}
        emptyMessage="Карта Дананга загружена. Ближайшие точки появятся после отметки мест в карточках."
        onSelectPlace={setSelectedPlaceId}
        onClearSelectedPlace={() => setSelectedPlaceId(null)}
      />

      {closestPlaces.length > 0 ? (
        <section className="travel-section travel-section--nearby-summary">
          <div className="travel-section__header">
            <h2>Ближе всего</h2>
            <Link to="/search">Смотреть все</Link>
          </div>

          <div className="travel-inline-places">
            {closestPlaces.map((place) => (
              <a
                key={`mini-${place.id}`}
                className="travel-inline-place"
                href={createGoogleDirectionsUrl(toListingLike(place), userLocation)}
                target="_blank"
                rel="noreferrer"
              >
                <strong>{place.title}</strong>
                <span>{formatDistance(place.distanceKm)}</span>
                <small>{estimateTravelTime(place.distanceKm)} на машине</small>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? <div className="travel-state-card">Ищу места рядом…</div> : null}
      {error ? <div className="travel-state-card">{error}</div> : null}

      {!loading && nearbyListings.length > 0 ? (
        <section className="travel-listing-stack">
          {nearbyListings.map(({ category, ...listing }) => (
            <ListingCard
              key={listing.id}
              listing={toListingLike(listing)}
              accent={category?.accent}
              isFavorite={isFavorite(toListingLike(listing).slug)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </section>
      ) : null}

      {!loading && nearbyListings.length === 0 ? (
        <div className="travel-state-card">
          <strong>Рядом пока ничего не найдено</strong>
          <p>Попробуйте увеличить радиус или выбрать другую категорию.</p>
        </div>
      ) : null}
    </div>
  );
}
