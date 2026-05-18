import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../layout/PageHeader';
import { ListingCard } from './ListingCard';
import { defaultCategories } from '../../data/categories';
import { useGuideContent } from '../../hooks/useGuideContent';
import { usePageMeta } from '../../hooks/usePageMeta';
import { comparePlacesByPriority, toListingLike } from '../../utils/places';
import type { GuideCategory, GuideCategoryId, GuidePlace } from '../../types';

type CategoryExplorerProps = {
  categoryId?: GuideCategoryId;
  categorySlug?: string;
};

type SortMode = 'priority' | 'alphabet' | 'check-low' | 'check-high';
type BinaryFilter = 'all' | 'yes' | 'no';

type FiltersState = {
  breakfast: BinaryFilter;
  vegan: BinaryFilter;
  kind: string;
  cuisine: string;
  district: string;
  minCheck: string;
  maxCheck: string;
  hotelStars: string;
  hotelPool: BinaryFilter;
  hotelSpa: BinaryFilter;
  petFriendly: BinaryFilter;
  selectedServices: string[];
  selectedTags: string[];
  selectedQuickTokens: string[];
  sortMode: SortMode;
};

function createInitialFilters(): FiltersState {
  return {
    breakfast: 'all',
    vegan: 'all',
    kind: 'all',
    cuisine: 'all',
    district: 'all',
    minCheck: '',
    maxCheck: '',
    hotelStars: 'all',
    hotelPool: 'all',
    hotelSpa: 'all',
    petFriendly: 'all',
    selectedServices: [],
    selectedTags: [],
    selectedQuickTokens: [],
    sortMode: 'priority'
  };
}

const restaurantQuickFilters = ['Морепродукты', 'Вьетнамская', 'Европейская'];
const filterTextMap: Record<string, string> = {
  breakfast: 'Завтраки',
  vegan: 'Веган-опции',
  pets: 'Можно с животными',
  childprograms: 'Для детей',
  night: 'Ночью',
  nightlife: 'Ночная жизнь',
  today: 'Сегодня',
  weekend: 'Выходные',
  free: 'Бесплатно',
  outdoor: 'На улице',
  indoor: 'В помещении',
  family: 'Для всей семьи',
  water: 'У воды',
  bike: 'Байк',
  car: 'Авто',
  delivery: 'Доставка',
  market: 'Рынок',
  local: 'Локальное',
  design: 'Дизайн',
  museum: 'Музей',
  temple: 'Храм',
  view: 'Вид',
  english: 'На английском',
  pharmacy: 'Аптека',
  sunrise: 'Рассвет',
  sunset: 'Закат',
  'private room': 'Приватная комната',
  'lazy river': 'Ленивая река',
  'family zone': 'Семейная зона',
  'indoor zone': 'Крытая зона',
  'han river': 'Река Хан',
  'son tra': 'Сон Тра',
  'hai chau': 'Хай Чау',
  'lien chieu': 'Льен Чьеу',
  'my an': 'Ми Ан',
  spa: 'СПА',
  massage: 'Массаж',
  'road trip': 'Поездка',
  mountains: 'Горы',
  airport: 'Аэропорт',
  arrival: 'Прилёт',
  cash: 'Наличные',
  center: 'Центр',
  souvenirs: 'Сувениры',
  culture: 'Культура',
  history: 'История',
  kids: 'Детям',
  evening: 'Вечером',
  emergency: 'Экстренно',
  'international department': 'Международный отдел',
  hospital: 'Больница',
  photo: 'Фото',
  'meeting room': 'Переговорная',
  'tea & coffee': 'Чай и кофе',
  coworking: 'Коворкинг',
  'remote work': 'Удалённая работа',
  'motorbike rental': 'Прокат байка',
  'one way': 'В одну сторону',
  'travel support': 'Помощь в поездке',
  resort: 'Курорт',
  beach: 'Пляж',
  'japanese style': 'Японский стиль',
  onsen: 'Онсэн',
  'wi-fi': 'Wi-Fi'
};

function toLabel(filterKey: string) {
  const map: Record<string, string> = {
    avgCheck: 'Средний чек',
    kind: 'Тип',
    cuisine: 'Кухня',
    services: 'Услуги',
    tags: 'Теги',
    district: 'Район',
    hotelStars: 'Звёзды',
    hotelPool: 'Бассейн',
    hotelSpa: 'СПА',
    petFriendly: 'С животными'
  };

  return map[filterKey] || filterKey;
}

