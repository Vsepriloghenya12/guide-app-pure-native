import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import type { BootstrapPayload, GuideCategory, GuideCollection, GuidePlace, GuideTip, SupportContentStore } from './src/types';
import { fetchBootstrap, fetchSupportContent, fetchAuthSession, logoutAuthSession, API_BASE_URL, sendAnalytics } from './src/api/client';
import { appleMapsUrl, directionsUrl, googleMapsUrl, openExternalUrl } from './src/utils/links';
import { estimateTravelTime, formatDistance, hasCoordinates, haversineDistanceKm } from './src/utils/geo';
import { loadFavoriteSlugs, saveFavoriteSlugs } from './src/utils/favorites';
import { clearAuthToken, getCachedAuthUser, readUserFromAuthToken, saveAuthToken } from './src/utils/auth';
import { EmptyState, AppButton, CategoryCard, ListingCard, LoadingState, Pill } from './src/components/ui';
import { normalizeImageUrl } from './src/utils/normalizers';
import { categoryIcons, defaultCategoryIcon, heroBackground, heroLogo } from './src/assets';

type TabKey = 'home' | 'sections' | 'search' | 'favorites' | 'nearby' | 'contacts';
type Route =
  | { name: 'tabs'; tab: TabKey }
  | { name: 'category'; categoryId: string }
  | { name: 'routes' }
  | { name: 'routeDetail'; routeId: string }
  | { name: 'tips' }
  | { name: 'programs' }
  | { name: 'detail'; slug: string };

const tabItems: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'Главная', icon: '⌂' },
  { key: 'search', label: 'Поиск', icon: '⌕' },
  { key: 'nearby', label: 'Карта', icon: '⌖' },
  { key: 'favorites', label: 'Избранное', icon: '♥' },
  { key: 'contacts', label: 'Помощь', icon: '•••' }
];

const hiddenHomeCategoryIds = new Set(['events']);
const restaurantQuickFilters = ['Морепродукты', 'Вьетнамская', 'Европейская'];

const filterTextMap: Record<string, string> = {
  breakfast: 'Завтраки',
  vegan: 'Веган-опции',
  pets: 'Можно с животными',
  childprograms: 'Для детей',
  nightlife: 'Ночная жизнь',
  free: 'Бесплатно',
  outdoor: 'На улице',
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
  spa: 'СПА',
  massage: 'Массаж',
  mountains: 'Горы',
  airport: 'Аэропорт',
  cash: 'Наличные',
  center: 'Центр',
  souvenirs: 'Сувениры',
  culture: 'Культура',
  history: 'История',
  kids: 'Детям',
  emergency: 'Экстренно',
  hospital: 'Больница',
  photo: 'Фото',
  coworking: 'Коворкинг',
  resort: 'Курорт',
  beach: 'Пляж'
};

const rawGoogleMapsApiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
const hasGoogleMapsApiKey =
  rawGoogleMapsApiKey.length > 12 &&
  !rawGoogleMapsApiKey.includes('your_google_maps') &&
  !rawGoogleMapsApiKey.includes('твой_google') &&
  rawGoogleMapsApiKey !== 'AIza...';

const ANDROID_STATUS_BAR_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const ANDROID_NAVIGATION_BAR_INSET = Platform.OS === 'android' ? 34 : 0;
const BOTTOM_TABS_VISIBLE_HEIGHT = 66 + ANDROID_NAVIGATION_BAR_INSET;

function routeKey(route: Route) {
  if (route.name === 'tabs') return `tabs:${route.tab}`;
  if (route.name === 'category') return `category:${route.categoryId}`;
  if (route.name === 'routeDetail') return `routeDetail:${route.routeId}`;
  if (route.name === 'detail') return `detail:${route.slug}`;
  return route.name;
}

function fallbackBackRoute(route: Route): Route | null {
  if (route.name === 'routeDetail') return { name: 'routes' };
  if (route.name === 'category' || route.name === 'routes' || route.name === 'programs' || route.name === 'tips' || route.name === 'detail') {
    return { name: 'tabs', tab: 'home' };
  }
  if (route.name === 'tabs' && route.tab !== 'home') {
    return { name: 'tabs', tab: 'home' };
  }
  return null;
}

function isAuthDeepLink(url: string | null) {
  const value = String(url || '').trim();
  if (!value) return false;

  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol.replace(/:$/g, '').toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\/+/, '').toLowerCase();
    return protocol === 'danangguide' && (host === 'auth' || path === 'auth');
  } catch {
    return /^danangguide:\/\/\/?auth/i.test(value);
  }
}

function parseDeepLinkParams(url: string) {
  const value = String(url || '');
  const queryParts: string[] = [];
  const questionIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');

  if (questionIndex >= 0) {
    const queryEnd = hashIndex >= 0 && hashIndex > questionIndex ? hashIndex : value.length;
    queryParts.push(value.slice(questionIndex + 1, queryEnd));
  }

  if (hashIndex >= 0) {
    const hashValue = value.slice(hashIndex + 1);
    const hashQuestionIndex = hashValue.indexOf('?');
    queryParts.push(hashQuestionIndex >= 0 ? hashValue.slice(hashQuestionIndex + 1) : hashValue);
  }

  return queryParts
    .join('&')
    .split('&')
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, part) => {
      const separatorIndex = part.indexOf('=');
      const rawKey = separatorIndex >= 0 ? part.slice(0, separatorIndex) : part;
      const rawValue = separatorIndex >= 0 ? part.slice(separatorIndex + 1) : '';
      const key = decodeURIComponent(rawKey || '').trim();
      if (key) {
        accumulator[key] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
      }
      return accumulator;
    }, {});
}

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function mapUnavailableText() {
  return hasGoogleMapsApiKey
    ? 'Карту временно не удалось открыть на этом устройстве. Можно открыть точку во внешнем Google Maps.'
    : 'Для встроенной карты в APK нужен Google Maps Android API key. Пока можно открыть маршрут во внешнем Google Maps.';
}

function normalizeToken(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function getFilterDisplayText(value: string) {
  const normalized = normalizeToken(value);
  return filterTextMap[normalized] || value;
}

function matchesQuickToken(place: GuidePlace, token: string) {
  const normalized = normalizeToken(token);
  if (!normalized) return true;

  if (normalized === 'breakfast') return Boolean(place.breakfast);
  if (normalized === 'vegan') return Boolean(place.vegan);
  if (normalized === 'pets') return Boolean(place.petFriendly ?? place.pets);
  if (normalized === 'childprograms') return Boolean(place.childPrograms ?? place.childFriendly);

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
    ...toTextArray((place as GuidePlace & { services?: unknown }).services),
    ...toTextArray((place as GuidePlace & { tags?: unknown }).tags)
  ]
    .filter(Boolean)
    .map((value) => normalizeToken(String(value)));

  return haystack.some((value) => value.includes(normalized));
}



function toText(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return toText(record.title || record.name || record.label || record.text || record.value, fallback);
  }
  return fallback;
}

function toTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }
  const textValue = toText(value);
  if (!textValue) return [];
  return textValue.split(/\n|,/g).map((item) => item.trim()).filter(Boolean);
}

function getPlaceImageUrls(place: GuidePlace) {
  const record = place as GuidePlace & { imageGallery?: unknown; imageUrls?: unknown };
  return [
    toText(record.coverImageUrl),
    toText(record.imageSrc),
    ...toTextArray(record.imageGallery),
    ...toTextArray(record.imageUrls)
  ]
    .map((item) => normalizeImageUrl(item, API_BASE_URL))
    .filter(Boolean) as string[];
}

function getPrimaryImageUrl(place: GuidePlace) {
  return getPlaceImageUrls(place)[0] || '';
}

