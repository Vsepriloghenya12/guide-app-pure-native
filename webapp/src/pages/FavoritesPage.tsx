import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ListingCard } from '../components/listing/ListingCard';
import { PageHeader } from '../components/layout/PageHeader';
import { useFavorites } from '../hooks/useFavorites';
import { useGuideContent } from '../hooks/useGuideContent';
import { usePageMeta } from '../hooks/usePageMeta';
import { sortPlacesByPriority, toListingLike } from '../utils/places';

export function FavoritesPage() {
  usePageMeta({
    title: 'Избранное',
    description: 'Сохранённые места пользователя, собранные по категориям для быстрого возврата.'
  });
  const { favoriteSlugs, isFavorite, toggleFavorite } = useFavorites();
  const { places, categories, loading, error } = useGuideContent();

  const favoriteListings = useMemo(() => {
    const favoritesSet = new Set(favoriteSlugs);
    return sortPlacesByPriority(places.filter((item) => item.status === 'published' && item.slug && favoritesSet.has(item.slug)));
  }, [places, favoriteSlugs]);

  const grouped = useMemo(() => {
    return categories
      .filter((category) => favoriteListings.some((listing) => listing.categoryId === category.id))
      .map((category) => ({
        category,
        listings: favoriteListings.filter((listing) => listing.categoryId === category.id)
      }));
  }, [categories, favoriteListings]);

  return (
    <div className="page-stack travel-page travel-page--favorites client-tab-page">
      <PageHeader
        title="Избранное"
        subtitle="Сохранённые места хранятся у пользователя. Здесь они собраны по категориям."
        showBack
      />

      {loading ? <div className="client-tab-state page-loader">Обновляю избранное…</div> : null}
      {error ? (
        <div className="client-tab-state client-tab-state--empty empty-state--left">
          <strong>Не удалось загрузить карточки</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {!loading && favoriteListings.length === 0 ? (
        <div className="client-tab-state client-tab-state--empty">
          <strong>Пока нет сохранённых мест</strong>
          <p>Открой карточку места или список и нажми на сердечко — место появится здесь.</p>
          <div className="placeholder-state__actions">
            <Link className="button button--primary" to="/search">
              Перейти в поиск
            </Link>
          </div>
        </div>
      ) : null}

      {grouped.map(({ category, listings }) => (
        <section key={category.id} className="client-tab-section favorites-group">
          <div className="section-headline section-headline--muted">
            <strong>{category.title}</strong>
            <Link to={category.id === 'restaurants' ? '/restaurants' : category.id === 'wellness' ? '/wellness' : category.path}>
              Открыть раздел
            </Link>
          </div>
          <div className="listing-grid listing-grid--compact">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={toListingLike(listing)}
                accent={category.accent}
                isFavorite={isFavorite(toListingLike(listing).slug)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