function sortPlaces<T extends GuidePlace>(places: T[], sortMode: SortMode): T[] {
  if (sortMode === 'priority') {
    return [...places].sort(comparePlacesByPriority);
  }

  return [...places].sort((left, right) => {
    switch (sortMode) {
      case 'alphabet':
        return String(left.title || '').localeCompare(String(right.title || ''), 'ru');
      case 'check-low':
        return Number(left.avgCheck || 0) - Number(right.avgCheck || 0);
      case 'check-high':
        return Number(right.avgCheck || 0) - Number(left.avgCheck || 0);
      default:
        return comparePlacesByPriority(left, right);
    }
  });
}

function mergeCategoryWithFallback(category?: GuideCategory | null) {
  if (!category) {
    return null;
  }

  const fallback = defaultCategories.find((item) => item.id === category.id || item.slug === category.slug);
  if (!fallback) {
    return category;
  }

  return {
    ...fallback,
    ...category,
    filterSchema: {
      quickFilters: category.filterSchema?.quickFilters?.length ? category.filterSchema.quickFilters : fallback.filterSchema?.quickFilters || [],
      fields: category.filterSchema?.fields?.length ? category.filterSchema.fields : fallback.filterSchema?.fields || []
    },
    imageSrc: category.imageSrc || fallback.imageSrc || '',
    description: category.description || fallback.description || '',
    shortTitle: category.shortTitle || fallback.shortTitle,
    accent: category.accent || fallback.accent,
    path: category.path || fallback.path,
    slug: category.slug || fallback.slug
  } satisfies GuideCategory;
}

function toggleInArray(values: string[], target: string) {
  return values.includes(target) ? values.filter((value) => value !== target) : [...values, target];
}