function placeCoordinate(place: GuidePlace) {
  let lat = typeof place.lat === 'number' ? place.lat : Number(place.lat);
  let lng = typeof place.lng === 'number' ? place.lng : Number(place.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Иногда координаты из CMS вводят наоборот: lng в поле lat, lat в поле lng.
  // Для Android-карты это может дать пустой синий экран или ошибку рендера.
  if (!isValidLatitude(lat) && isValidLatitude(lng) && isValidLongitude(lat)) {
    const previousLat = lat;
    lat = lng;
    lng = previousLat;
  }

  if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;
  return { latitude: lat, longitude: lng };
}

function buildMapRegion(points: Array<{ latitude: number; longitude: number }>): Region {
  if (points.length === 0) {
    return { latitude: 16.0678, longitude: 108.2208, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }

  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latitudeDelta = Math.max(0.025, (maxLat - minLat) * 1.8);
  const longitudeDelta = Math.max(0.025, (maxLng - minLng) * 1.8);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta,
    longitudeDelta
  };
}

function normalizeBulletinSection(value: unknown) {
  const text = toText(value, 'Разное');
  const normalized = normalizeToken(text);
  if (!normalized || normalized.includes('аренд')) return 'Разное';
  return text;
}

function buildRoutesShortcut(): GuideCategory {
  return {
    id: 'routes',
    title: 'Маршруты',
    path: '/routes',
    description: 'Готовые городские маршруты с описанием точек и схемой движения.',
    visible: true,
    showOnHome: true,
    slug: 'routes',
    shortTitle: 'Маршруты',
    accent: 'bridge',
    imageSrc: '',
    filterSchema: {
      quickFilters: [],
      fields: []
    },
    sortOrder: 82
  };
}

function withRoutesShortcut(categories: GuideCategory[]) {
  if (categories.some((category) => category.id === 'routes')) {
    return categories;
  }

  const shortcut = buildRoutesShortcut();
  const insertAfterId = 'active-rest';
  const insertIndex = categories.findIndex((category) => category.id === insertAfterId);

  if (insertIndex < 0) {
    return [...categories, shortcut];
  }

  return [...categories.slice(0, insertIndex + 1), shortcut, ...categories.slice(insertIndex + 1)];
}

type NativeRoutePoint = {
  title: string;
  text: string;
  lat: number;
  lng: number;
};

type NativeRoute = {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  distance: string;
  description: string;
  sees: string[];
  points: NativeRoutePoint[];
};

const nativeRoutes: NativeRoute[] = [
  {
    id: 'center-evening',
    title: 'Первый вечер в центре Дананга',
    subtitle: 'Короткая прогулка, еда и Dragon Bridge без сложной логистики.',
    duration: '2-3 часа',
    distance: '3.5 км',
    description: 'Маршрут для первого знакомства с городом: набережная, центр, вечерний мост и спокойный ужин рядом с рекой.',
    sees: ['Набережную Han River', 'Dragon Bridge вечером', 'Кафе и рестораны центра', 'Видовые точки для фото'],
    points: [
      { title: 'Han Market', text: 'Старт в центре, можно быстро купить воду и посмотреть городской рынок.', lat: 16.068, lng: 108.224 },
      { title: 'Набережная Han River', text: 'Прогулка вдоль реки и вид на мосты.', lat: 16.064, lng: 108.226 },
      { title: 'Dragon Bridge', text: 'Главная вечерняя точка маршрута.', lat: 16.061, lng: 108.227 },
      { title: 'Ужин рядом с рекой', text: 'Финал маршрута в ресторане или кафе неподалёку.', lat: 16.060, lng: 108.229 }
    ]
  },
  {
    id: 'sea-and-views',
    title: 'Море и виды города',
    subtitle: 'Пляж, кофе, смотровые точки и спокойный темп.',
    duration: 'полдня',
    distance: '8-12 км',
    description: 'Маршрут для дня у воды: пляж, короткие остановки у моря и красивые виды без перегруза.',
    sees: ['Пляж My Khe', 'Кофейни у моря', 'Панорамные виды', 'Фото-точки на побережье'],
    points: [
      { title: 'My Khe Beach', text: 'Старт с пляжа и прогулки у моря.', lat: 16.061, lng: 108.247 },
      { title: 'Кофейня у пляжа', text: 'Пауза на кофе и лёгкий завтрак.', lat: 16.066, lng: 108.246 },
      { title: 'Son Tra View', text: 'Видовая часть маршрута.', lat: 16.107, lng: 108.263 }
    ]
  },
  {
    id: 'culture-day',
    title: 'Культура и старый город',
    subtitle: 'Храмы, музеи, локальные улицы и спокойные остановки.',
    duration: '4-5 часов',
    distance: '6 км',
    description: 'Маршрут для тех, кто хочет увидеть не только пляжный Дананг, но и культурные точки города.',
    sees: ['Музей', 'Храмовые точки', 'Локальные улицы', 'Кофе-паузы между остановками'],
    points: [
      { title: 'Cham Museum', text: 'Главная культурная точка в центре.', lat: 16.060, lng: 108.223 },
      { title: 'Локальные кварталы', text: 'Короткая прогулка по спокойным улицам.', lat: 16.067, lng: 108.219 },
      { title: 'Кофе и отдых', text: 'Финальная остановка перед возвращением.', lat: 16.071, lng: 108.224 }
    ]
  }
];

function googleRouteUrl(route: NativeRoute) {
  const origin = route.points[0];
  const destination = route.points[route.points.length - 1];
  const waypoints = route.points.slice(1, -1).map((point) => `${point.lat},${point.lng}`).join('|');
  const params = [`api=1`, `travelmode=walking`, `origin=${origin.lat},${origin.lng}`, `destination=${destination.lat},${destination.lng}`];
  if (waypoints) params.push(`waypoints=${encodeURIComponent(waypoints)}`);
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

function googleRoutePointsUrl(points: NativeRoutePoint[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `https://www.google.com/maps/search/?api=1&query=${points[0].lat},${points[0].lng}`;

  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1).map((point) => `${point.lat},${point.lng}`).join('|');
  const params = [`api=1`, `travelmode=walking`, `origin=${origin.lat},${origin.lng}`, `destination=${destination.lat},${destination.lng}`];
  if (waypoints) params.push(`waypoints=${encodeURIComponent(waypoints)}`);
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}


function normalizeBannerLink(value: unknown) {
  const raw = toText(value).trim();
  if (!raw || raw === '#') return '';
  if (/^(https?:|mailto:|tel:|tg:|telegram:|whatsapp:|geo:|maps:|danangguide:)/i.test(raw)) {
    return raw;
  }
  if (/^www\./i.test(raw)) {
    return `https://${raw}`;
  }
  return raw;
}

function isExternalBannerLink(value: string) {
  return /^(https?:|mailto:|tel:|tg:|telegram:|whatsapp:|geo:|maps:)/i.test(value);
}

function positiveModulo(value: number, divisor: number) {
  if (!divisor) return 0;
  return ((value % divisor) + divisor) % divisor;
}

function dedupeHomeCategories(categories: GuideCategory[]) {
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();

  return categories.filter((category) => {
    const labelKey = String(category.shortTitle || category.title || '').trim().toLowerCase();

    if (seenIds.has(category.id) || (labelKey && seenLabels.has(labelKey))) {
      return false;
    }

    seenIds.add(category.id);
    if (labelKey) {
      seenLabels.add(labelKey);
    }
    return true;
  });
}

type AppErrorBoundaryState = { hasError: boolean; message: string };

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Не удалось открыть экран</Text>
          <Text style={styles.errorText}>{this.state.message}</Text>
          <TouchableOpacity activeOpacity={0.86} onPress={() => this.setState({ hasError: false, message: '' })} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Вернуться</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}

function AppContent() {
  const [route, setRouteState] = useState<Route>({ name: 'tabs', tab: 'home' });
  const routeRef = useRef<Route>(route);
  const routeHistoryRef = useRef<Route[]>([]);
  const [hasBackRoute, setHasBackRoute] = useState(false);
  const [payload, setPayload] = useState<BootstrapPayload | null>(null);
  const [support, setSupport] = useState<SupportContentStore | null>(null);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthSheetOpen, setAuthSheetOpen] = useState(false);
  const [authUser, setAuthUser] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  const setRoute = useCallback((nextRoute: Route, options?: { replace?: boolean }) => {
    const currentRoute = routeRef.current;
    if (!options?.replace && routeKey(currentRoute) !== routeKey(nextRoute)) {
      routeHistoryRef.current = [...routeHistoryRef.current, currentRoute].slice(-24);
      setHasBackRoute(routeHistoryRef.current.length > 0);
    }
    routeRef.current = nextRoute;
    setRouteState(nextRoute);
  }, []);

  const goBack = useCallback(() => {
    const previousRoute = routeHistoryRef.current.pop();
    setHasBackRoute(routeHistoryRef.current.length > 0);

    if (previousRoute) {
      routeRef.current = previousRoute;
      setRouteState(previousRoute);
      return;
    }

    const fallbackRoute = fallbackBackRoute(routeRef.current);
    if (fallbackRoute) {
      routeRef.current = fallbackRoute;
      setRouteState(fallbackRoute);
    }
  }, []);

  const canGoBack = hasBackRoute || Boolean(fallbackBackRoute(route));

  const backSwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      canGoBack &&
      gesture.x0 <= 36 &&
      gesture.dx > 22 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.45
    ),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 72 || gesture.vx > 0.65) {
        goBack();
      }
    }
  }), [canGoBack, goBack]);

  const loadApp = useCallback(async () => {
    const [nextPayload, nextSupport, savedFavorites, authSession, cachedAuthUser] = await Promise.all([
      fetchBootstrap(),
      fetchSupportContent(),
      loadFavoriteSlugs(),
      fetchAuthSession(),
      getCachedAuthUser()
    ]);
    setPayload(nextPayload);
    setSupport(nextSupport);
    setFavoriteSlugs(savedFavorites);
    setAuthUser(
      authSession.authenticated && authSession.user && typeof authSession.user === 'object'
        ? authSession.user as Record<string, unknown>
        : cachedAuthUser
    );
  }, []);

  useEffect(() => {
    void loadApp();
  }, [loadApp]);

  const handleAuthDeepLink = useCallback(async (url: string | null) => {
    if (!isAuthDeepLink(url)) return;
    const params = parseDeepLinkParams(String(url || ''));

    if (params.auth === 'success' && params.sessionToken) {
      await saveAuthToken(params.sessionToken);
      const userFromToken = readUserFromAuthToken(params.sessionToken);
      const authSession = await fetchAuthSession();

      if (authSession.authenticated && authSession.user && typeof authSession.user === 'object') {
        setAuthUser(authSession.user as Record<string, unknown>);
      } else if (userFromToken) {
        setAuthUser(userFromToken);
      }

      setAuthSheetOpen(false);
      await loadApp();
      return;
    }

    if (params.auth === 'error') {
      setAuthSheetOpen(true);
    }
  }, [loadApp]);

  useEffect(() => {
    void Linking.getInitialURL().then(handleAuthDeepLink);
    const subscription = Linking.addEventListener('url', (event) => {
      void handleAuthDeepLink(event.url);
    });
    return () => subscription.remove();
  }, [handleAuthDeepLink]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadApp();
    } finally {
      setRefreshing(false);
    }
  }, [loadApp]);

  const categories = payload?.categories ?? [];
  const listings = payload?.listings ?? [];
  const favoriteSet = useMemo(() => new Set(favoriteSlugs), [favoriteSlugs]);

  const toggleFavorite = useCallback(async (slug: string) => {
    const next = favoriteSet.has(slug)
      ? favoriteSlugs.filter((item) => item !== slug)
      : [...favoriteSlugs, slug];
    setFavoriteSlugs(next);
    await saveFavoriteSlugs(next);
  }, [favoriteSet, favoriteSlugs]);

  const handleLogout = useCallback(async () => {
    await logoutAuthSession();
    await clearAuthToken();
    setAuthUser(null);
    setAuthSheetOpen(false);
  }, []);

  const openCategory = useCallback((category: GuideCategory) => {
    if (category.id === 'routes') {
      void sendAnalytics('category-click', category.title, '/routes', category.id, category.id);
      setRoute({ name: 'routes' });
      return;
    }
    if (category.id === 'programs') {
      setRoute({ name: 'programs' });
      return;
    }
    void sendAnalytics('category-click', category.title, `/section/${category.slug}`, category.id, category.id);
    setRoute({ name: 'category', categoryId: category.id });
  }, []);

  const openDetail = useCallback((place: GuidePlace) => {
    void sendAnalytics('place-click', place.title, `/place/${place.slug}`, place.id, place.categoryId);
    setRoute({ name: 'detail', slug: place.slug || place.id });
  }, []);

  if (!payload) {
    return <LoadingState />;
  }

  const selectedCategory = route.name === 'category' ? categories.find((item) => item.id === route.categoryId) : null;
  const selectedListing = route.name === 'detail' ? listings.find((item) => item.slug === route.slug || item.id === route.slug) : null;
  const isHomeRoot = route.name === 'tabs' && route.tab === 'home';
  const hideTopHeader = isHomeRoot || route.name === 'category' || route.name === 'routes' || route.name === 'routeDetail' || route.name === 'programs' || route.name === 'tips';

  return (
    <View style={styles.safeArea} {...backSwipeResponder.panHandlers}>
      <StatusBar translucent barStyle="dark-content" backgroundColor="transparent" />
      {!hideTopHeader ? (
        <View style={styles.appHeader}>
          <View>
            <Text style={styles.logoText}>Твой гид</Text>
            <Text style={styles.logoSubtext}>{API_BASE_URL ? 'native app · Railway API' : 'native app · offline seed'}</Text>
          </View>
          {route.name !== 'tabs' ? (
            <TouchableOpacity activeOpacity={0.8} onPress={goBack} style={styles.headerBackButton}>
              <Text style={styles.headerBackText}>Назад</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {route.name === 'detail' && selectedListing ? (
        <DetailScreen
          place={selectedListing}
          category={categories.find((item) => item.id === selectedListing.categoryId)}
          isFavorite={favoriteSet.has(selectedListing.slug || selectedListing.id)}
          onToggleFavorite={() => void toggleFavorite(selectedListing.slug || selectedListing.id)}
        />
      ) : route.name === 'routeDetail' ? (
        <RouteDetailScreen
          route={nativeRoutes.find((item) => item.id === route.routeId) || nativeRoutes[0]}
          onBack={goBack}
        />
      ) : route.name === 'routes' ? (
        <RoutesScreen
          onBack={goBack}
          onOpenRoute={(routeId) => setRoute({ name: 'routeDetail', routeId })}
        />
      ) : route.name === 'programs' ? (
        <ProgramsScreen onBack={goBack} />
      ) : route.name === 'tips' ? (
        <TipsScreen
          tips={payload.tips.filter((tip) => tip.active)}
          onBack={goBack}
        />
      ) : route.name === 'category' && selectedCategory ? (
        <CategoryScreen
          category={selectedCategory}
          listings={listings.filter((item) => item.categoryId === selectedCategory.id)}
          favoriteSet={favoriteSet}
          toggleFavorite={toggleFavorite}
          openDetail={openDetail}
          refreshing={refreshing}
          refresh={refresh}
          onBack={goBack}
        />
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentInner, isHomeRoot && styles.homeContentInner]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          {route.name === 'tabs' && route.tab === 'home' ? (
            <HomeScreen
              payload={payload}
              favoriteSet={favoriteSet}
              openCategory={openCategory}
              openDetail={openDetail}
              toggleFavorite={toggleFavorite}
              onOpenAuth={() => setAuthSheetOpen(true)}
              onOpenPrograms={() => setRoute({ name: 'programs' })}
              onOpenTips={() => setRoute({ name: 'tips' })}
            />
          ) : null}
          {route.name === 'tabs' && route.tab === 'sections' ? (
            <SectionsScreen categories={categories} listings={listings} openCategory={openCategory} />
          ) : null}
          {route.name === 'tabs' && route.tab === 'search' ? (
            <SearchScreen listings={listings} favoriteSet={favoriteSet} openDetail={openDetail} toggleFavorite={toggleFavorite} />
          ) : null}
          {route.name === 'tabs' && route.tab === 'favorites' ? (
            <FavoritesScreen listings={listings.filter((item) => favoriteSet.has(item.slug || item.id))} favoriteSet={favoriteSet} openDetail={openDetail} toggleFavorite={toggleFavorite} />
          ) : null}
          {route.name === 'tabs' && route.tab === 'nearby' ? (
            <NearbyScreen listings={listings} favoriteSet={favoriteSet} openDetail={openDetail} toggleFavorite={toggleFavorite} />
          ) : null}
          {route.name === 'tabs' && route.tab === 'contacts' && support ? (
            <ContactsScreen support={support} />
          ) : null}
        </ScrollView>
      )}
      {route.name !== 'detail' ? (
        <BottomTabs active={route.name === 'tabs' ? route.tab : 'home'} onChange={(tab) => setRoute({ name: 'tabs', tab })} />
      ) : null}
      <AuthSheet visible={isAuthSheetOpen} user={authUser} onClose={() => setAuthSheetOpen(false)} onLogout={handleLogout} />
    </View>
  );
}

function HomeScreen({
  payload,
  favoriteSet,
  openCategory,
  openDetail,
  toggleFavorite,
  onOpenAuth,
  onOpenPrograms,
  onOpenTips
}: {
  payload: BootstrapPayload;
  favoriteSet: Set<string>;
  openCategory: (category: GuideCategory) => void;
  openDetail: (place: GuidePlace) => void;
  toggleFavorite: (slug: string) => void;
  onOpenAuth: () => void;
  onOpenPrograms: () => void;
  onOpenTips: () => void;
}) {
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [selectedTip, setSelectedTip] = useState<GuideTip | null>(null);
  const bannerScrollRef = useRef<ScrollView | null>(null);
  const { width: viewportWidth } = useWindowDimensions();
  const visibleCategories = useMemo(
    () => dedupeHomeCategories(
      withRoutesShortcut(payload.categories.filter((category) => category.visible && !hiddenHomeCategoryIds.has(category.id)))
    ),
    [payload.categories]
  );
  const activeBanners = useMemo(() => payload.collections.filter((collection) => collection.active), [payload.collections]);
  const visibleTips = useMemo(() => payload.tips.filter((tip) => tip.active).slice(0, 3), [payload.tips]);
  const bannerGap = 12;
  const bannerCardWidth = Math.max(248, Math.min(viewportWidth - 54, viewportWidth * 0.78));
  const bannerSideInset = Math.max(18, (viewportWidth - bannerCardWidth) / 2);
  const bannerStep = bannerCardWidth + bannerGap;

  useEffect(() => {
    setActiveHeroIndex(0);
    requestAnimationFrame(() => bannerScrollRef.current?.scrollTo({ x: 0, animated: false }));
  }, [activeBanners.length]);

  const scrollToBanner = useCallback((index: number) => {
    if (activeBanners.length < 1) return;
    const nextIndex = positiveModulo(index, activeBanners.length);
    setActiveHeroIndex(nextIndex);
    bannerScrollRef.current?.scrollTo({ x: nextIndex * bannerStep, animated: true });
  }, [activeBanners.length, bannerStep]);

  const handleBannerMomentumEnd = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (activeBanners.length < 2) return;
    const nextIndex = Math.max(0, Math.min(activeBanners.length - 1, Math.round(event.nativeEvent.contentOffset.x / bannerStep)));
    setActiveHeroIndex(nextIndex);
  }, [activeBanners.length, bannerStep]);

  const openBannerLink = useCallback((banner: GuideCollection) => {
    const link = normalizeBannerLink(banner.linkPath);
    if (!link || link === '/') return;

    void sendAnalytics('collection-click', banner.title, link, banner.id);

    if (isExternalBannerLink(link)) {
      void openExternalUrl(link);
      return;
    }

    if (link === '/programs' || link === 'programs') {
      onOpenPrograms();
      return;
    }

    if (link === '/routes' || link === 'routes') {
      openCategory(buildRoutesShortcut());
      return;
    }

    const sectionMatch = link.match(/^\/?section\/([^/?#]+)/i);
    if (sectionMatch?.[1]) {
      const targetSlug = decodeURIComponent(sectionMatch[1]);
      const targetCategory = payload.categories.find((category) => category.slug === targetSlug || category.id === targetSlug);
      if (targetCategory) {
        openCategory(targetCategory);
        return;
      }
    }

    const placeMatch = link.match(/^\/?place\/([^/?#]+)/i);
    if (placeMatch?.[1]) {
      const targetSlug = decodeURIComponent(placeMatch[1]);
      const targetPlace = payload.listings.find((place) => place.slug === targetSlug || place.id === targetSlug);
      if (targetPlace) {
        openDetail(targetPlace);
        return;
      }
    }

    if (/^\//.test(link)) {
      return;
    }

    void openExternalUrl(`https://${link}`);
  }, [onOpenPrograms, openCategory, openDetail, payload.categories, payload.listings]);

  return (
    <View style={[styles.homeRoot, { width: viewportWidth, maxWidth: viewportWidth }]}>
      <ImageBackground source={heroBackground} style={[styles.homeHero, { width: viewportWidth }]} imageStyle={styles.homeHeroImage}>
        <View style={styles.homeHeroOverlay} />
        <TouchableOpacity activeOpacity={0.86} onPress={onOpenAuth} style={styles.heroAuthButton}>
          <Text style={styles.heroAuthIcon}>👤</Text>
        </TouchableOpacity>
        <Image source={heroLogo} resizeMode="contain" style={styles.heroLogoImage} />
      </ImageBackground>

      <View style={[styles.homeBody, { width: viewportWidth }]}> 
        {activeBanners.length > 0 ? (
          <View style={styles.bannerStack}>
            <ScrollView
              ref={bannerScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={bannerStep}
              decelerationRate="fast"
              disableIntervalMomentum
              bounces={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleBannerMomentumEnd}
              contentContainerStyle={[styles.bannerScrollerContent, { paddingHorizontal: bannerSideInset, gap: bannerGap }]}
            >
              {activeBanners.map((banner) => (
                <TouchableOpacity
                  key={banner.id}
                  activeOpacity={0.9}
                  onPress={() => openBannerLink(banner)}
                  style={[styles.homeBanner, styles.homeBannerSlide, { width: bannerCardWidth }]}
                >
                  <ImageBackground source={bannerImageSource(banner)} style={styles.full} imageStyle={styles.homeBannerImage}>
                    {Boolean(toText(banner.title) || toText(banner.description)) ? (
                      <View style={styles.homeBannerTextWrap}>
                        {toText(banner.title) ? <Text style={styles.homeBannerTitle} numberOfLines={2}>{banner.title}</Text> : null}
                        {toText(banner.description) ? <Text style={styles.homeBannerText} numberOfLines={3}>{banner.description}</Text> : null}
                      </View>
                    ) : null}
                  </ImageBackground>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {activeBanners.length > 1 ? (
              <View style={styles.bannerDots}>
                {activeBanners.map((banner, index) => (
                  <TouchableOpacity key={banner.id} activeOpacity={0.82} onPress={() => scrollToBanner(index)} style={[styles.bannerDot, activeHeroIndex === index && styles.bannerDotActive]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.quickGrid}>
          {visibleCategories.map((category, index) => (
            <HomeCategoryIcon key={category.id} category={category} index={index} onPress={() => openCategory(category)} />
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.88} onPress={onOpenPrograms} style={styles.programSpotlight}>
          <View style={styles.programBlob} />
          <Text style={styles.programEyebrow}>Готовые программы</Text>
          <Text style={styles.programTitle}>Подбери сценарий отдыха по сроку поездки</Text>
          <Text style={styles.programText}>Открой готовые варианты для короткого отпуска, недели у моря и более длинного отдыха, не собирая маршрут вручную.</Text>
          <View style={styles.programChips}>
            {['2-3 дня', '4-5 дней', '6-7 дней'].map((item) => (
              <View key={item} style={styles.programChip}>
                <Text style={styles.programChipText}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.programAction}>Открыть программы ›</Text>
        </TouchableOpacity>

        {visibleTips.length > 0 ? (
          <View style={styles.homeSection}>
            <View style={styles.homeSectionHeader}>
              <View style={styles.homeSectionHeaderSide} />
              <Text style={styles.homeSectionTitle}>{payload.home.sectionTitles?.tips || 'Советы'}</Text>
              <TouchableOpacity activeOpacity={0.78} onPress={onOpenTips} style={styles.homeSectionAllButton}>
                <Text style={styles.homeSectionLink}>Все</Text>
              </TouchableOpacity>
            </View>
            {visibleTips.map((tip) => (
              <TouchableOpacity key={tip.id} activeOpacity={0.78} onPress={() => setSelectedTip(tip)} style={styles.tipRow}>
                <Image source={heroBackground} style={styles.tipThumb} />
                <View style={styles.flex}>
                  <Text style={styles.tipTitle} numberOfLines={1}>{tip.title}</Text>
                  <Text style={styles.tipText} numberOfLines={2}>{tip.text}</Text>
                </View>
                <Text style={styles.tipChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Modal visible={Boolean(selectedTip)} transparent animationType="fade" onRequestClose={() => setSelectedTip(null)}>
          <View style={styles.tipModalBackdrop}>
            <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={() => setSelectedTip(null)} />
            <View style={styles.tipModalCard}>
              <View style={styles.tipModalHandle} />
              <Text style={styles.tipModalEyebrow}>Совет</Text>
              <Text style={styles.tipModalTitle}>{selectedTip?.title}</Text>
              <Text style={styles.tipModalText}>{selectedTip?.text}</Text>
              <TouchableOpacity activeOpacity={0.86} onPress={() => setSelectedTip(null)} style={styles.tipModalButton}>
                <Text style={styles.tipModalButtonText}>Понятно</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </View>
  );
}

function bannerImageSource(collection: GuideCollection) {
  const image = normalizeImageUrl(collection.imageSrc, API_BASE_URL);
  return image ? { uri: image } : heroBackground;
}

function HomeCategoryIcon({ category, index, onPress }: { category: GuideCategory; index: number; onPress: () => void }) {
  const icon = categoryIcons[category.id] || defaultCategoryIcon;
  const { width } = useWindowDimensions();
  const iconSize = Math.min(84, Math.max(66, Math.floor((width - 80) / 4)));
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={styles.quickItem}>
      <Image source={icon} style={[styles.quickIcon, { width: iconSize, height: iconSize, borderRadius: Math.round(iconSize * 0.26) }]} resizeMode="cover" />
      <Text style={styles.quickLabel} numberOfLines={2}>{category.shortTitle || category.title}</Text>
    </TouchableOpacity>
  );
}

function SectionsScreen({ categories, listings, openCategory }: { categories: GuideCategory[]; listings: GuidePlace[]; openCategory: (category: GuideCategory) => void }) {
  const sectionCategories = withRoutesShortcut(categories.filter((category) => category.visible));
  return (
    <View style={styles.screenGap}>
      <ScreenHeader title="Разделы" text="Все рубрики гида по Данангу." />
      {sectionCategories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          count={category.id === 'routes' ? nativeRoutes.length : listings.filter((item) => item.categoryId === category.id).length}
          onPress={() => openCategory(category)}
        />
      ))}
    </View>
  );
}

function CategoryScreen({
  category,
  listings,
  favoriteSet,
  toggleFavorite,
  openDetail,
  refreshing,
  refresh,
  onBack
}: {
  category: GuideCategory;
  listings: GuidePlace[];
  favoriteSet: Set<string>;
  toggleFavorite: (slug: string) => void;
  openDetail: (place: GuidePlace) => void;
  refreshing: boolean;
  refresh: () => void;
  onBack: () => void;
}) {
  const [selectedQuickTokens, setSelectedQuickTokens] = useState<string[]>([]);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const quickFilters = (category.id === 'restaurants' ? restaurantQuickFilters : category.filterSchema?.quickFilters || []).slice(0, 3);
  const publishedListings = useMemo(
    () => listings.filter((item) => item.status !== 'hidden' && item.status !== 'draft'),
    [listings]
  );
  const filteredListings = useMemo(
    () => selectedQuickTokens.length
      ? publishedListings.filter((place) => selectedQuickTokens.every((token) => matchesQuickToken(place, token)))
      : publishedListings,
    [publishedListings, selectedQuickTokens]
  );

  const toggleQuickFilter = useCallback((token: string) => {
    setSelectedQuickTokens((current) => {
      if (category.id === 'restaurants') {
        return current.includes(token) ? [] : [token];
      }
      return current.includes(token) ? current.filter((item) => item !== token) : [...current, token];
    });
  }, [category.id]);

  const renderListing = useCallback(({ item }: { item: GuidePlace }) => (
    <CategoryListingCard
      place={item}
      isFavorite={favoriteSet.has(item.slug || item.id)}
      onPress={() => openDetail(item)}
      onToggleFavorite={() => toggleFavorite(item.slug || item.id)}
    />
  ), [favoriteSet, openDetail, toggleFavorite]);

  const listHeader = (
    <>
      <View style={styles.categoryToolbar}>
        <TouchableOpacity activeOpacity={0.82} onPress={onBack} style={styles.categoryBackButton}>
          <Text style={styles.categoryBackGlyph}>‹</Text>
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryQuickRow}>
          {quickFilters.map((token) => {
            const isActive = selectedQuickTokens.includes(token);
            return (
              <TouchableOpacity key={token} activeOpacity={0.78} onPress={() => toggleQuickFilter(token)} style={styles.categoryQuickButton}>
                <Text style={[styles.categoryQuickText, isActive && styles.categoryQuickTextActive]}>{getFilterDisplayText(token)}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity activeOpacity={0.78} onPress={() => setFilterOpen(true)} style={styles.categoryFilterButton}>
            <Text style={styles.categoryFilterIcon}>☰</Text>
            {selectedQuickTokens.length > 0 ? <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{selectedQuickTokens.length}</Text></View> : null}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {category.id !== 'restaurants' ? (
        <View style={styles.categoryTitleBlock}>
          <Text style={styles.categoryTitleText}>{category.title}</Text>
          {category.description ? <Text style={styles.categoryDescriptionText}>{category.description}</Text> : null}
        </View>
      ) : null}
    </>
  );

  if (category.id === 'bulletin-board') {
    return (
      <BulletinBoardScreen
        listings={publishedListings}
        favoriteSet={favoriteSet}
        toggleFavorite={toggleFavorite}
        openDetail={openDetail}
        refreshing={refreshing}
        refresh={refresh}
        onBack={onBack}
      />
    );
  }

  return (
    <>
      <FlatList
        data={filteredListings}
        keyExtractor={(item) => item.id}
        renderItem={renderListing}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<EmptyState title="Пока пусто" text="В этом разделе нет опубликованных карточек." />}
        style={[styles.content, styles.categoryContent]}
        contentContainerStyle={styles.categoryContentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      />
      <Modal visible={isFilterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={() => setFilterOpen(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetTitle}>Фильтры</Text>
                <Text style={styles.filterSheetMeta}>{filteredListings.length} мест</Text>
              </View>
              <TouchableOpacity style={styles.filterCloseButton} onPress={() => setFilterOpen(false)}><Text style={styles.filterCloseText}>×</Text></TouchableOpacity>
            </View>
            <Text style={styles.filterGroupLabel}>Быстрые фильтры</Text>
            <View style={styles.filterChipWrap}>
              {[...quickFilters, ...((category.filterSchema?.quickFilters || []).filter((token) => !quickFilters.includes(token)).slice(0, 8))].map((token) => {
                const isActive = selectedQuickTokens.includes(token);
                return (
                  <TouchableOpacity key={token} activeOpacity={0.78} onPress={() => toggleQuickFilter(token)} style={[styles.filterChip, isActive && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{getFilterDisplayText(token)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.filterSheetActions}>
              <TouchableOpacity style={styles.filterResetButton} onPress={() => setSelectedQuickTokens([])}><Text style={styles.filterResetText}>Сбросить</Text></TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyButton} onPress={() => setFilterOpen(false)}><Text style={styles.filterApplyText}>Показать {filteredListings.length}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function BulletinBoardScreen({
  listings,
  favoriteSet,
  toggleFavorite,
  openDetail,
  refreshing,
  refresh,
  onBack
}: {
  listings: GuidePlace[];
  favoriteSet: Set<string>;
  toggleFavorite: (slug: string) => void;
  openDetail: (place: GuidePlace) => void;
  refreshing: boolean;
  refresh: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('Все');
  const sections = ['Все', 'Работа', 'Продажи', 'Услуги', 'Разное'];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredListings = listings.filter((place) => {
    const section = normalizeBulletinSection(place.kind || place.cuisine || place.district || 'Разное');
    const tagList = toTextArray((place as GuidePlace & { tags?: unknown }).tags);
    const matchesSection = activeSection === 'Все' || normalizeToken(section).includes(normalizeToken(activeSection)) || tagList.some((tag) => normalizeToken(tag).includes(normalizeToken(activeSection)));
    const haystack = [place.title, place.description, place.shortDescription, place.kind, place.cuisine, place.district, place.priceLabel, ...tagList]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return matchesSection && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  return (
    <ScrollView
      style={[styles.content, styles.categoryContent]}
      contentContainerStyle={[styles.categoryContentInner, styles.bulletinContentInner]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={[styles.categoryToolbar, styles.bulletinToolbar]}>
        <TouchableOpacity activeOpacity={0.82} onPress={onBack} style={styles.categoryBackButton}>
          <Text style={styles.categoryBackGlyph}>‹</Text>
        </TouchableOpacity>
        <View style={styles.bulletinSearchBar}>
          <Text style={styles.bulletinSearchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Повар, байк, ремонт, резюме..."
            placeholderTextColor="#8a9aae"
            style={styles.bulletinSearchInput}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.bulletinClearButton}>
              <Text style={styles.bulletinClearText}>×</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <TouchableOpacity activeOpacity={0.88} style={styles.bulletinPostButton}>
        <Text style={styles.bulletinPostText}>Войти и разместить</Text>
      </TouchableOpacity>

      <View style={styles.bulletinMosaic}>
        {sections.slice(1).map((item) => {
          const isActive = activeSection === item;
          return (
            <TouchableOpacity key={item} activeOpacity={0.84} onPress={() => setActiveSection(isActive ? 'Все' : item)} style={[styles.bulletinMosaicCard, isActive && styles.bulletinMosaicCardActive]}>
              <View style={styles.bulletinMosaicOrb} />
              <Text style={[styles.bulletinMosaicText, isActive && styles.bulletinMosaicTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bulletinFeedHead}>
        <Text style={styles.bulletinFeedTitle}>{activeSection === 'Все' ? 'Все объявления' : activeSection}</Text>
      </View>

      <View style={styles.restaurantListNative}>
        {filteredListings.map((place) => (
          <CategoryListingCard
            key={place.id}
            place={place}
            isFavorite={favoriteSet.has(place.slug || place.id)}
            onPress={() => openDetail(place)}
            onToggleFavorite={() => toggleFavorite(place.slug || place.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function CategoryListingCard({
  place,
  isFavorite,
  onPress,
  onToggleFavorite
}: {
  place: GuidePlace;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const imageUrl = getPrimaryImageUrl(place);
  const avgCheckValue = Number(place.avgCheck);
  const checkLabel = place.priceLabel || (Number.isFinite(avgCheckValue) && avgCheckValue > 0 ? `${avgCheckValue.toLocaleString('ru-RU')} ₫` : 'Не указан');
  const hoursLabel = place.hours || 'Не указано';
  const cuisineLabel = place.cuisine || place.kind || place.district || 'Не указано';

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.restaurantCardNative}>
      {imageUrl ? (
        <ImageBackground source={{ uri: imageUrl }} style={styles.restaurantCardImage} imageStyle={styles.restaurantCardImageReal}>
          <View style={styles.restaurantCardImageShade} />
          <Text style={styles.restaurantCardImageTitle} numberOfLines={2}>{place.title}</Text>
          {isFavorite ? <Text style={styles.restaurantCardSavedMark}>♥</Text> : null}
        </ImageBackground>
      ) : (
        <View style={[styles.restaurantCardImage, styles.restaurantCardImageFallback]}>
          <Text style={styles.restaurantCardImageTitle} numberOfLines={2}>{place.title}</Text>
          {isFavorite ? <Text style={styles.restaurantCardSavedMark}>♥</Text> : null}
        </View>
      )}
      <View style={styles.restaurantCardBody}>
        <Text style={styles.restaurantCardTitle} numberOfLines={2}>{place.title}</Text>
        <Text style={styles.restaurantCardSubtitle} numberOfLines={1}>{place.shortDescription || place.description || place.district || place.kind}</Text>
        <View style={styles.restaurantFacts}>
          <RestaurantFact tone="hours" value={hoursLabel} />
          <RestaurantFact tone="cuisine" value={cuisineLabel} />
          <RestaurantFact tone="price" value={checkLabel} />
        </View>
      </View>
    </TouchableOpacity>
  );
}


function RestaurantFact({ value, tone }: { value: string; tone: 'hours' | 'cuisine' | 'price' }) {
  return (
    <View style={styles.restaurantFactRow}>
      <RestaurantFactIcon tone={tone} />
      <Text style={styles.restaurantFactText} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RestaurantFactIcon({ tone }: { tone: 'hours' | 'cuisine' | 'price' }) {
  if (tone === 'hours') {
    return (
      <View style={styles.restaurantClockIcon}>
        <View style={styles.restaurantClockHourHand} />
        <View style={styles.restaurantClockMinuteHand} />
      </View>
    );
  }

  if (tone === 'cuisine') {
    return (
      <View style={styles.restaurantChefIcon}>
        <View style={[styles.restaurantChefPuff, styles.restaurantChefPuffLeft]} />
        <View style={[styles.restaurantChefPuff, styles.restaurantChefPuffCenter]} />
        <View style={[styles.restaurantChefPuff, styles.restaurantChefPuffRight]} />
        <View style={styles.restaurantChefBand} />
      </View>
    );
  }

  return <Text style={styles.restaurantDollarIcon}>$</Text>;
}



function GuideMap({
  places = [],
  routePoints = [],
  onOpenPlace,
  height = 250
}: {
  places?: GuidePlace[];
  routePoints?: NativeRoutePoint[];
  onOpenPlace?: (place: GuidePlace) => void;
  height?: number;
}) {
  const placeMarkers = places
    .map((place) => ({ place, coordinate: placeCoordinate(place) }))
    .filter((item): item is { place: GuidePlace; coordinate: { latitude: number; longitude: number } } => Boolean(item.coordinate));
  const routeCoordinates = routePoints
    .map((point) => {
      let latitude = Number(point.lat);
      let longitude = Number(point.lng);
      if (!isValidLatitude(latitude) && isValidLatitude(longitude) && isValidLongitude(latitude)) {
        const previousLatitude = latitude;
        latitude = longitude;
        longitude = previousLatitude;
      }
      return { latitude, longitude };
    })
    .filter((point) => isValidLatitude(point.latitude) && isValidLongitude(point.longitude));
  const allCoordinates = [...routeCoordinates, ...placeMarkers.map((item) => item.coordinate)];

  if (allCoordinates.length === 0) {
    return (
      <View style={[styles.nativeMapCard, { height }]}> 
        <Text style={styles.nativeMapEmptyTitle}>Карта пока пустая</Text>
        <Text style={styles.nativeMapEmptyText}>Добавь координаты lat/lng в карточки, и точки появятся на карте.</Text>
      </View>
    );
  }

  if (!hasGoogleMapsApiKey) {
    const externalUrl = routePoints.length > 0 ? googleRoutePointsUrl(routePoints) : placeMarkers[0] ? googleMapsUrl(placeMarkers[0].place) : '';
    return (
      <View style={[styles.nativeMapCard, styles.nativeMapFallbackCard, { height }]}> 
        <Text style={styles.nativeMapEmptyTitle}>Карта подключается отдельно</Text>
        <Text style={styles.nativeMapEmptyText}>{mapUnavailableText()}</Text>
        {externalUrl ? (
          <TouchableOpacity activeOpacity={0.86} onPress={() => void openExternalUrl(externalUrl)} style={styles.nativeMapFallbackButton}>
            <Text style={styles.nativeMapFallbackButtonText}>Открыть во внешнем Google Maps</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.nativeMapCard, { height }]}> 
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.nativeMap}
        initialRegion={buildMapRegion(allCoordinates)}
        mapType="standard"
        loadingEnabled
        loadingIndicatorColor="#1f63c7"
        loadingBackgroundColor="#eef5ff"
        toolbarEnabled={false}
        showsCompass
        showsScale={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {routeCoordinates.length > 1 ? (
          <Polyline coordinates={routeCoordinates} strokeColor="#1f63c7" strokeWidth={5} />
        ) : null}
        {routeCoordinates.map((coordinate, index) => (
          <Marker
            key={`route-${index}`}
            coordinate={coordinate}
            title={`${index + 1}. ${toText(routePoints[index]?.title, 'Точка маршрута')}`}
            description={toText(routePoints[index]?.text)}
            pinColor={index === 0 ? '#22a06b' : index === routeCoordinates.length - 1 ? '#e05a3f' : '#1f63c7'}
          />
        ))}
        {placeMarkers.map(({ place, coordinate }) => (
          <Marker
            key={place.id}
            coordinate={coordinate}
            title={toText(place.title, 'Место')}
            description={toText(place.address || place.district || place.kind)}
            onCalloutPress={() => onOpenPlace?.(place)}
          />
        ))}
      </MapView>
    </View>
  );
}

function RoutesScreen({ onBack, onOpenRoute }: { onBack: () => void; onOpenRoute: (routeId: string) => void }) {
  return (
    <ScrollView style={[styles.content, styles.categoryContent]} contentContainerStyle={styles.categoryContentInner} showsVerticalScrollIndicator={false}>
      <View style={styles.categoryToolbar}>
        <TouchableOpacity activeOpacity={0.82} onPress={onBack} style={styles.categoryBackButton}>
          <Text style={styles.categoryBackGlyph}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.categoryToolbarTitle}>Маршруты</Text>
      </View>
      <View style={styles.routesIntroCard}>
        <Text style={styles.routesIntroEyebrow}>Городские маршруты</Text>
        <Text style={styles.routesIntroTitle}>Выбери маршрут и посмотри точки по порядку</Text>
        <Text style={styles.routesIntroText}>Это отдельный раздел: здесь маршруты с описанием, что увидит турист, и схемой движения.</Text>
      </View>
      <View style={styles.routesList}>
        {nativeRoutes.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.88} onPress={() => onOpenRoute(item.id)} style={styles.routeListRow}>
            <View style={styles.routeListIcon}>
              <Text style={styles.routeListIconText}>↗</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.routeListTitle}>{item.title}</Text>
              <Text style={styles.routeListSubtitle} numberOfLines={2}>{item.subtitle}</Text>
              <View style={styles.routeMetaRow}>
                <Text style={styles.routeMetaPill}>{item.duration}</Text>
                <Text style={styles.routeMetaPill}>{item.distance}</Text>
              </View>
            </View>
            <Text style={styles.routeChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function RouteDetailScreen({ route, onBack }: { route: NativeRoute; onBack: () => void }) {
  return (
    <ScrollView style={[styles.content, styles.categoryContent]} contentContainerStyle={styles.categoryContentInner} showsVerticalScrollIndicator={false}>
      <View style={styles.categoryToolbar}>
        <TouchableOpacity activeOpacity={0.82} onPress={onBack} style={styles.categoryBackButton}>
          <Text style={styles.categoryBackGlyph}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.categoryToolbarTitle}>Маршрут</Text>
      </View>
      <View style={styles.routeDetailHero}>
        <Text style={styles.routeDetailEyebrow}>{route.duration} · {route.distance}</Text>
        <Text style={styles.routeDetailTitle}>{route.title}</Text>
        <Text style={styles.routeDetailText}>{route.description}</Text>
      </View>

      <View style={styles.routeDetailBlock}>
        <Text style={styles.routeBlockTitle}>Что турист увидит</Text>
        {route.sees.map((item) => (
          <View key={item} style={styles.routeSeeRow}>
            <Text style={styles.routeSeeDot}>•</Text>
            <Text style={styles.routeSeeText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.routeDetailBlock}>
        <Text style={styles.routeBlockTitle}>Точки маршрута</Text>
        {route.points.map((point, index) => (
          <View key={`${point.title}-${index}`} style={styles.routePointRow}>
            <View style={styles.routePointIndex}><Text style={styles.routePointIndexText}>{index + 1}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.routePointTitle}>{point.title}</Text>
              <Text style={styles.routePointText}>{point.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.routeMapCard}>
        <Text style={styles.routeBlockTitle}>Карта маршрута</Text>
        <GuideMap routePoints={route.points} height={270} />
        <TouchableOpacity activeOpacity={0.86} onPress={() => void openExternalUrl(googleRouteUrl(route))} style={styles.routeMapButton}>
          <Text style={styles.routeMapButtonText}>Открыть маршрут во внешнем Google Maps</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function ProgramsScreen({ onBack }: { onBack: () => void }) {
  const programs = [
    { id: '2-3', stay: '2-3 дня', title: 'Короткий Дананг', text: 'Центр, Dragon Bridge, пляж и один спокойный вечер без перегруза.', accent: 'coast' },
    { id: '4-5', stay: '4-5 дней', title: 'Пляж + город', text: 'Рестораны, видовые точки, СПА и один выезд за пределы города.', accent: 'bridge' },
    { id: '6-7', stay: '6-7 дней', title: 'Полная неделя', text: 'Микс моря, культуры, активного отдыха, покупок и мест для восстановления.', accent: 'emerald' }
  ];

  return (
    <ScrollView style={[styles.content, styles.categoryContent]} contentContainerStyle={styles.categoryContentInner} showsVerticalScrollIndicator={false}>
      <View style={styles.categoryToolbar}>
        <TouchableOpacity activeOpacity={0.82} onPress={onBack} style={styles.categoryBackButton}>
          <Text style={styles.categoryBackGlyph}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.categoryToolbarTitle}>Готовые программы</Text>
      </View>
      <View style={styles.programsHeroCard}>
        <View style={styles.programBlob} />
        <Text style={styles.programEyebrow}>Готовые программы</Text>
        <Text style={styles.programTitle}>Подбери сценарий отдыха по сроку поездки</Text>
        <Text style={styles.programText}>Короткие готовые маршруты, чтобы не собирать поездку вручную.</Text>
      </View>
      <View style={styles.programsList}>
        {programs.map((program) => (
          <View key={program.id} style={styles.programCard}>
            <Text style={styles.programCardStay}>{program.stay}</Text>
            <Text style={styles.programCardTitle}>{program.title}</Text>
            <Text style={styles.programCardText}>{program.text}</Text>
            <Text style={styles.programCardAction}>Открыть маршрут ›</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function SearchScreen({
  listings,
  favoriteSet,
  openDetail,
  toggleFavorite
}: {
  listings: GuidePlace[];
  favoriteSet: Set<string>;
  openDetail: (place: GuidePlace) => void;
  toggleFavorite: (slug: string) => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery
    ? listings.filter((place) => [place.title, place.description, place.address, place.district, place.kind, place.cuisine, ...toTextArray((place as GuidePlace & { tags?: unknown }).tags)].join(' ').toLowerCase().includes(normalizedQuery))
    : listings.slice(0, 12);

  return (
    <View style={styles.screenGap}>
      <ScreenHeader title="Поиск" text="Найди место, услугу, район или тип заведения." />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Название, район, кухня, услуга"
        placeholderTextColor="#95a5b5"
        autoCorrect={false}
        style={styles.searchInput}
      />
      {results.length === 0 ? <EmptyState title="Ничего не найдено" text="Попробуйте другой запрос или откройте разделы." /> : null}
      {results.map((place) => (
        <ListingCard
          key={place.id}
          place={place}
          isFavorite={favoriteSet.has(place.slug || place.id)}
          onPress={() => openDetail(place)}
          onToggleFavorite={() => toggleFavorite(place.slug || place.id)}
        />
      ))}
    </View>
  );
}

function FavoritesScreen({
  listings,
  favoriteSet,
  openDetail,
  toggleFavorite
}: {
  listings: GuidePlace[];
  favoriteSet: Set<string>;
  openDetail: (place: GuidePlace) => void;
  toggleFavorite: (slug: string) => void;
}) {
  return (
    <View style={styles.screenGap}>
      <ScreenHeader title="Избранное" text="Сохраняется на устройстве." />
      {listings.length === 0 ? <EmptyState title="Нет избранных мест" text="Нажимайте звёздочку на карточках, чтобы сохранить места." /> : null}
      {listings.map((place) => (
        <ListingCard
          key={place.id}
          place={place}
          isFavorite={favoriteSet.has(place.slug || place.id)}
          onPress={() => openDetail(place)}
          onToggleFavorite={() => toggleFavorite(place.slug || place.id)}
        />
      ))}
    </View>
  );
}

function NearbyScreen({
  listings,
  favoriteSet,
  openDetail,
  toggleFavorite
}: {
  listings: GuidePlace[];
  favoriteSet: Set<string>;
  openDetail: (place: GuidePlace) => void;
  toggleFavorite: (slug: string) => void;
}) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState('');

  const askLocation = useCallback(async () => {
    setStatus('Запрашиваем доступ к геолокации');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setStatus('Геолокация недоступна. Разрешите доступ в настройках устройства.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setPosition({ lat: current.coords.latitude, lng: current.coords.longitude });
    setStatus('');
  }, []);

  const placesWithCoordinates = useMemo(() => listings.filter((place) => Boolean(placeCoordinate(place))), [listings]);
  const placesWithDistance = useMemo(() => {
    return placesWithCoordinates
      .map((place) => ({ ...place, distanceKm: position ? haversineDistanceKm(position, { lat: Number(place.lat), lng: Number(place.lng) }) : null }))
      .sort((left, right) => (left.distanceKm ?? 9999) - (right.distanceKm ?? 9999));
  }, [placesWithCoordinates, position]);

  return (
    <View style={styles.screenGap}>
      <ScreenHeader title="Карта" text="Наша карта с точками, которые добавлены в гид." />
      <GuideMap places={placesWithCoordinates} onOpenPlace={openDetail} height={310} />
      <AppButton label={position ? 'Обновить геолокацию' : 'Показать места рядом'} onPress={() => void askLocation()} />
      {status ? <Text style={styles.noteText}>{status}</Text> : null}
      {placesWithCoordinates.length === 0 ? <EmptyState title="Нет координат" text="У опубликованных мест пока не заполнены lat/lng." /> : null}
      {placesWithDistance.slice(0, 12).map((place) => (
        <View key={place.id} style={styles.nearbyCardWrap}>
          <CategoryListingCard
            place={place}
            isFavorite={favoriteSet.has(place.slug || place.id)}
            onPress={() => openDetail(place)}
            onToggleFavorite={() => toggleFavorite(place.slug || place.id)}
          />
          <View style={styles.nearbyBadge}>
            <Text style={styles.nearbyText}>{formatDistance(place.distanceKm)} {estimateTravelTime(place.distanceKm)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ContactsScreen({ support }: { support: SupportContentStore }) {
  const channels = Array.isArray(support?.contactChannels) ? support.contactChannels : [];
  const emergencyContacts = Array.isArray(support?.emergencyContacts) ? support.emergencyContacts : [];

  return (
    <View style={styles.screenGap}>
      <ScreenHeader title={support?.heroTitle || 'Помощь'} text={support?.heroText || 'Связь с поддержкой и важные контакты.'} />
      {channels.length === 0 ? <EmptyState title="Контакты не заполнены" text="Добавь каналы помощи в CMS или support content." /> : null}
      {channels.map((channel) => (
        <TouchableOpacity key={channel.id} activeOpacity={0.82} onPress={() => void openExternalUrl(channel.href)} style={styles.contactCard}>
          <Text style={styles.contactCardTitle}>{channel.title}</Text>
          <Text style={styles.contactCardText}>{channel.subtitle}</Text>
          <Text style={styles.contactValue}>{channel.value}</Text>
        </TouchableOpacity>
      ))}
      <SectionTitle title={support?.emergencyTitle || 'Экстренные контакты'} />
      <Text style={styles.noteText}>{support?.emergencySubtitle || 'Сохрани эти контакты на случай срочной ситуации.'}</Text>
      {emergencyContacts.map((contact) => (
        <TouchableOpacity key={contact.id} activeOpacity={0.82} onPress={() => void openExternalUrl(contact.href)} style={styles.contactCard}>
          <Text style={styles.contactCardTitle}>{contact.title}</Text>
          <Text style={styles.contactCardText}>{contact.description}</Text>
          <Text style={styles.contactValue}>{contact.value}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}


function TipsScreen({ tips, onBack }: { tips: GuideTip[]; onBack: () => void }) {
  const [selectedTip, setSelectedTip] = useState<GuideTip | null>(null);
  return (
    <ScrollView style={[styles.content, styles.categoryContent]} contentContainerStyle={styles.categoryContentInner} showsVerticalScrollIndicator={false}>
      <View style={styles.categoryToolbar}>
        <TouchableOpacity activeOpacity={0.82} onPress={onBack} style={styles.categoryBackButton}>
          <Text style={styles.categoryBackGlyph}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.categoryToolbarTitle}>Советы</Text>
      </View>
      <View style={styles.tipsListScreen}>
        {tips.length === 0 ? <EmptyState title="Советов пока нет" text="Добавь советы в CMS, и они появятся здесь." /> : null}
        {tips.map((tip) => (
          <TouchableOpacity key={tip.id} activeOpacity={0.78} onPress={() => setSelectedTip(tip)} style={styles.tipRow}>
            <Image source={heroBackground} style={styles.tipThumb} />
            <View style={styles.flex}>
              <Text style={styles.tipTitle} numberOfLines={1}>{tip.title}</Text>
              <Text style={styles.tipText} numberOfLines={2}>{tip.text}</Text>
            </View>
            <Text style={styles.tipChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Modal visible={Boolean(selectedTip)} transparent animationType="fade" onRequestClose={() => setSelectedTip(null)}>
        <View style={styles.tipModalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={() => setSelectedTip(null)} />
          <View style={styles.tipModalCard}>
            <View style={styles.tipModalHandle} />
            <Text style={styles.tipModalEyebrow}>Совет</Text>
            <Text style={styles.tipModalTitle}>{selectedTip?.title}</Text>
            <Text style={styles.tipModalText}>{selectedTip?.text}</Text>
            <TouchableOpacity activeOpacity={0.86} onPress={() => setSelectedTip(null)} style={styles.tipModalButton}>
              <Text style={styles.tipModalButtonText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function AuthSheet({ visible, user, onClose, onLogout }: { visible: boolean; user: Record<string, unknown> | null; onClose: () => void; onLogout: () => void }) {
  const authReturnTo = 'danangguide://auth';
  const displayName = toText(user?.displayName || user?.username || user?.email, 'Пользователь');
  const userEmail = toText(user?.email);

  const openProvider = (provider: 'google' | 'apple' | 'telegram') => {
    if (!API_BASE_URL) return;
    const path = provider === 'telegram'
      ? `/api/auth/telegram/start?returnTo=${encodeURIComponent(authReturnTo)}&mode=native&prefer=oauth`
      : `/api/auth/${provider}/start?returnTo=${encodeURIComponent(authReturnTo)}&mode=native`;
    onClose();
    void openExternalUrl(`${API_BASE_URL}${path}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.authModalBackdrop}>
        <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.authSheet}>
          <View style={styles.tipModalHandle} />
          <View style={styles.authSheetHeader}>
            <View>
              <Text style={styles.authSheetTitle}>{user ? 'Профиль' : 'Профиль и вход'}</Text>
              <Text style={styles.authSheetText}>{user ? 'Вы уже авторизованы в приложении.' : 'Авторизация нужна для избранного, объявлений и личных функций.'}</Text>
            </View>
            <TouchableOpacity style={styles.authCloseButton} onPress={onClose}>
              <Text style={styles.authCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          {user ? (
            <View style={styles.profileBlock}>
              <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{displayName.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.profileName}>{displayName}</Text>
                {userEmail ? <Text style={styles.profileEmail}>{userEmail}</Text> : null}
              </View>
              <TouchableOpacity activeOpacity={0.84} onPress={onLogout} style={styles.profileLogoutButton}>
                <Text style={styles.profileLogoutText}>Выйти</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {!API_BASE_URL ? (
                <View style={styles.authNotice}>
                  <Text style={styles.authNoticeText}>Для входа нужно указать EXPO_PUBLIC_API_BASE_URL в mobile/.env.</Text>
                </View>
              ) : null}
              <TouchableOpacity activeOpacity={0.86} onPress={() => openProvider('google')} style={styles.authProviderButton}>
                <Text style={styles.authProviderBrand}>G</Text>
                <View style={styles.flex}>
                  <Text style={styles.authProviderTitle}>Войти через Google</Text>
                  <Text style={styles.authProviderSub}>После входа приложение откроется обратно</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.86} onPress={() => openProvider('apple')} style={styles.authProviderButton}>
                <Text style={styles.authProviderBrand}></Text>
                <View style={styles.flex}>
                  <Text style={styles.authProviderTitle}>Войти через Apple</Text>
                  <Text style={styles.authProviderSub}>Если провайдер настроен на сервере</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.86} onPress={() => openProvider('telegram')} style={styles.authProviderButton}>
                <Text style={styles.authProviderBrand}>T</Text>
                <View style={styles.flex}>
                  <Text style={styles.authProviderTitle}>Войти через Telegram</Text>
                  <Text style={styles.authProviderSub}>Откроется Telegram-авторизация и возврат в приложение</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function DetailScreen({ place, category, isFavorite, onToggleFavorite }: { place: GuidePlace; category?: GuideCategory; isFavorite: boolean; onToggleFavorite: () => void }) {
  const gallery = getPlaceImageUrls(place);
  const details = Array.from(new Set([...toTextArray((place as GuidePlace & { extra?: unknown }).extra), ...toTextArray((place as GuidePlace & { services?: unknown }).services)]));
  const tags = toTextArray((place as GuidePlace & { tags?: unknown }).tags);
  const description = toText(place.description || place.shortDescription, 'Описание пока не заполнено.');
  const title = toText(place.title, 'Место');
  const categoryLabel = toText(category?.title || place.kind || place.categoryId, 'Раздел');
  const phone = toText(place.phoneNumber || place.phone);
  const website = toText(place.websiteUrl || place.website);
  const address = toText(place.address || place.location, 'Не указан');
  const hours = toText(place.hours, 'Не указано');
  const price = toText(place.priceLabel);
  const cuisine = toText(place.cuisine);
  const district = toText(place.district);
  const hasMapPoint = Boolean(placeCoordinate(place));

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.detailContentInner} showsVerticalScrollIndicator={false}>
      {gallery[0] ? <Image source={{ uri: gallery[0] }} style={styles.detailImage} /> : <View style={[styles.detailImage, styles.detailImageFallback]} />}

      <View style={styles.detailPlainHeader}>
        <View style={styles.detailTitleRow}>
          <View style={styles.flex}>
            <Text style={styles.detailSubtitle}>{categoryLabel}</Text>
            <Text style={styles.detailTitle}>{title}</Text>
          </View>
          <TouchableOpacity activeOpacity={0.8} onPress={onToggleFavorite} style={styles.detailFavorite}>
            <Text style={styles.detailFavoriteText}>{isFavorite ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.detailText}>{description}</Text>
        <View style={styles.detailPillsRow}>
          <Pill label={price} />
          <Pill label={cuisine} />
          <Pill label={district} />
          {place.breakfast ? <Pill label="Завтрак" /> : null}
          {place.vegan ? <Pill label="Vegan" /> : null}
          {place.pets || place.petFriendly ? <Pill label="Pet-friendly" /> : null}
          {place.childPrograms || place.childFriendly ? <Pill label="Для детей" /> : null}
        </View>
      </View>

      <View style={styles.detailInfoList}>
        <InfoBlock title="Адрес" value={address} />
        <InfoBlock title="Время работы" value={hours} />
        <InfoBlock title="Телефон" value={phone || 'Не указан'} />
      </View>

      <View style={styles.actionsGrid}>
        <AppButton label="Маршрут" onPress={() => void openExternalUrl(directionsUrl(place))} />
        <AppButton label="Google Maps" variant="ghost" onPress={() => void openExternalUrl(googleMapsUrl(place))} />
        {Platform.OS === 'ios' ? <AppButton label="Apple Maps" variant="ghost" onPress={() => void openExternalUrl(appleMapsUrl(place))} /> : null}
        {phone ? <AppButton label="Позвонить" variant="ghost" onPress={() => void openExternalUrl(`tel:${phone}`)} /> : null}
        {website ? <AppButton label="Сайт" variant="ghost" onPress={() => void openExternalUrl(website)} /> : null}
      </View>

      {tags.length > 0 ? (
        <View style={styles.detailPlainSection}>
          <SectionTitle title="Теги" />
          <View style={styles.detailPillsRow}>{tags.map((tag) => <Pill key={tag} label={tag} />)}</View>
        </View>
      ) : null}

      {details.length > 0 ? (
        <View style={styles.detailPlainSection}>
          <SectionTitle title="Дополнительно" />
          {details.map((item) => <Text key={item} style={styles.bulletText}>• {item}</Text>)}
        </View>
      ) : null}

      {hasMapPoint ? (
        <View style={styles.detailMapSection}>
          <SectionTitle title="Карта" />
          <GuideMap places={[place]} height={245} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{title}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ScreenHeader({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.screenHeader}>
      <Text style={styles.screenTitle}>{title}</Text>
      {text ? <Text style={styles.screenText}>{text}</Text> : null}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function BottomTabs({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.bottomTabs}>
      <View style={styles.bottomTabsInner}>
        {tabItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.82}
            onPress={() => onChange(item.key)}
            style={styles.tabButton}
          >
            <View style={[styles.tabIconWrap, active === item.key && styles.activeTabIconWrap]}>
              <Text style={[styles.tabIconText, active === item.key && styles.activeTabIconText]}>{item.icon}</Text>
            </View>
            <Text style={[styles.tabText, active === item.key && styles.activeTabText]} numberOfLines={1}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, width: '100%', minWidth: '100%', backgroundColor: '#ffffff', margin: 0, padding: 0, alignSelf: 'stretch' },
  appHeader: { paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 10 : 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e3eaf2', backgroundColor: '#f5f7fb' },
  logoText: { color: '#102a43', fontSize: 22, fontWeight: '900' },
  logoSubtext: { color: '#718096', fontSize: 12, marginTop: 2 },
  headerBackButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  headerBackText: { color: '#102a43', fontWeight: '800' },
  content: { flex: 1, width: '100%', minWidth: '100%', margin: 0, padding: 0, backgroundColor: '#ffffff' },
  contentInner: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: BOTTOM_TABS_VISIBLE_HEIGHT + 26, backgroundColor: '#ffffff' },
  homeContentInner: { flexGrow: 1, width: '100%', minWidth: '100%', padding: 0, paddingTop: 0, paddingBottom: BOTTOM_TABS_VISIBLE_HEIGHT + 22, paddingHorizontal: 0, paddingLeft: 0, paddingRight: 0, margin: 0, backgroundColor: '#ffffff' },
  screenGap: { gap: 12 },
  tipsListScreen: { gap: 12, paddingBottom: 12 },
  flex: { flex: 1 },
  full: { width: '100%', height: '100%' },
  errorScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#ffffff' },
  errorTitle: { color: '#102a43', fontSize: 22, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
  errorText: { color: '#60718a', fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  errorButton: { minHeight: 46, borderRadius: 16, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 18 },
  errorButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },

  homeRoot: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: '#ffffff' },
  homeHero: { width: '100%', minWidth: '100%', alignSelf: 'stretch', height: Platform.OS === 'android' ? 118 + ANDROID_STATUS_BAR_INSET : 118, paddingTop: ANDROID_STATUS_BAR_INSET, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: '#1c65a0' },
  homeHeroImage: { resizeMode: 'cover' },
  homeHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 18, 38, 0.08)' },
  homeUtilityDot: { position: 'absolute', right: 18, top: 6, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroAuthButton: { position: 'absolute', right: 14, top: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 10 : 12, zIndex: 4, width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8, 18, 37, 0.36)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  heroAuthIcon: { color: '#ffffff', fontSize: 20, lineHeight: 23, fontWeight: '900' },
  heroLogoImage: { width: 304, height: 88, marginTop: 4 },
  homeBody: { width: '100%', minWidth: '100%', alignSelf: 'stretch', marginTop: -18, paddingHorizontal: 0, paddingLeft: 0, paddingRight: 0, gap: 14, backgroundColor: '#ffffff' },
  bannerStack: { width: '100%', minWidth: '100%', height: 168, justifyContent: 'center', overflow: 'hidden' },
  bannerCarousel: { height: 136, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bannerScrollerContent: { alignItems: 'center' },
  homeBanner: { height: 126, borderRadius: 20, overflow: 'hidden', backgroundColor: '#173f82' },
  homeBannerSlide: { height: 134, borderRadius: 22, backgroundColor: '#173f82', shadowColor: '#26436b', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 8 },
  homeBannerCenterHalo: { width: '78%', height: 134, borderRadius: 24, padding: 4, backgroundColor: 'rgba(255,255,255,0.86)', shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20, elevation: 12, zIndex: 4 },
  homeBannerCenter: { width: '100%', height: '100%', zIndex: 5, borderRadius: 20 },
  homeBannerPreview: { position: 'absolute', width: '30%', height: 108, opacity: 0.72, zIndex: 1 },
  homeBannerPreviewLeft: { left: -8 },
  homeBannerPreviewRight: { right: -8 },
  homeBannerImage: { borderRadius: 20 },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  homeBannerTextWrap: { position: 'absolute', left: 18, right: 18, bottom: 16, paddingHorizontal: 0, paddingVertical: 0 },
  homeBannerTitle: { color: '#ffffff', fontSize: 15, lineHeight: 19, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.72)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  homeBannerText: { color: '#ffffff', fontSize: 11.5, lineHeight: 15, marginTop: 5, opacity: 0.98, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.72)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  bannerPeek: { position: 'absolute', top: 6, width: 94, height: 106, borderRadius: 14, overflow: 'hidden', backgroundColor: '#cbd8e6' },
  bannerPeekLeft: { left: -48 },
  bannerPeekRight: { right: -48 },
  bannerPeekImage: { borderRadius: 14 },
  bannerDots: { position: 'absolute', left: 0, right: 0, bottom: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  bannerDot: { width: 18, height: 3, borderRadius: 999, backgroundColor: 'rgba(31, 99, 199, 0.18)' },
  bannerDotActive: { backgroundColor: '#1f63c7', width: 30 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginTop: 2, paddingHorizontal: 14 },
  quickItem: { width: '25%', alignItems: 'center', paddingHorizontal: 2 },
  quickIcon: { width: 68, height: 68, borderRadius: 18, backgroundColor: '#dbe7ef' },
  quickLabel: { color: '#102a43', fontSize: 10.5, lineHeight: 12.5, fontWeight: '900', textAlign: 'center', marginTop: 7, minHeight: 26 },
  programSpotlight: { position: 'relative', overflow: 'hidden', borderRadius: 24, backgroundColor: '#214f9c', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 8, alignItems: 'center', marginHorizontal: 14, marginTop: 2 },
  programBlob: { position: 'absolute', top: -32, right: -26, width: 130, height: 96, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.13)' },
  programEyebrow: { color: '#ffffff', opacity: 0.82, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  programTitle: { color: '#ffffff', fontSize: 20, lineHeight: 23, fontWeight: '900', textAlign: 'center', marginTop: 8, maxWidth: 260 },
  programText: { color: '#edf5ff', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 9, fontWeight: '700' },
  programChips: { flexDirection: 'row', gap: 8, marginTop: 14 },
  programChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)' },
  programChipText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  programAction: { width: '100%', minHeight: 38, paddingTop: 11, borderRadius: 14, overflow: 'hidden', backgroundColor: '#ffffff', color: '#1f4f98', fontSize: 11, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  homeSection: { gap: 0, paddingHorizontal: 14 },
  homeSectionHeader: { minHeight: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  homeSectionHeaderSide: { width: 44, height: 32 },
  homeSectionTitle: { flex: 1, color: '#102a43', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  homeSectionAllButton: { width: 44, minHeight: 32, alignItems: 'flex-end', justifyContent: 'center' },
  homeSectionLink: { color: '#3764a8', fontSize: 13, fontWeight: '900' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 0, borderRadius: 0, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(23, 37, 64, 0.08)' },
  tipThumb: { width: 52, height: 52, borderRadius: 14 },
  tipTitle: { color: '#102a43', fontSize: 14, fontWeight: '900' },
  tipText: { color: '#62748b', fontSize: 12, lineHeight: 16, marginTop: 3 },
  tipChevron: { color: '#96a6bb', fontSize: 24, lineHeight: 26, fontWeight: '500' },
  tipModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 19, 38, 0.36)' },
  tipModalCard: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#ffffff' },
  tipModalHandle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 999, backgroundColor: '#d4deeb', marginBottom: 14 },
  tipModalEyebrow: { color: '#1f63c7', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  tipModalTitle: { color: '#102a43', fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 8 },
  tipModalText: { color: '#53657c', fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 10 },
  tipModalButton: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', marginTop: 18 },
  tipModalButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },

  sectionTitle: { color: '#102a43', fontSize: 20, fontWeight: '900', marginTop: 4 },
  screenHeader: { gap: 6, marginBottom: 4, paddingTop: 4 },
  screenTitle: { color: '#102a43', fontSize: 28, lineHeight: 34, fontWeight: '900' },
  screenText: { color: '#62748b', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  searchInput: { minHeight: 50, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e0ea', color: '#102a43', fontSize: 15, fontWeight: '700' },
  noteText: { color: '#62748b', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  contactCard: { padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e0ea', shadowColor: '#263856', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  contactCardTitle: { color: '#102a43', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  contactCardText: { color: '#62748b', fontSize: 14, lineHeight: 20, marginTop: 5, fontWeight: '700' },
  contactValue: { color: '#155ea6', fontSize: 16, fontWeight: '900', marginTop: 10 },

  detailContentInner: { paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 14 : 14, paddingBottom: 28 + ANDROID_NAVIGATION_BAR_INSET, backgroundColor: '#ffffff', gap: 14 },
  detailImage: { width: '100%', height: 270, borderRadius: 28, backgroundColor: '#dce8f4' },
  detailImageFallback: { backgroundColor: '#d7e6f5' },
  detailCard: { padding: 18, borderRadius: 26, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e0ea', gap: 10 },
  detailPlainHeader: { gap: 12, paddingHorizontal: 2, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  detailPlainSection: { gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  detailMapSection: { gap: 10, paddingTop: 2, paddingBottom: 4 },
  detailInfoList: { borderTopWidth: 1, borderTopColor: 'rgba(214, 223, 235, 0.92)' },
  detailTitleRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  detailTitle: { color: '#102a43', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 5 },
  detailSubtitle: { color: '#53739b', fontSize: 15, fontWeight: '800', marginTop: 6 },
  detailFavorite: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#f1f5fa', alignItems: 'center', justifyContent: 'center' },
  detailFavoriteText: { color: '#2f78d6', fontSize: 24, lineHeight: 26, fontWeight: '900' },
  detailPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  detailText: { color: '#486581', fontSize: 16, lineHeight: 24 },
  infoBlock: { paddingVertical: 13, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)', gap: 4 },
  infoLabel: { color: '#53739b', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { color: '#102a43', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  actionsGrid: { gap: 10 },
  bulletText: { color: '#486581', fontSize: 15, lineHeight: 22 },
  nearbyCardWrap: { gap: 8 },
  nearbyBadge: { alignSelf: 'flex-start', marginLeft: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#102a43' },
  nearbyText: { color: '#fff', fontWeight: '800' },
  nativeMapCard: { width: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: '#e8f1f8', borderWidth: 1, borderColor: '#d8e0ea', justifyContent: 'center' },
  nativeMap: { ...StyleSheet.absoluteFillObject },
  nativeMapEmptyTitle: { color: '#162640', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  nativeMapEmptyText: { color: '#60718a', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center', marginTop: 6, paddingHorizontal: 18 },
  nativeMapFallbackCard: { alignItems: 'center', paddingHorizontal: 18 },
  nativeMapFallbackButton: { minHeight: 42, borderRadius: 14, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 14 },
  nativeMapFallbackButtonText: { color: '#ffffff', fontSize: 12, lineHeight: 15, fontWeight: '900', textAlign: 'center' },

  categoryContent: { flex: 1, backgroundColor: '#ffffff' },
  categoryContentInner: { paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 16, paddingBottom: 92, gap: 10, backgroundColor: '#ffffff' },
  categoryToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 },
  categoryToolbarTitle: { flex: 1, color: '#102a43', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  categoryBackButton: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#d8e0ea', shadowColor: '#2b405f', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4 },
  categoryBackGlyph: { color: '#1f63c7', fontSize: 34, lineHeight: 36, fontWeight: '500', marginTop: -2 },
  categoryQuickRow: { alignItems: 'center', gap: 11, paddingRight: 4, minHeight: 42 },
  categoryQuickButton: { minHeight: 36, justifyContent: 'center' },
  categoryQuickText: { color: '#556982', fontSize: 12.2, lineHeight: 15, fontWeight: '900' },
  categoryQuickTextActive: { color: '#1f63c7', textDecorationLine: 'underline' },
  categoryFilterButton: { width: 42, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', position: 'relative' },
  categoryFilterIcon: { color: '#1f63c7', fontSize: 19, lineHeight: 22, fontWeight: '900' },
  filterBadge: { position: 'absolute', right: -4, top: -4, minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', paddingHorizontal: 4 },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  categoryTitleBlock: { paddingHorizontal: 4, paddingTop: 2, paddingBottom: 4 },
  categoryTitleText: { color: '#102a43', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  categoryDescriptionText: { color: '#62748b', fontSize: 12.5, lineHeight: 18, marginTop: 4, fontWeight: '700' },
  restaurantListNative: { gap: 0 },
  restaurantCardNative: { minHeight: 116, width: '100%', flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 0, borderRadius: 0, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)', shadowOpacity: 0, elevation: 0, overflow: 'hidden' },
  restaurantCardImage: { width: 118, height: 94, borderRadius: 16, backgroundColor: '#dce8f4', overflow: 'hidden', justifyContent: 'flex-end', flexShrink: 0 },
  restaurantCardImageFallback: { backgroundColor: '#dce8f4' },
  restaurantCardImageReal: { borderRadius: 16 },
  restaurantCardImageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7, 17, 34, 0.30)' },
  restaurantCardImageTitle: { position: 'absolute', left: 7, right: 7, bottom: 7, color: '#ffffff', fontSize: 11, lineHeight: 13, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  restaurantCardSavedMark: { position: 'absolute', right: 6, top: 5, color: '#ffffff', fontSize: 13, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  restaurantCardBody: { flex: 1, minWidth: 0, maxWidth: '100%', justifyContent: 'center', gap: 4, paddingTop: 0, paddingRight: 2, overflow: 'hidden' },
  restaurantCardTitle: { color: '#162640', fontSize: 14.2, lineHeight: 17, fontWeight: '900', letterSpacing: -0.2 },
  restaurantCardSubtitle: { color: '#60718a', fontSize: 11.8, lineHeight: 15, fontWeight: '500' },
  restaurantFacts: { gap: 4, marginTop: 3 },
  restaurantFactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restaurantFactText: { flex: 1, minWidth: 0, color: '#24364f', fontSize: 11.6, lineHeight: 16, fontWeight: '800' },
  restaurantClockIcon: { width: 17, height: 17, borderRadius: 8.5, borderWidth: 1.8, borderColor: '#2b78dd', flexShrink: 0, position: 'relative' },
  restaurantClockHourHand: { position: 'absolute', left: 7.2, top: 3.6, width: 1.8, height: 5.4, borderRadius: 1, backgroundColor: '#2b78dd' },
  restaurantClockMinuteHand: { position: 'absolute', left: 7.2, top: 7.1, width: 5.5, height: 1.8, borderRadius: 1, backgroundColor: '#2b78dd' },
  restaurantChefIcon: { width: 20, height: 18, flexShrink: 0, position: 'relative' },
  restaurantChefPuff: { position: 'absolute', top: 1, width: 10, height: 10, borderRadius: 6, borderWidth: 1.7, borderColor: '#ef8b32', backgroundColor: 'transparent' },
  restaurantChefPuffLeft: { left: 0 },
  restaurantChefPuffCenter: { left: 5, top: 0, width: 11, height: 11 },
  restaurantChefPuffRight: { right: 0 },
  restaurantChefBand: { position: 'absolute', left: 3, right: 3, bottom: 1, height: 7, borderWidth: 1.7, borderTopWidth: 0, borderColor: '#ef8b32', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  restaurantDollarIcon: { width: 18, color: '#22a06b', fontSize: 18, lineHeight: 19, fontWeight: '900', textAlign: 'center', flexShrink: 0 },

  bulletinContentInner: { paddingTop: 16 },
  bulletinToolbar: { alignItems: 'center' },
  bulletinSearchBar: { flex: 1, minHeight: 42, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(214, 223, 235, 0.94)', backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  bulletinSearchIcon: { color: '#6e7f97', fontSize: 16, fontWeight: '900' },
  bulletinSearchInput: { flex: 1, minHeight: 40, color: '#162640', fontSize: 13, fontWeight: '700', padding: 0 },
  bulletinClearButton: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf3fb' },
  bulletinClearText: { color: '#50627a', fontSize: 20, lineHeight: 22, fontWeight: '800' },
  bulletinPostButton: { minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', marginTop: 2 },
  bulletinPostText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  bulletinMosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  bulletinMosaicCard: { width: '48.8%', minHeight: 92, overflow: 'hidden', borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e9f2', padding: 12, justifyContent: 'space-between' },
  bulletinMosaicCardActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  bulletinMosaicOrb: { position: 'absolute', right: -16, top: -18, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(31, 99, 199, 0.10)' },
  bulletinMosaicText: { color: '#162640', fontSize: 15, lineHeight: 18, fontWeight: '900', marginTop: 44 },
  bulletinMosaicTextActive: { color: '#ffffff' },
  bulletinQuickRow: { gap: 8, paddingVertical: 2 },
  bulletinQuickButton: { minHeight: 34, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: '#d8e0ea', backgroundColor: '#ffffff', justifyContent: 'center' },
  bulletinQuickButtonActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  bulletinQuickText: { color: '#52667f', fontSize: 12, fontWeight: '900' },
  bulletinQuickTextActive: { color: '#ffffff' },
  bulletinFeedHead: { paddingTop: 4, paddingBottom: 2 },
  bulletinFeedTitle: { color: '#162640', fontSize: 20, lineHeight: 24, fontWeight: '900' },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 19, 38, 0.36)' },
  modalBackdropTouch: { ...StyleSheet.absoluteFillObject },
  filterSheet: { maxHeight: '74%', paddingHorizontal: 16, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#f8fbff', gap: 14 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterSheetTitle: { color: '#102a43', fontSize: 22, fontWeight: '900' },
  filterSheetMeta: { color: '#6c7b90', fontSize: 12, fontWeight: '800', marginTop: 3 },
  filterCloseButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  filterCloseText: { color: '#102a43', fontSize: 24, lineHeight: 26, fontWeight: '700' },
  filterGroupLabel: { color: '#6e7f97', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  filterChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ccd8e8' },
  filterChipActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  filterChipText: { color: '#4e6078', fontSize: 12, fontWeight: '900' },
  filterChipTextActive: { color: '#ffffff' },
  filterSheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  filterResetButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  filterResetText: { color: '#51647d', fontSize: 14, fontWeight: '900' },
  filterApplyButton: { flex: 1.2, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7' },
  filterApplyText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },

  routesIntroCard: { position: 'relative', overflow: 'hidden', borderRadius: 24, backgroundColor: '#214f9c', paddingHorizontal: 20, paddingVertical: 18 },
  routesIntroEyebrow: { color: '#ffffff', opacity: 0.82, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  routesIntroTitle: { color: '#ffffff', fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 8 },
  routesIntroText: { color: '#edf5ff', fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 8 },
  routesList: { gap: 0, backgroundColor: '#ffffff' },
  routeListRow: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  routeListIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' },
  routeListIconText: { color: '#1f63c7', fontSize: 24, lineHeight: 28, fontWeight: '900' },
  routeListTitle: { color: '#162640', fontSize: 15.5, lineHeight: 19, fontWeight: '900' },
  routeListSubtitle: { color: '#60718a', fontSize: 12.5, lineHeight: 17, fontWeight: '600', marginTop: 4 },
  routeMetaRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  routeMetaPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: '#eef4fb', color: '#3764a8', fontSize: 10.5, fontWeight: '900' },
  routeChevron: { color: '#9aaabd', fontSize: 28, lineHeight: 30, fontWeight: '500' },
  routeDetailHero: { borderRadius: 24, backgroundColor: '#214f9c', paddingHorizontal: 20, paddingVertical: 18 },
  routeDetailEyebrow: { color: '#edf5ff', opacity: 0.85, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  routeDetailTitle: { color: '#ffffff', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 8 },
  routeDetailText: { color: '#edf5ff', fontSize: 13.5, lineHeight: 20, fontWeight: '700', marginTop: 10 },
  routeDetailBlock: { paddingVertical: 4, gap: 9 },
  routeBlockTitle: { color: '#162640', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  routeSeeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routeSeeDot: { color: '#1f63c7', fontSize: 18, lineHeight: 20, fontWeight: '900' },
  routeSeeText: { flex: 1, color: '#53657c', fontSize: 13.5, lineHeight: 20, fontWeight: '700' },
  routePointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  routePointIndex: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7' },
  routePointIndexText: { color: '#ffffff', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  routePointTitle: { color: '#162640', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  routePointText: { color: '#60718a', fontSize: 12.5, lineHeight: 18, fontWeight: '700', marginTop: 3 },
  routeMapCard: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', padding: 14, gap: 12 },
  routeMapCanvas: { height: 190, borderRadius: 20, overflow: 'hidden', backgroundColor: '#eaf4f6', position: 'relative' },
  routeMapLine: { position: 'absolute', left: '12%', right: '12%', top: '46%', height: 4, borderRadius: 999, backgroundColor: 'rgba(31, 99, 199, 0.30)', transform: [{ rotate: '-8deg' }] },
  routeMapPin: { position: 'absolute', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', borderWidth: 3, borderColor: '#ffffff' },
  routeMapPinText: { color: '#ffffff', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  routeMapButton: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', paddingHorizontal: 12 },
  routeMapButtonText: { color: '#ffffff', fontSize: 13, lineHeight: 17, fontWeight: '900', textAlign: 'center' },

  programsHeroCard: { position: 'relative', overflow: 'hidden', borderRadius: 24, backgroundColor: '#214f9c', paddingHorizontal: 22, paddingVertical: 20, alignItems: 'center' },
  programsList: { gap: 10 },
  programCard: { padding: 16, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f2', shadowColor: '#263856', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  programCardStay: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(31, 99, 199, 0.10)', color: '#1f63c7', fontSize: 11, fontWeight: '900' },
  programCardTitle: { color: '#102a43', fontSize: 18, lineHeight: 22, fontWeight: '900', marginTop: 10 },
  programCardText: { color: '#607086', fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 6 },
  programCardAction: { color: '#1f63c7', fontSize: 13, fontWeight: '900', marginTop: 12 },

  authModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 19, 38, 0.36)' },
  authSheet: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 18 + ANDROID_NAVIGATION_BAR_INSET, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#f8fbff', gap: 10 },
  authSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 4 },
  authSheetTitle: { color: '#102a43', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  authSheetText: { color: '#5e7088', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 5, maxWidth: 270 },
  authCloseButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  authCloseText: { color: '#102a43', fontSize: 24, lineHeight: 26, fontWeight: '700' },
  authNotice: { padding: 12, borderRadius: 16, backgroundColor: '#fff8e7', borderWidth: 1, borderColor: '#f0dfb8' },
  authNoticeText: { color: '#80611c', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  authProviderButton: { minHeight: 62, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e0e8f2' },
  authProviderBrand: { width: 38, height: 38, borderRadius: 14, overflow: 'hidden', backgroundColor: '#edf4ff', color: '#1f63c7', textAlign: 'center', textAlignVertical: 'center', fontSize: 17, lineHeight: 38, fontWeight: '900' },
  authProviderTitle: { color: '#102a43', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  authProviderSub: { color: '#718096', fontSize: 11.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  profileBlock: { minHeight: 76, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e0e8f2', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  profileAvatar: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7' },
  profileAvatarText: { color: '#ffffff', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  profileName: { color: '#102a43', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  profileEmail: { color: '#718096', fontSize: 11.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  profileLogoutButton: { minHeight: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5fa', paddingHorizontal: 12 },
  profileLogoutText: { color: '#1f63c7', fontSize: 12, lineHeight: 15, fontWeight: '900' },

  bottomTabs: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 0, paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 16 : 8 + ANDROID_NAVIGATION_BAR_INSET, backgroundColor: 'rgba(250,252,255,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(211, 221, 234, 0.92)', shadowColor: '#293d5d', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.10, shadowRadius: 24, elevation: 14 },
  bottomTabsInner: { minHeight: 60, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, borderRadius: 0, backgroundColor: 'transparent', borderWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowOpacity: 0, elevation: 0 },
  tabButton: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 18 },
  tabIconWrap: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215, 224, 237, 0.62)' },
  activeTabIconWrap: { backgroundColor: '#1f63c7' },
  tabIconText: { color: '#8d9bad', fontSize: 16, fontWeight: '900' },
  activeTabIconText: { color: '#ffffff' },
  tabText: { color: '#6b788c', fontWeight: '800', fontSize: 10.5, lineHeight: 12, marginTop: 0 },
  activeTabText: { color: '#1f63c7' }
});