function isNonEmptyString(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function matchesBinaryFilter(value: boolean, filter: BinaryFilter) {
  if (filter === 'all') return true;
  return filter === 'yes' ? value : !value;
}

function normalizeToken(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function getFilterDisplayText(value: string) {
  const normalized = normalizeToken(value);
  return filterTextMap[normalized] || value;
}

function sortFilterValues(left: string, right: string) {
  return getFilterDisplayText(left).localeCompare(getFilterDisplayText(right), 'ru');
}

function getActiveFilterCount(filters: FiltersState) {
  let count = 0;

  if (filters.breakfast !== 'all') count += 1;
  if (filters.vegan !== 'all') count += 1;
  if (filters.kind !== 'all') count += 1;
  if (filters.cuisine !== 'all') count += 1;
  if (filters.district !== 'all') count += 1;
  if (filters.minCheck.trim()) count += 1;
  if (filters.maxCheck.trim()) count += 1;
  if (filters.hotelStars !== 'all') count += 1;
  if (filters.hotelPool !== 'all') count += 1;
  if (filters.hotelSpa !== 'all') count += 1;
  if (filters.petFriendly !== 'all') count += 1;
  if (filters.selectedServices.length > 0) count += 1;
  if (filters.selectedTags.length > 0) count += 1;
  if (filters.selectedQuickTokens.length > 0) count += 1;

  return count;
}

function formatPlaceCount(count: number) {
  const remainder10 = count % 10;
  const remainder100 = count % 100;

  if (remainder10 === 1 && remainder100 !== 11) {
    return `${count} место`;
  }

  if (remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)) {
    return `${count} места`;
  }

  return `${count} мест`;
}

function matchesQuickToken(place: GuidePlace, token: string) {
  const normalized = normalizeToken(token);

  if (!normalized) {
    return true;
  }

  if (normalized === 'breakfast') {
    return Boolean(place.breakfast) || place.tags?.some((tag) => normalizeToken(tag) === normalized) || place.services?.some((service) => normalizeToken(service) === normalized);
  }

  if (normalized === 'vegan') {
    return Boolean(place.vegan) || place.tags?.some((tag) => normalizeToken(tag) === normalized) || place.services?.some((service) => normalizeToken(service) === normalized);
  }

  if (normalized === 'pets') {
    return Boolean(place.petFriendly ?? place.pets);
  }

  if (normalized === 'childprograms') {
    return Boolean(place.childPrograms ?? place.childFriendly);
  }

  const haystack = [
    place.title,
    place.description,
    place.shortDescription,
    place.address,
    place.kind,
    place.cuisine,
    place.district,
    place.hours,
    place.priceLabel,
    ...(place.services || []),
    ...(place.tags || [])
  ]
    .filter(Boolean)
    .map((value) => normalizeToken(String(value)));

  return haystack.some((value) => value.includes(normalized));
}

export function CategoryExplorer({ categoryId, categorySlug }: CategoryExplorerProps) {
  const [filters, setFilters] = useState<FiltersState>(() => createInitialFilters());
  const [isRestaurantFilterOpen, setRestaurantFilterOpen] = useState(false);
  const navigate = useNavigate();
  const { categories, places, loading, error } = useGuideContent();
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  };

  useEffect(() => {
    if (!isRestaurantFilterOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRestaurantFilterOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isRestaurantFilterOpen]);

  const rawCategory = useMemo(
    () =>
      categories.find((item) => {
        if (categoryId) {
          return item.id === categoryId;
        }
        return item.slug === categorySlug || item.id === categorySlug;
      }) || null,
    [categories, categoryId, categorySlug]
  );

  const category = useMemo(() => mergeCategoryWithFallback(rawCategory), [rawCategory]);

  usePageMeta({
    title: category ? category.title : 'Раздел не найден',
    description: category?.description || 'Подборка мест и полезной информации по этому разделу.'
  });

  const categoryPlaces = useMemo(() => {
    if (!category) {
      return [];
    }

    return places.filter((place) => place.categoryId === category.id && place.status === 'published');
  }, [places, category]);

  const filterFields = category?.filterSchema?.fields || [];

  const kindOptions = useMemo(
    () => Array.from(new Set(categoryPlaces.map((item) => item.kind).filter(isNonEmptyString))).sort(sortFilterValues),
    [categoryPlaces]
  );
  const cuisineOptions = useMemo(
    () => Array.from(new Set(categoryPlaces.map((item) => item.cuisine).filter(isNonEmptyString))).sort(sortFilterValues),
    [categoryPlaces]
  );
  const districtOptions = useMemo(
    () => Array.from(new Set(categoryPlaces.map((item) => item.district).filter(isNonEmptyString))).sort(sortFilterValues),
    [categoryPlaces]
  );
  const hotelStarsOptions = useMemo(
    () =>
      Array.from(
        new Set(categoryPlaces.map((item) => item.hotelStars).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)))
      ).sort((a, b) => b - a),
    [categoryPlaces]
  );
  const serviceOptions = useMemo(
    () => Array.from(new Set(categoryPlaces.flatMap((item) => item.services || []).filter(isNonEmptyString))).sort(sortFilterValues),
    [categoryPlaces]
  );
  const tagOptions = useMemo(
    () => Array.from(new Set(categoryPlaces.flatMap((item) => item.tags || []).filter(isNonEmptyString))).sort(sortFilterValues),
    [categoryPlaces]
  );

  const visibleQuickFilters = useMemo(() => {
    const configured = category?.filterSchema?.quickFilters || [];
    return configured.filter((token) => categoryPlaces.some((place) => matchesQuickToken(place, token)));
  }, [category?.filterSchema?.quickFilters, categoryPlaces]);

  const filteredPlaces = useMemo(() => {
    const nextPlaces = categoryPlaces.filter((place) => {
      if (!matchesBinaryFilter(Boolean(place.breakfast), filters.breakfast)) {
        return false;
      }

      if (!matchesBinaryFilter(Boolean(place.vegan), filters.vegan)) {
        return false;
      }

      if (filters.kind !== 'all' && place.kind !== filters.kind) {
        return false;
      }

      if (filters.cuisine !== 'all' && place.cuisine !== filters.cuisine) {
        return false;
      }

      if (filters.district !== 'all' && (place.district || '') !== filters.district) {
        return false;
      }

      const minCheck = Number(filters.minCheck || 0);
      const maxCheck = Number(filters.maxCheck || 0);
      if (minCheck > 0 && Number(place.avgCheck || 0) < minCheck) {
        return false;
      }
      if (maxCheck > 0 && Number(place.avgCheck || 0) > maxCheck) {
        return false;
      }

      if (filters.hotelStars !== 'all' && Number(place.hotelStars || 0) !== Number(filters.hotelStars)) {
        return false;
      }

      if (!matchesBinaryFilter(Boolean(place.hotelPool), filters.hotelPool)) {
        return false;
      }

      if (!matchesBinaryFilter(Boolean(place.hotelSpa), filters.hotelSpa)) {
        return false;
      }

      if (!matchesBinaryFilter(Boolean(place.petFriendly ?? place.pets), filters.petFriendly)) {
        return false;
      }

      if (filters.selectedServices.length > 0 && !filters.selectedServices.every((service) => place.services?.includes(service))) {
        return false;
      }

      if (filters.selectedTags.length > 0 && !filters.selectedTags.every((tag) => place.tags?.includes(tag))) {
        return false;
      }

      if (filters.selectedQuickTokens.length > 0 && !filters.selectedQuickTokens.every((token) => matchesQuickToken(place, token))) {
        return false;
      }

      return true;
    });

    return sortPlaces(nextPlaces, filters.sortMode);
  }, [categoryPlaces, filters]);

  const activeFilterCount = useMemo(() => getActiveFilterCount(filters), [filters]);

  useEffect(() => {
    setFilters(createInitialFilters());
    setRestaurantFilterOpen(false);
  }, [category?.id]);

  if (!category) {
    return (
      <div className="page-stack">
        <PageHeader title="Раздел не найден" subtitle="Возможно, категория скрыта или ещё не создана." showBack />
      </div>
    );
  }

  if (category) {
    const isRestaurantCategory = category.id === 'restaurants';
    const pageQuickFilters = (isRestaurantCategory ? restaurantQuickFilters : visibleQuickFilters).slice(0, 3);

    return (
      <div className="page-stack category-explorer-page category-explorer-page--restaurants">
        <div className="category-page-back-wrap">
          <button className="travel-topbar__button category-page-back" type="button" onClick={handleBack} aria-label="Назад">
            <span className="category-page-back__glyph" aria-hidden="true">‹</span>
          </button>

          <section className="restaurant-filters-shell">
            <div
              className={`restaurant-filters-row${pageQuickFilters.length === 0 ? ' restaurant-filters-row--empty' : ''}`}
              role="toolbar"
              aria-label={`Быстрые фильтры раздела ${category.shortTitle || category.title}`}
            >
              {pageQuickFilters.map((token) => (
                <button
                  key={token}
                  type="button"
                  className={`restaurant-quick-filter ${filters.selectedQuickTokens.includes(token) ? 'is-active' : ''}`}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      selectedQuickTokens: isRestaurantCategory
                        ? current.selectedQuickTokens.includes(token)
                          ? []
                          : [token]
                        : toggleInArray(current.selectedQuickTokens, token)
                    }))
                  }
                >
                  {getFilterDisplayText(token)}
                </button>
              ))}

              <button
                className="restaurant-filter-button"
                type="button"
                onClick={() => setRestaurantFilterOpen(true)}
                aria-label={activeFilterCount > 0 ? `Фильтры, активно ${activeFilterCount}` : 'Фильтры'}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 7h16M7 12h10m-7 5h4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {activeFilterCount > 0 ? <span className="restaurant-filter-button__badge">{activeFilterCount}</span> : null}
              </button>
            </div>
          </section>
        </div>

        {isRestaurantFilterOpen ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setRestaurantFilterOpen(false)}>
            <section
              className="modal-window filter-modal restaurant-filter-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="restaurant-filter-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-window__header modal-window__header--compact restaurant-filter-modal__header">
                <div className="restaurant-filter-modal__heading">
                  <strong id="restaurant-filter-title">Фильтры</strong>
                  {activeFilterCount > 0 ? <span>{`Активно: ${activeFilterCount}`}</span> : null}
                </div>
                <div className="restaurant-filter-modal__header-actions">
                  <button className="modal-window__close" type="button" onClick={() => setRestaurantFilterOpen(false)} aria-label="Закрыть фильтры">
                    ✕
                  </button>
                </div>
              </div>

              <div className="modal-window__body">
                <div className="filter-stack restaurant-filter-stack">
                  {isRestaurantCategory ? (
                    <div className="restaurant-filter-grid">
                      <label className="field field--grow">
                        <span>Кухня</span>
                        <select value={filters.cuisine} onChange={(event) => setFilters((current) => ({ ...current, cuisine: event.target.value }))}>
                          <option value="all">Все</option>
                          {cuisineOptions.map((option) => (
                            <option key={option} value={option}>
                              {getFilterDisplayText(option)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field field--grow">
                        <span>Завтраки</span>
                        <select value={filters.breakfast} onChange={(event) => setFilters((current) => ({ ...current, breakfast: event.target.value as BinaryFilter }))}>
                          <option value="all">Не важно</option>
                          <option value="yes">Да</option>
                          <option value="no">Нет</option>
                        </select>
                      </label>

                      <label className="field field--grow">
                        <span>Веганское меню</span>
                        <select value={filters.vegan} onChange={(event) => setFilters((current) => ({ ...current, vegan: event.target.value as BinaryFilter }))}>
                          <option value="all">Не важно</option>
                          <option value="yes">Да</option>
                          <option value="no">Нет</option>
                        </select>
                      </label>

                      <label className="field field--grow">
                        <span>Можно с животными</span>
                        <select value={filters.petFriendly} onChange={(event) => setFilters((current) => ({ ...current, petFriendly: event.target.value as BinaryFilter }))}>
                          <option value="all">Не важно</option>
                          <option value="yes">Да</option>
                          <option value="no">Нет</option>
                        </select>
                      </label>

                      <div className="filter-grid-two">
                        <label className="field field--grow">
                          <span>Средний чек от</span>
                          <input value={filters.minCheck} onChange={(event) => setFilters((current) => ({ ...current, minCheck: event.target.value }))} inputMode="numeric" placeholder="от" />
                        </label>
                        <label className="field field--grow">
                          <span>Средний чек до</span>
                          <input value={filters.maxCheck} onChange={(event) => setFilters((current) => ({ ...current, maxCheck: event.target.value }))} inputMode="numeric" placeholder="до" />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="restaurant-filter-grid">
                      {filterFields.includes('kind') && kindOptions.length > 0 ? (
                        <label className="field field--grow">
                          <span>{toLabel('kind')}</span>
                          <select value={filters.kind} onChange={(event) => setFilters((current) => ({ ...current, kind: event.target.value }))}>
                            <option value="all">Все</option>
                            {kindOptions.map((option) => (
                              <option key={option} value={option}>
                                {getFilterDisplayText(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      {filterFields.includes('cuisine') && cuisineOptions.length > 0 ? (
                        <label className="field field--grow">
                          <span>{toLabel('cuisine')}</span>
                          <select value={filters.cuisine} onChange={(event) => setFilters((current) => ({ ...current, cuisine: event.target.value }))}>
                            <option value="all">Все</option>
                            {cuisineOptions.map((option) => (
                              <option key={option} value={option}>
                                {getFilterDisplayText(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      {filterFields.includes('district') && districtOptions.length > 0 ? (
                        <label className="field field--grow">
                          <span>{toLabel('district')}</span>
                          <select value={filters.district} onChange={(event) => setFilters((current) => ({ ...current, district: event.target.value }))}>
                            <option value="all">Все районы</option>
                            {districtOptions.map((option) => (
                              <option key={option} value={option}>
                                {getFilterDisplayText(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      {filterFields.includes('hotelStars') ? (
                        <label className="field field--grow">
                          <span>{toLabel('hotelStars')}</span>
                          <select value={filters.hotelStars} onChange={(event) => setFilters((current) => ({ ...current, hotelStars: event.target.value }))}>
                            <option value="all">Любое количество</option>
                            {hotelStarsOptions.map((option) => (
                              <option key={option} value={String(option)}>
                                {option}★
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      {filterFields.includes('hotelPool') ? (
                        <label className="field field--grow">
                          <span>{toLabel('hotelPool')}</span>
                          <select value={filters.hotelPool} onChange={(event) => setFilters((current) => ({ ...current, hotelPool: event.target.value as BinaryFilter }))}>
                            <option value="all">Неважно</option>
                            <option value="yes">Да</option>
                            <option value="no">Нет</option>
                          </select>
                        </label>
                      ) : null}

                      {filterFields.includes('hotelSpa') ? (
                        <label className="field field--grow">
                          <span>{toLabel('hotelSpa')}</span>
                          <select value={filters.hotelSpa} onChange={(event) => setFilters((current) => ({ ...current, hotelSpa: event.target.value as BinaryFilter }))}>
                            <option value="all">Неважно</option>
                            <option value="yes">Да</option>
                            <option value="no">Нет</option>
                          </select>
                        </label>
                      ) : null}

                      {filterFields.includes('petFriendly') ? (
                        <label className="field field--grow">
                          <span>{toLabel('petFriendly')}</span>
                          <select value={filters.petFriendly} onChange={(event) => setFilters((current) => ({ ...current, petFriendly: event.target.value as BinaryFilter }))}>
                            <option value="all">Неважно</option>
                            <option value="yes">Да</option>
                            <option value="no">Нет</option>
                          </select>
                        </label>
                      ) : null}

                      {filterFields.includes('avgCheck') ? (
                        <div className="filter-grid-two">
                          <label className="field field--grow">
                            <span>Мин. чек</span>
                            <input value={filters.minCheck} onChange={(event) => setFilters((current) => ({ ...current, minCheck: event.target.value }))} inputMode="numeric" placeholder="от" />
                          </label>
                          <label className="field field--grow">
                            <span>Макс. чек</span>
                            <input value={filters.maxCheck} onChange={(event) => setFilters((current) => ({ ...current, maxCheck: event.target.value }))} inputMode="numeric" placeholder="до" />
                          </label>
                        </div>
                      ) : null}

                      {filterFields.includes('services') && serviceOptions.length > 0 ? (
                        <div className="field-group restaurant-filter-grid__full">
                          <span className="field-group__label">{toLabel('services')}</span>
                          <div className="chip-row chip-row--wrap">
                            {serviceOptions.map((service) => (
                              <button
                                key={service}
                                type="button"
                                className={`chip chip--action ${filters.selectedServices.includes(service) ? 'is-active' : ''}`}
                                onClick={() => setFilters((current) => ({ ...current, selectedServices: toggleInArray(current.selectedServices, service) }))}
                              >
                                {getFilterDisplayText(service)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {filterFields.includes('tags') && tagOptions.length > 0 ? (
                        <div className="field-group restaurant-filter-grid__full">
                          <span className="field-group__label">{toLabel('tags')}</span>
                          <div className="chip-row chip-row--wrap">
                            {tagOptions.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                className={`chip chip--action ${filters.selectedTags.includes(tag) ? 'is-active' : ''}`}
                                onClick={() => setFilters((current) => ({ ...current, selectedTags: toggleInArray(current.selectedTags, tag) }))}
                              >
                                {getFilterDisplayText(tag)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <label className="field field--grow">
                        <span>Сортировка</span>
                        <select value={filters.sortMode} onChange={(event) => setFilters((current) => ({ ...current, sortMode: event.target.value as SortMode }))}>
                          <option value="priority">По приоритету</option>
                          <option value="alphabet">По алфавиту</option>
                          <option value="check-low">Сначала дешевле</option>
                          <option value="check-high">Сначала дороже</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="restaurant-filter-modal__footer">
                <button className="button button--ghost restaurant-filter-modal__footer-button" type="button" onClick={() => setFilters(createInitialFilters())} disabled={activeFilterCount === 0}>
                  Сбросить
                </button>
                <button className="button button--primary restaurant-filter-modal__footer-button" type="button" onClick={() => setRestaurantFilterOpen(false)}>
                  Показать {formatPlaceCount(filteredPlaces.length)}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {loading ? <div className="travel-state-card">{`Загружаю ${category.shortTitle || category.title.toLowerCase()}…`}</div> : null}
        {error ? (
          <div className="travel-state-card">
            <strong>Не удалось обновить список</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {!loading && filteredPlaces.length > 0 ? (
          <section className="restaurant-list">
            {filteredPlaces.map((item) => {
              const listing = toListingLike(item);
              return (
                <ListingCard
                  key={item.id}
                  listing={listing}
                  accent={category.accent}
                  variant="restaurant"
                  titleOnImage={false}
                />
              );
            })}
          </section>
        ) : null}

        {!loading && filteredPlaces.length === 0 ? (
          <section className="travel-state-card">
            <strong>{categoryPlaces.length > 0 ? 'По выбранным параметрам ничего не найдено' : 'Пока здесь пусто'}</strong>
            <p>
              {categoryPlaces.length > 0
                ? 'Попробуй убрать часть фильтров или изменить выбранные параметры.'
                : 'Когда владелец добавит места, они появятся здесь.'}
            </p>
          </section>
        ) : null}
      </div>
    );
  }

}
