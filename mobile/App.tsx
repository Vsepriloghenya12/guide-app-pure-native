import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
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
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import type { BootstrapPayload, GuideCategory, GuideCollection, GuidePlace, GuideTip, SupportContentStore } from './src/types';
import { fetchBootstrap, fetchSupportContent, fetchAuthSession, fetchAuthStartUrl, logoutAuthSession, deleteAuthProfile, reportBulletin, fetchHiddenAuthors, hideBulletinAuthor, API_BASE_URL, sendAnalytics, submitBulletinListing, fetchMyBulletinListings, deleteMyBulletinListing, getNotificationSettings, registerPushToken, updateNotificationSettings, type NotificationSettings } from './src/api/client';
import { directionsUrl, openExternalUrl } from './src/utils/links';
import { estimateTravelTime, formatDistance, hasCoordinates, haversineDistanceKm } from './src/utils/geo';
import { loadFavoriteSlugs, saveFavoriteSlugs } from './src/utils/favorites';
import { clearAuthToken, getAuthUserAvatarUrl, getCachedAuthUser, readUserFromAuthToken, saveAuthToken } from './src/utils/auth';
import { EmptyState, AppButton, CategoryCard, ListingCard, LoadingState, Pill } from './src/components/ui';
import { normalizeImageUrl } from './src/utils/normalizers';
import { categoryIcons, defaultCategoryIcon, heroBackground, homeHeaderImage, placeVerificationBadge, welcomeBackground, welcomeLogo } from './src/assets';

type TabKey = 'home' | 'sections' | 'search' | 'favorites' | 'nearby' | 'contacts';
type Route =
  | { name: 'tabs'; tab: TabKey }
  | { name: 'category'; categoryId: string }
  | { name: 'routes' }
  | { name: 'routeDetail'; routeId: string }
  | { name: 'tips' }
  | { name: 'programs' }
  | { name: 'detail'; slug: string };

type NativeAuthProviders = {
  google?: boolean;
  apple?: boolean;
  telegram?: boolean;
  telegramBotUsername?: string;
  telegramBotId?: string;
};

const tabItems: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'Главная', icon: '⌂' },
  { key: 'search', label: 'Поиск', icon: '⌕' },
  { key: 'nearby', label: 'Карта', icon: '⌖' },
  { key: 'favorites', label: 'Избранное', icon: '♥' },
  { key: 'contacts', label: 'Помощь', icon: '•••' }
];

const hiddenHomeCategoryIds = new Set(['events']);
const restaurantQuickFilters = ['Морепродукты', 'Вьетнамская', 'Европейская'];
const welcomeSeenStorageKey = 'guide-app-welcome-seen-v1';
const legalBaseUrl = API_BASE_URL.replace(/\/api$/i, '');
const legalLinks = [
  { id: 'terms', label: 'Пользовательское соглашение', path: '/terms' },
  { id: 'privacy', label: 'Политика конфиденциальности', path: '/privacy' },
  { id: 'delete-profile', label: 'Удаление данных профиля', path: '/delete-profile' },
  { id: 'support', label: 'Поддержка', path: '/support' }
] as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

function legalPageUrl(path: string) {
  return legalBaseUrl ? `${legalBaseUrl}${path}` : '';
}

function openLegalPage(path: string) {
  return openExternalUrl(legalPageUrl(path));
}

function getExpoProjectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return Constants.easConfig?.projectId || extra?.eas?.projectId || '';
}

function notificationPlatform(): 'ios' | 'android' | 'unknown' {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return 'unknown';
}

async function getPromotionPushToken() {
  if (Platform.OS === 'web') {
    throw new Error('Push-уведомления доступны только в мобильном приложении.');
  }

  const currentPermissions = await Notifications.getPermissionsAsync();
  let status = currentPermissions.status;
  if (status !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    status = requestedPermissions.status;
  }
  if (status !== 'granted') {
    throw new Error('Разрешение на уведомления не выдано.');
  }

  try {
    const projectId = getExpoProjectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return tokenResult.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (/firebase|fcm|google-services|Default FirebaseApp/i.test(message)) {
      throw new Error('Push-уведомления не подключены в этой APK-сборке. Для Android нужен Firebase: файл google-services.json и FCM-настройки.');
    }
    throw error;
  }
}

function getPromotionListingIdFromNotification(response: Notifications.NotificationResponse | null) {
  const data = response?.notification?.request?.content?.data || {};
  if (data?.type !== 'promotion') return '';
  return String(data?.listing_id || data?.listingId || '').trim();
}

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

const mapTileUrl = String(process.env.EXPO_PUBLIC_MAP_TILE_URL || '').trim() || 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
const staticMapTileSize = 256;

const ANDROID_STATUS_BAR_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const ANDROID_NAVIGATION_BAR_INSET = Platform.OS === 'android' ? 34 : 0;
const BOTTOM_TABS_VISIBLE_HEIGHT = 66 + ANDROID_NAVIGATION_BAR_INSET;

function useMobileInsets() {
  const insets = useSafeAreaInsets();
  return {
    top: Math.max(insets.top, ANDROID_STATUS_BAR_INSET),
    bottom: Math.max(insets.bottom, ANDROID_NAVIGATION_BAR_INSET)
  };
}

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
    .filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index);
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


function contactUrlFromText(value: string) {
  const contact = value.trim();
  if (!contact) return '';
  if (/^https?:\/\//i.test(contact)) return contact;
  if (/^(t\.me|telegram\.me)\//i.test(contact)) return `https://${contact}`;
  if (contact.startsWith('@') && contact.length > 1) return `https://t.me/${contact.slice(1)}`;

  const digits = contact.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function normalizeBulletinSection(value: unknown) {
  const text = toText(value, 'Разное');
  const normalized = normalizeToken(text);
  if (!normalized || normalized.includes('аренд')) return 'Разное';
  return text;
}

function bulletinStatusLabel(status?: GuidePlace['status']) {
  if (status === 'published') return 'Опубликовано';
  if (status === 'hidden') return 'Не прошло модерацию';
  return 'На модерации';
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

type BulletinPostImage = {
  uri: string;
  dataUrl: string;
  fileName: string;
};

type BulletinReportReason = 'spam' | 'illegal' | 'offensive' | 'misleading' | 'other';

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

function openStreetMapRouteUrl(route: NativeRoute) {
  const origin = route.points[0];
  const destination = route.points[route.points.length - 1];
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${origin.lat}%2C${origin.lng}%3B${destination.lat}%2C${destination.lng}`;
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

type InlineErrorBoundaryState = { hasError: boolean };

class InlineErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, InlineErrorBoundaryState> {
  state: InlineErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): InlineErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppContent />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const mobileInsets = useMobileInsets();
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
  const [authProviders, setAuthProviders] = useState<NativeAuthProviders>({});
  const [hiddenAuthorIds, setHiddenAuthorIds] = useState<string[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({ promotionsEnabled: false, hasPushToken: false });
  const [isWelcomeChecked, setWelcomeChecked] = useState(false);
  const [isWelcomeVisible, setWelcomeVisible] = useState(false);
  const pendingPromotionListingIdRef = useRef('');

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
    const [nextPayload, nextSupport, savedFavorites, authSession, cachedAuthUser, nextHiddenAuthorIds, nextNotificationSettings] = await Promise.all([
      fetchBootstrap(),
      fetchSupportContent(),
      loadFavoriteSlugs(),
      fetchAuthSession(),
      getCachedAuthUser(),
      fetchHiddenAuthors(),
      getNotificationSettings()
    ]);
    setPayload(nextPayload);
    setSupport(nextSupport);
    setFavoriteSlugs(savedFavorites);
    setAuthProviders(authSession.providers || {});
    setHiddenAuthorIds(nextHiddenAuthorIds);
    setNotificationSettings(nextNotificationSettings);
    setAuthUser(
      authSession.authenticated && authSession.user && typeof authSession.user === 'object'
        ? authSession.user as Record<string, unknown>
        : cachedAuthUser
    );
  }, []);

  useEffect(() => {
    void loadApp();
  }, [loadApp]);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(welcomeSeenStorageKey)
      .then((value) => {
        if (!mounted) return;
        setWelcomeVisible(value !== '1');
      })
      .finally(() => {
        if (mounted) setWelcomeChecked(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleAuthDeepLink = useCallback(async (url: string | null) => {
    if (!isAuthDeepLink(url)) return;
    const params = parseDeepLinkParams(String(url || ''));

    if (params.auth === 'success' && params.sessionToken) {
      await saveAuthToken(params.sessionToken);
      const userFromToken = readUserFromAuthToken(params.sessionToken);
      if (userFromToken) {
        setAuthUser(userFromToken);
      }
      const authSession = await fetchAuthSession();
      setAuthProviders(authSession.providers || {});

      if (authSession.authenticated && authSession.user && typeof authSession.user === 'object') {
        setAuthUser(authSession.user as Record<string, unknown>);
      }

      setAuthSheetOpen(false);
      setWelcomeVisible(false);
      await AsyncStorage.setItem(welcomeSeenStorageKey, '1');
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
  const allListings = payload?.listings ?? [];
  const hiddenAuthorSet = useMemo(() => new Set(hiddenAuthorIds), [hiddenAuthorIds]);
  const listings = useMemo(
    () => allListings.filter((item) => (
      item.categoryId !== 'bulletin-board' ||
      !item.createdByUserId ||
      !hiddenAuthorSet.has(item.createdByUserId)
    )),
    [allListings, hiddenAuthorSet]
  );
  const favoriteSet = useMemo(() => new Set(favoriteSlugs), [favoriteSlugs]);

  const openPromotionListing = useCallback((listingId: string) => {
    const normalizedId = String(listingId || '').trim();
    if (!normalizedId) return false;

    const listing = allListings.find((item) => item.id === normalizedId || item.slug === normalizedId) || null;
    if (!listing) {
      pendingPromotionListingIdRef.current = normalizedId;
      return false;
    }

    pendingPromotionListingIdRef.current = '';
    setRoute({ name: 'detail', slug: listing.slug || listing.id });
    return true;
  }, [allListings, setRoute]);

  useEffect(() => {
    const pendingListingId = pendingPromotionListingIdRef.current;
    if (pendingListingId && allListings.length > 0 && !openPromotionListing(pendingListingId)) {
      Alert.alert('Акция', 'Не удалось найти карточку заведения. Откройте главный экран и обновите данные.');
      pendingPromotionListingIdRef.current = '';
    }
  }, [allListings.length, openPromotionListing]);

  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const listingId = getPromotionListingIdFromNotification(response);
      if (listingId) openPromotionListing(listingId);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const listingId = getPromotionListingIdFromNotification(response);
      if (listingId) openPromotionListing(listingId);
    });
    return () => subscription.remove();
  }, [openPromotionListing]);

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
    setHiddenAuthorIds([]);
    setNotificationSettings({ promotionsEnabled: false, hasPushToken: false });
    setAuthSheetOpen(false);
  }, []);

  const handleDeleteProfile = useCallback(() => {
    Alert.alert(
      'Удалить данные профиля?',
      'Будут удалены ваш авторизованный профиль Danang Guide, избранное, ваши объявления и связанные с ними данные. Это не удалит ваш аккаунт Google, Apple или Telegram.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить данные',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAuthProfile();
              await clearAuthToken();
              await saveFavoriteSlugs([]);
              setFavoriteSlugs([]);
              setAuthUser(null);
              setHiddenAuthorIds([]);
              setNotificationSettings({ promotionsEnabled: false, hasPushToken: false });
              setAuthSheetOpen(false);
              await loadApp();
              Alert.alert('Данные профиля удалены');
            } catch (error) {
              Alert.alert('Не удалось удалить данные', error instanceof Error ? error.message : 'Попробуйте ещё раз.');
            }
          }
        }
      ]
    );
  }, [loadApp]);

  const handlePromotionsNotificationsChange = useCallback(async (enabled: boolean) => {
    if (!authUser) {
      setAuthSheetOpen(true);
      return;
    }

    try {
      if (enabled) {
        const expoPushToken = await getPromotionPushToken();
        await registerPushToken({
          expoPushToken,
          platform: notificationPlatform(),
          promotionsEnabled: true
        });
        setNotificationSettings({ promotionsEnabled: true, hasPushToken: true });
        Alert.alert('Уведомления включены', 'Мы будем присылать только акции заведений Danang Guide.');
        return;
      }

      const nextSettings = await updateNotificationSettings(false);
      setNotificationSettings(nextSettings);
      Alert.alert('Уведомления отключены', 'Акции заведений больше не будут приходить push-уведомлениями.');
    } catch (error) {
      Alert.alert('Не удалось изменить уведомления', error instanceof Error ? error.message : 'Попробуйте ещё раз.');
    }
  }, [authUser]);

  const handleWelcomeStart = useCallback(async () => {
    await AsyncStorage.setItem(welcomeSeenStorageKey, '1');
    setWelcomeVisible(false);
    setAuthSheetOpen(true);
  }, []);

  const handleReportBulletin = useCallback((place: GuidePlace) => {
    if (!authUser) {
      setAuthSheetOpen(true);
      return;
    }

    const sendReport = async (reason: BulletinReportReason) => {
      try {
        const response = await reportBulletin(place.id, reason);
        Alert.alert(response.report?.duplicate ? 'Жалоба уже отправлена' : 'Жалоба отправлена', response.message || 'Спасибо, мы проверим объявление.');
      } catch (error) {
        Alert.alert('Не удалось отправить жалобу', error instanceof Error ? error.message : 'Попробуйте ещё раз.');
      }
    };

    Alert.alert('Пожаловаться на объявление', place.title, [
      { text: 'Спам', onPress: () => void sendReport('spam') },
      { text: 'Запрещённый контент', onPress: () => void sendReport('illegal') },
      { text: 'Оскорбительный контент', onPress: () => void sendReport('offensive') },
      { text: 'Недостоверная информация', onPress: () => void sendReport('misleading') },
      { text: 'Другое', onPress: () => void sendReport('other') },
      { text: 'Отмена', style: 'cancel' }
    ]);
  }, [authUser]);

  const handleHideBulletinAuthor = useCallback((place: GuidePlace) => {
    if (!authUser) {
      setAuthSheetOpen(true);
      return;
    }

    if (!place.createdByUserId) {
      Alert.alert('Не удалось скрыть автора', 'У объявления не указан автор.');
      return;
    }

    Alert.alert('Скрыть автора?', 'Объявления этого автора больше не будут показываться у вас в списке.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Скрыть автора',
        style: 'destructive',
        onPress: async () => {
          try {
            const nextHiddenAuthorIds = await hideBulletinAuthor(place.id);
            setHiddenAuthorIds(nextHiddenAuthorIds);
            Alert.alert('Автор скрыт');
            if (routeRef.current.name === 'detail') {
              goBack();
            }
          } catch (error) {
            Alert.alert('Не удалось скрыть автора', error instanceof Error ? error.message : 'Попробуйте ещё раз.');
          }
        }
      }
    ]);
  }, [authUser, goBack]);

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

  if (!payload || !isWelcomeChecked) {
    return <LoadingState />;
  }

  if (isWelcomeVisible) {
    return <WelcomeScreen onStart={() => void handleWelcomeStart()} />;
  }

  const selectedCategory = route.name === 'category' ? categories.find((item) => item.id === route.categoryId) : null;
  const selectedListing = route.name === 'detail' ? listings.find((item) => item.slug === route.slug || item.id === route.slug) : null;
  const isHomeRoot = route.name === 'tabs' && route.tab === 'home';
  const hideTopHeader = isHomeRoot || route.name === 'category' || route.name === 'routes' || route.name === 'routeDetail' || route.name === 'programs' || route.name === 'tips';

  return (
    <View style={styles.safeArea} {...backSwipeResponder.panHandlers}>
      <StatusBar translucent barStyle="dark-content" backgroundColor="transparent" />
      {!hideTopHeader ? (
        <View style={[styles.appHeader, { paddingTop: mobileInsets.top + 8 }]}>
          <View>
            <Text style={styles.logoText}>Твой гид</Text>
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
          authUser={authUser}
          onOpenAuth={() => setAuthSheetOpen(true)}
          onReportBulletin={handleReportBulletin}
          onHideBulletinAuthor={handleHideBulletinAuthor}
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
          authUser={authUser}
          onOpenAuth={() => setAuthSheetOpen(true)}
          onBack={goBack}
        />
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentInner,
            { paddingBottom: 66 + mobileInsets.bottom + 26 },
            isHomeRoot && styles.homeContentInner,
            isHomeRoot && { paddingBottom: 66 + mobileInsets.bottom + 22 }
          ]}
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
              authUser={authUser}
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
        <BottomTabs active={route.name === 'tabs' ? route.tab : 'home'} onChange={(tab) => setRoute({ name: 'tabs', tab })} bottomInset={mobileInsets.bottom} />
      ) : null}
      <AuthSheet
        visible={isAuthSheetOpen}
        user={authUser}
        providers={authProviders}
        notificationSettings={notificationSettings}
        onClose={() => setAuthSheetOpen(false)}
        onLogout={handleLogout}
        onDeleteProfile={handleDeleteProfile}
        onTogglePromotionsNotifications={handlePromotionsNotificationsChange}
      />
    </View>
  );
}

function HomeScreen({
  payload,
  favoriteSet,
  openCategory,
  openDetail,
  toggleFavorite,
  authUser,
  onOpenAuth,
  onOpenPrograms,
  onOpenTips
}: {
  payload: BootstrapPayload;
  favoriteSet: Set<string>;
  openCategory: (category: GuideCategory) => void;
  openDetail: (place: GuidePlace) => void;
  toggleFavorite: (slug: string) => void;
  authUser: Record<string, unknown> | null;
  onOpenAuth: () => void;
  onOpenPrograms: () => void;
  onOpenTips: () => void;
}) {
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [selectedTip, setSelectedTip] = useState<GuideTip | null>(null);
  const bannerScrollRef = useRef<ScrollView | null>(null);
  const activeHeroIndexRef = useRef(0);
  const { width: viewportWidth } = useWindowDimensions();
  const visibleCategories = useMemo(
    () => dedupeHomeCategories(
      withRoutesShortcut(payload.categories.filter((category) => category.visible && !hiddenHomeCategoryIds.has(category.id)))
    ),
    [payload.categories]
  );
  const activeBanners = useMemo(() => payload.collections.filter((collection) => collection.active), [payload.collections]);
  const loopedBanners = useMemo(() => (
    activeBanners.length > 1
      ? [activeBanners[activeBanners.length - 1], ...activeBanners, activeBanners[0]]
      : activeBanners
  ), [activeBanners]);
  const visibleTips = useMemo(() => payload.tips.filter((tip) => tip.active).slice(0, 3), [payload.tips]);
  const bannerGap = 12;
  const bannerCardWidth = Math.max(248, Math.min(viewportWidth - 54, viewportWidth * 0.78));
  const bannerSideInset = Math.max(18, (viewportWidth - bannerCardWidth) / 2);
  const bannerStep = bannerCardWidth + bannerGap;
  const firstRealBannerOffset = activeBanners.length > 1 ? bannerStep : 0;
  const heroAvatarUrl = getAuthUserAvatarUrl(authUser);

  useEffect(() => {
    setActiveHeroIndex(0);
    activeHeroIndexRef.current = 0;
    requestAnimationFrame(() => bannerScrollRef.current?.scrollTo({ x: firstRealBannerOffset, animated: false }));
  }, [activeBanners.length, firstRealBannerOffset]);

  useEffect(() => {
    activeHeroIndexRef.current = activeHeroIndex;
  }, [activeHeroIndex]);

  const scrollToBanner = useCallback((index: number) => {
    if (activeBanners.length < 1) return;
    const nextIndex = positiveModulo(index, activeBanners.length);
    setActiveHeroIndex(nextIndex);
    activeHeroIndexRef.current = nextIndex;
    bannerScrollRef.current?.scrollTo({ x: (activeBanners.length > 1 ? nextIndex + 1 : nextIndex) * bannerStep, animated: true });
  }, [activeBanners.length, bannerStep]);

  useEffect(() => {
    if (activeBanners.length < 2) return undefined;
    const timer = setInterval(() => {
      const currentIndex = activeHeroIndexRef.current;
      const nextIndex = positiveModulo(currentIndex + 1, activeBanners.length);
      setActiveHeroIndex(nextIndex);
      activeHeroIndexRef.current = nextIndex;
      const targetOffset = currentIndex === activeBanners.length - 1
        ? (activeBanners.length + 1) * bannerStep
        : (nextIndex + 1) * bannerStep;
      bannerScrollRef.current?.scrollTo({ x: targetOffset, animated: true });
    }, 2000);
    return () => clearInterval(timer);
  }, [activeBanners.length, bannerStep]);

  const handleBannerMomentumEnd = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (activeBanners.length < 2) return;
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / bannerStep);
    if (rawIndex <= 0) {
      const lastIndex = activeBanners.length - 1;
      setActiveHeroIndex(lastIndex);
      activeHeroIndexRef.current = lastIndex;
      requestAnimationFrame(() => bannerScrollRef.current?.scrollTo({ x: activeBanners.length * bannerStep, animated: false }));
      return;
    }
    if (rawIndex >= activeBanners.length + 1) {
      setActiveHeroIndex(0);
      activeHeroIndexRef.current = 0;
      requestAnimationFrame(() => bannerScrollRef.current?.scrollTo({ x: bannerStep, animated: false }));
      return;
    }
    const nextIndex = rawIndex - 1;
    setActiveHeroIndex(nextIndex);
    activeHeroIndexRef.current = nextIndex;
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
      <ImageBackground source={homeHeaderImage} style={[styles.homeHero, { width: viewportWidth }]} imageStyle={styles.homeHeroImage}>
        <View style={styles.homeHeroOverlay} />
        <TouchableOpacity activeOpacity={0.86} onPress={onOpenAuth} style={styles.heroAuthButton}>
          {heroAvatarUrl ? (
            <Image source={{ uri: heroAvatarUrl }} style={styles.heroAuthAvatar} />
          ) : authUser ? (
            <Text style={styles.heroAuthIcon}>{toText(authUser.displayName || authUser.username || authUser.email, 'П').slice(0, 1).toUpperCase()}</Text>
          ) : (
            <Text style={styles.heroAuthIcon}>👤</Text>
          )}
        </TouchableOpacity>
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
              {loopedBanners.map((banner, index) => (
                <TouchableOpacity
                  key={`${banner.id}-${index}`}
                  activeOpacity={0.9}
                  onPress={() => openBannerLink(banner)}
                  style={[styles.homeBanner, styles.homeBannerSlide, { width: bannerCardWidth }]}
                >
                  <ImageBackground source={bannerImageSource(banner)} style={styles.full} imageStyle={styles.homeBannerImage}>
                    <View style={styles.bannerOverlay} />
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
  authUser,
  onOpenAuth,
  onBack
}: {
  category: GuideCategory;
  listings: GuidePlace[];
  favoriteSet: Set<string>;
  toggleFavorite: (slug: string) => void;
  openDetail: (place: GuidePlace) => void;
  refreshing: boolean;
  refresh: () => void;
  authUser: Record<string, unknown> | null;
  onOpenAuth: () => void;
  onBack: () => void;
}) {
  const mobileInsets = useMobileInsets();
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
        authUser={authUser}
        onOpenAuth={onOpenAuth}
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
        contentContainerStyle={[
          styles.categoryContentInner,
          { paddingTop: mobileInsets.top + 14, paddingBottom: 66 + mobileInsets.bottom + 26 }
        ]}
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
  authUser,
  onOpenAuth,
  onBack
}: {
  listings: GuidePlace[];
  favoriteSet: Set<string>;
  toggleFavorite: (slug: string) => void;
  openDetail: (place: GuidePlace) => void;
  refreshing: boolean;
  refresh: () => void;
  authUser: Record<string, unknown> | null;
  onOpenAuth: () => void;
  onBack: () => void;
}) {
  const mobileInsets = useMobileInsets();
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('Все');
  const [isPostOpen, setPostOpen] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postSection, setPostSection] = useState('Разное');
  const [postPhone, setPostPhone] = useState('');
  const [postImages, setPostImages] = useState<BulletinPostImage[]>([]);
  const [isPosting, setPosting] = useState(false);
  const [myListings, setMyListings] = useState<GuidePlace[]>([]);
  const [deletingId, setDeletingId] = useState('');
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
  const resetPostForm = useCallback(() => {
    setPostTitle('');
    setPostDescription('');
    setPostSection('Разное');
    setPostPhone('');
    setPostImages([]);
  }, []);
  const pickPostImages = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа к фото', 'Разреши доступ к галерее в настройках устройства.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 6 - postImages.length),
      quality: 0.82,
      base64: true
    });

    if (result.canceled) return;

    const nextImages = result.assets
      .map((asset, index) => {
        if (!asset.base64 || !asset.uri) return null;
        const mimeType = asset.mimeType || 'image/jpeg';
        const fileName = asset.fileName || `bulletin-photo-${Date.now()}-${index + 1}.jpg`;
        return {
          uri: asset.uri,
          dataUrl: `data:${mimeType};base64,${asset.base64}`,
          fileName
        };
      })
      .filter((item): item is BulletinPostImage => Boolean(item));

    setPostImages((current) => [...current, ...nextImages].slice(0, 6));
  }, [postImages.length]);
  const removePostImage = useCallback((index: number) => {
    setPostImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);
  const refreshMyListings = useCallback(async () => {
    if (!authUser) {
      setMyListings([]);
      return;
    }
    try {
      setMyListings(await fetchMyBulletinListings());
    } catch {
      setMyListings([]);
    }
  }, [authUser]);

  useEffect(() => {
    void refreshMyListings();
  }, [refreshMyListings]);

  const deleteOwnListing = useCallback((place: GuidePlace) => {
    Alert.alert('Удалить объявление?', place.title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(place.id);
          try {
            await deleteMyBulletinListing(place.id);
            setMyListings((current) => current.filter((item) => item.id !== place.id));
            refresh();
          } catch (error) {
            Alert.alert('Не удалось удалить', error instanceof Error ? error.message : 'Попробуйте ещё раз.');
          } finally {
            setDeletingId('');
          }
        }
      }
    ]);
  }, [refresh]);
  const openPostForm = useCallback(() => {
    if (!authUser) {
      onOpenAuth();
      return;
    }
    setPostOpen(true);
  }, [authUser, onOpenAuth]);
  const submitPost = useCallback(async () => {
    if (!authUser || isPosting) return;
    const title = postTitle.trim();
    const description = postDescription.trim();
    const phone = postPhone.trim();
    if (title.length < 3 || description.length < 10 || !phone) {
      Alert.alert('Проверь объявление', 'Заполни название, описание и телефон или Telegram для связи.');
      return;
    }
    setPosting(true);
    try {
      const response = await submitBulletinListing({
        title,
        description,
        section: postSection,
        subcategory: 'Другое',
        phone,
        images: postImages.map((image) => ({ dataUrl: image.dataUrl, fileName: image.fileName })),
        contactName: toText(authUser.displayName || authUser.username || authUser.email),
        district: '',
        priceLabel: ''
      });
      Alert.alert('Объявление отправлено', response.message || 'После модерации оно появится в списке.');
      resetPostForm();
      setPostOpen(false);
      void refreshMyListings();
      refresh();
    } catch (error) {
      Alert.alert('Не удалось отправить', error instanceof Error ? error.message : 'Попробуйте ещё раз.');
    } finally {
      setPosting(false);
    }
  }, [authUser, isPosting, postDescription, postImages, postPhone, postSection, postTitle, refresh, refreshMyListings, resetPostForm]);

  return (
    <>
      <ScrollView
        style={[styles.content, styles.categoryContent]}
        contentContainerStyle={[
          styles.categoryContentInner,
          styles.bulletinContentInner,
          { paddingTop: mobileInsets.top + 18, paddingBottom: 66 + mobileInsets.bottom + 26 }
        ]}
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

        <TouchableOpacity activeOpacity={0.88} onPress={openPostForm} style={styles.bulletinPostButton}>
          <Text style={styles.bulletinPostText}>{authUser ? 'Разместить объявление' : 'Войти и разместить'}</Text>
        </TouchableOpacity>

        {myListings.length > 0 ? (
          <View style={styles.myBulletinsBlock}>
            <Text style={styles.myBulletinsTitle}>Мои объявления</Text>
            {myListings.map((place) => (
              <View key={place.id} style={styles.myBulletinCard}>
                <View style={styles.flex}>
                  <Text style={styles.myBulletinTitle} numberOfLines={1}>{place.title}</Text>
                  <Text style={styles.myBulletinStatus}>{bulletinStatusLabel(place.status)}</Text>
                  {place.status === 'hidden' && place.moderationNote ? (
                    <Text style={styles.myBulletinNote}>Причина: {place.moderationNote}</Text>
                  ) : null}
                </View>
                <TouchableOpacity activeOpacity={0.84} disabled={deletingId === place.id} onPress={() => deleteOwnListing(place)} style={styles.myBulletinDeleteButton}>
                  <Text style={styles.myBulletinDeleteText}>{deletingId === place.id ? '...' : 'Удалить'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

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
      <Modal visible={isPostOpen} transparent animationType="slide" onRequestClose={() => setPostOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={() => setPostOpen(false)} />
          <ScrollView
            style={styles.bulletinPostSheet}
            contentContainerStyle={styles.bulletinPostSheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetTitle}>Новое объявление</Text>
                <Text style={styles.filterSheetMeta}>После отправки уйдет на модерацию</Text>
              </View>
              <TouchableOpacity style={styles.filterCloseButton} onPress={() => setPostOpen(false)}><Text style={styles.filterCloseText}>×</Text></TouchableOpacity>
            </View>
            <TextInput value={postTitle} onChangeText={setPostTitle} placeholder="Название" placeholderTextColor="#8a9aae" style={styles.bulletinPostInput} />
            <TextInput value={postDescription} onChangeText={setPostDescription} placeholder="Описание" placeholderTextColor="#8a9aae" style={[styles.bulletinPostInput, styles.bulletinPostInputMultiline]} multiline textAlignVertical="top" />
            <View style={styles.bulletinQuickRow}>
              {sections.slice(1).map((section) => {
                const active = postSection === section;
                return (
                  <TouchableOpacity key={section} activeOpacity={0.82} onPress={() => setPostSection(section)} style={[styles.bulletinQuickButton, active && styles.bulletinQuickButtonActive]}>
                    <Text style={[styles.bulletinQuickText, active && styles.bulletinQuickTextActive]}>{section}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput value={postPhone} onChangeText={setPostPhone} placeholder="Телефон или Telegram" placeholderTextColor="#8a9aae" style={styles.bulletinPostInput} />
            <View style={styles.bulletinPhotoHeader}>
              <Text style={styles.bulletinPhotoTitle}>Фото</Text>
              <TouchableOpacity activeOpacity={0.84} disabled={postImages.length >= 6} onPress={() => void pickPostImages()} style={[styles.bulletinAddPhotoButton, postImages.length >= 6 && styles.authProviderButtonDisabled]}>
                <Text style={styles.bulletinAddPhotoText}>{postImages.length ? 'Добавить ещё' : 'Добавить фото'}</Text>
              </TouchableOpacity>
            </View>
            {postImages.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bulletinPhotoRow}>
                {postImages.map((image, index) => (
                  <View key={`${image.uri}-${index}`} style={styles.bulletinPhotoThumbWrap}>
                    <Image source={{ uri: image.uri }} style={styles.bulletinPhotoThumb} />
                    <TouchableOpacity activeOpacity={0.82} onPress={() => removePostImage(index)} style={styles.bulletinRemovePhotoButton}>
                      <Text style={styles.bulletinRemovePhotoText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <TouchableOpacity activeOpacity={0.88} disabled={isPosting} onPress={() => void submitPost()} style={[styles.bulletinPostButton, isPosting && styles.authProviderButtonDisabled]}>
              <Text style={styles.bulletinPostText}>{isPosting ? 'Отправляем...' : 'Отправить объявление'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
  const imageUrls = getPlaceImageUrls(place);
  const [fullscreenImage, setFullscreenImage] = useState('');
  const avgCheckValue = Number(place.avgCheck);
  const checkLabel = place.priceLabel || (Number.isFinite(avgCheckValue) && avgCheckValue > 0 ? `${avgCheckValue.toLocaleString('ru-RU')} ₫` : 'Не указан');
  const hoursLabel = place.hours || 'Не указано';
  const cuisineLabel = toText(place.cuisine);
  const typeLabel = cuisineLabel ? '' : toText(place.kind || place.listingType || place.type || place.categoryId);

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.restaurantCardNative}>
      {imageUrls.length > 0 ? (
        <View style={styles.restaurantCardImage}>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.full}
          >
            {imageUrls.map((imageUrl, index) => (
              <TouchableOpacity key={`${imageUrl}-${index}`} activeOpacity={0.92} onPress={onPress}>
                <ImageBackground source={{ uri: imageUrl }} style={styles.restaurantCardImageSlide} imageStyle={styles.restaurantCardImageReal}>
                <View style={styles.restaurantCardImageShade} />
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.restaurantCardImageTitle} numberOfLines={2}>{place.title}</Text>
          {imageUrls.length > 1 ? <Text style={styles.restaurantCardImageCount}>{imageUrls.length} фото</Text> : null}
          {isFavorite ? <Text style={styles.restaurantCardSavedMark}>♥</Text> : null}
        </View>
      ) : (
        <View style={[styles.restaurantCardImage, styles.restaurantCardImageFallback]}>
          <Text style={styles.restaurantCardImageTitle} numberOfLines={2}>{place.title}</Text>
          {isFavorite ? <Text style={styles.restaurantCardSavedMark}>♥</Text> : null}
        </View>
      )}
      <View style={styles.restaurantCardBody}>
        <View style={styles.restaurantCardTitleRow}>
          <Text style={styles.restaurantCardTitle} numberOfLines={2}>{place.title}</Text>
          {place.qualityBadge ? <Image source={placeVerificationBadge} resizeMode="contain" style={styles.restaurantCardQualityBadge} /> : null}
        </View>
        <Text style={styles.restaurantCardSubtitle} numberOfLines={1}>{place.shortDescription || place.description || place.district || place.kind}</Text>
        <View style={styles.restaurantFacts}>
          <RestaurantFact tone="hours" value={hoursLabel} />
          <RestaurantFact tone="cuisine" value={cuisineLabel} />
          <RestaurantFact tone="type" value={typeLabel} />
          <RestaurantFact tone="price" value={checkLabel} />
        </View>
      </View>
      <FullscreenImageModal imageUrl={fullscreenImage} onClose={() => setFullscreenImage('')} />
    </TouchableOpacity>
  );
}

type RestaurantFactTone = 'hours' | 'cuisine' | 'type' | 'price';

function RestaurantFact({ value, tone }: { value: string; tone: RestaurantFactTone }) {
  if (!value) return null;

  return (
    <View style={styles.restaurantFactRow}>
      <RestaurantFactIcon tone={tone} />
      <Text style={styles.restaurantFactText} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RestaurantFactIcon({ tone }: { tone: RestaurantFactTone }) {
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
      <View style={styles.restaurantCuisineIcon}>
        <View style={styles.restaurantCuisinePlate} />
        <View style={styles.restaurantCuisineForkHandle} />
        <View style={styles.restaurantCuisineForkTine} />
        <View style={[styles.restaurantCuisineForkTine, styles.restaurantCuisineForkTineRight]} />
      </View>
    );
  }

  if (tone === 'type') {
    return (
      <View style={styles.restaurantTypeIcon}>
        <View style={styles.restaurantTypeIconDot} />
        <View style={styles.restaurantTypeIconLine} />
      </View>
    );
  }

  return <Text style={styles.restaurantDollarIcon}>$</Text>;
}



function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function longitudeToTileX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTileY(latitude: number, zoom: number) {
  const safeLatitude = clampNumber(latitude, -85.05112878, 85.05112878);
  const rad = safeLatitude * Math.PI / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

function mapTileImageUrl(zoom: number, x: number, y: number) {
  const maxTile = 2 ** zoom;
  const wrappedX = ((x % maxTile) + maxTile) % maxTile;
  const clampedY = clampNumber(y, 0, maxTile - 1);
  return mapTileUrl
    .replace('{z}', String(zoom))
    .replace('{x}', String(wrappedX))
    .replace('{y}', String(clampedY));
}

function chooseStaticMapZoom(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length <= 1) return 15;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const spread = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
  if (spread > 0.35) return 10;
  if (spread > 0.16) return 11;
  if (spread > 0.08) return 12;
  if (spread > 0.035) return 13;
  if (spread > 0.015) return 14;
  return 15;
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
  const [selectedPlace, setSelectedPlace] = useState<GuidePlace | null>(null);
  const { width } = useWindowDimensions();
  const mapWidth = Math.max(280, Math.min(width - 32, 640));
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
      return { latitude, longitude, title: toText(point.title, 'Точка маршрута') };
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

  const zoom = chooseStaticMapZoom(allCoordinates);
  const center = {
    latitude: allCoordinates.reduce((sum, point) => sum + point.latitude, 0) / allCoordinates.length,
    longitude: allCoordinates.reduce((sum, point) => sum + point.longitude, 0) / allCoordinates.length
  };
  const centerTileX = longitudeToTileX(center.longitude, zoom);
  const centerTileY = latitudeToTileY(center.latitude, zoom);
  const baseTileX = Math.floor(centerTileX) - 1;
  const baseTileY = Math.floor(centerTileY) - 1;
  const offsetX = mapWidth / 2 - (centerTileX - baseTileX) * staticMapTileSize;
  const offsetY = height / 2 - (centerTileY - baseTileY) * staticMapTileSize;
  const tiles = Array.from({ length: 9 }, (_, index) => {
    const dx = index % 3;
    const dy = Math.floor(index / 3);
    return {
      id: `${zoom}-${baseTileX + dx}-${baseTileY + dy}`,
      x: baseTileX + dx,
      y: baseTileY + dy,
      left: dx * staticMapTileSize + offsetX,
      top: dy * staticMapTileSize + offsetY
    };
  });
  const markerPosition = (coordinate: { latitude: number; longitude: number }) => ({
    left: (longitudeToTileX(coordinate.longitude, zoom) - baseTileX) * staticMapTileSize + offsetX,
    top: (latitudeToTileY(coordinate.latitude, zoom) - baseTileY) * staticMapTileSize + offsetY
  });

  return (
    <View style={[styles.nativeMapCard, { height }]}> 
      <View style={styles.nativeStaticMapLayer} pointerEvents="none">
        {tiles.map((tile) => (
          <Image
            key={tile.id}
            source={{ uri: mapTileImageUrl(zoom, tile.x, tile.y) }}
            style={[styles.nativeStaticMapTile, { left: tile.left, top: tile.top }]}
          />
        ))}
      </View>
      {routeCoordinates.map((coordinate, index) => {
        const position = markerPosition(coordinate);
        return (
          <View
            key={`route-${index}-${coordinate.latitude}-${coordinate.longitude}`}
            pointerEvents="none"
            style={[styles.nativeRouteMarker, { left: position.left - 12, top: position.top - 12 }]}
          >
            <Text style={styles.nativeRouteMarkerText}>{index + 1}</Text>
          </View>
        );
      })}
      {placeMarkers.map(({ place, coordinate }) => {
        const position = markerPosition(coordinate);
        return (
          <TouchableOpacity
            key={place.id}
            activeOpacity={0.82}
            onPress={() => setSelectedPlace(place)}
            style={[styles.nativePlaceMarker, { left: position.left - 13, top: position.top - 30 }]}
          >
            <Text style={styles.nativePlaceMarkerText}>●</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity activeOpacity={0.84} onPress={() => void openExternalUrl('https://www.openstreetmap.org/copyright')} style={styles.nativeMapAttribution}>
        <Text style={styles.nativeMapAttributionText}>© OpenStreetMap · © CARTO</Text>
      </TouchableOpacity>
      {selectedPlace ? (
        <View style={styles.nativeMapPopup}>
          <View style={styles.flex}>
            <Text style={styles.nativeMapPopupTitle} numberOfLines={1}>{toText(selectedPlace.title, 'Место')}</Text>
            <Text style={styles.nativeMapPopupText} numberOfLines={2}>{toText(selectedPlace.address || selectedPlace.district || selectedPlace.kind, 'Открыть карточку')}</Text>
          </View>
          <TouchableOpacity activeOpacity={0.82} onPress={() => onOpenPlace?.(selectedPlace)} style={styles.nativeMapPopupButton}>
            <Text style={styles.nativeMapPopupButtonText}>Открыть</Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
  const mobileInsets = useMobileInsets();
  return (
    <ScrollView
      style={[styles.content, styles.categoryContent]}
      contentContainerStyle={[styles.categoryContentInner, { paddingBottom: 112 + mobileInsets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
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
        <TouchableOpacity activeOpacity={0.86} onPress={() => void openExternalUrl(openStreetMapRouteUrl(route))} style={styles.routeMapButton}>
          <Text style={styles.routeMapButtonText}>Открыть маршрут</Text>
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
      {legalBaseUrl ? (
        <View style={styles.legalLinksCard}>
          <Text style={styles.legalLinksTitle}>Документы и поддержка</Text>
          {legalLinks.map((link) => (
            <TouchableOpacity key={link.id} activeOpacity={0.82} onPress={() => void openLegalPage(link.path)} style={styles.legalLinkRow}>
              <Text style={styles.legalLinkText}>{link.label}</Text>
              <Text style={styles.legalLinkArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
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

function getApiOriginForAuth() {
  const raw = API_BASE_URL.replace(/\/api\/?$/i, '').replace(/\/+$/g, '');
  return raw || API_BASE_URL;
}

function buildTelegramNativeOAuthUrl(providers: NativeAuthProviders, returnTo: string) {
  const botId = String(providers.telegramBotId || process.env.EXPO_PUBLIC_TELEGRAM_BOT_ID || '').trim();
  if (!/^\d+$/.test(botId)) return '';

  const origin = getApiOriginForAuth();
  const callbackUrl = `${origin}/api/auth/telegram/callback?returnTo=${encodeURIComponent(returnTo)}`;
  const query = [
    `bot_id=${encodeURIComponent(botId)}`,
    `origin=${encodeURIComponent(origin)}`,
    `return_to=${encodeURIComponent(callbackUrl)}`,
    'request_access=write'
  ].join('&');

  return `https://oauth.telegram.org/auth?${query}`;
}

function buildTelegramServerStartUrl(returnTo: string) {
  const origin = getApiOriginForAuth();
  const searchParams = new URLSearchParams({
    returnTo,
    mode: 'native',
    source: 'mobile',
    prefer: 'oauth'
  });
  return `${origin}/api/auth/telegram/start?${searchParams.toString()}`;
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const insets = useMobileInsets();

  return (
    <ImageBackground source={welcomeBackground} style={styles.welcomeScreen} imageStyle={styles.welcomeBackgroundImage}>
      <StatusBar translucent barStyle="light-content" backgroundColor="transparent" />
      <View style={[styles.welcomeOverlay, { paddingTop: insets.top + 34, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.welcomeCenter}>
          <Image source={welcomeLogo} resizeMode="contain" style={styles.welcomeLogo} />
          <Text style={styles.welcomeText}>наше приложение создано туристами для туристов</Text>
          <TouchableOpacity activeOpacity={0.88} onPress={onStart} style={styles.welcomeButton}>
            <Text style={styles.welcomeButtonText}>Войти</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.welcomePolicyText}>
          авторизуясь, вы соглашаетесь с{' '}
          <Text onPress={() => void openLegalPage('/terms')} style={styles.welcomePolicyLink}>
            пользовательским соглашением
          </Text>
          {' '}и{' '}
          <Text onPress={() => void openLegalPage('/privacy')} style={styles.welcomePolicyLink}>
            политикой конфиденциальности
          </Text>
        </Text>
      </View>
    </ImageBackground>
  );
}

function AuthSheet({
  visible,
  user,
  providers,
  notificationSettings,
  onClose,
  onLogout,
  onDeleteProfile,
  onTogglePromotionsNotifications
}: {
  visible: boolean;
  user: Record<string, unknown> | null;
  providers: NativeAuthProviders;
  notificationSettings: NotificationSettings;
  onClose: () => void;
  onLogout: () => void;
  onDeleteProfile: () => void;
  onTogglePromotionsNotifications: (enabled: boolean) => Promise<void>;
}) {
  const authReturnTo = 'danangguide:///auth';
  const displayName = toText(user?.displayName || user?.username || user?.email, 'Пользователь');
  const userEmail = toText(user?.email);
  const avatarUrl = getAuthUserAvatarUrl(user);
  const [openingProvider, setOpeningProvider] = useState<'google' | 'apple' | 'telegram' | null>(null);
  const [isNotificationBusy, setNotificationBusy] = useState(false);
  const providerEnabled = useCallback((provider: 'google' | 'apple' | 'telegram') => Boolean(providers?.[provider]), [providers]);
  const canAttemptProvider = useCallback((provider: 'google' | 'apple' | 'telegram') => (
    provider === 'apple' ? Boolean(API_BASE_URL) : providerEnabled(provider)
  ), [providerEnabled]);

  const openProvider = async (provider: 'google' | 'apple' | 'telegram') => {
    if (!API_BASE_URL) return;
    if (!canAttemptProvider(provider) || openingProvider) return;
    setOpeningProvider(provider);
    const authNonce = `${provider}-${Date.now().toString(36)}`;
    try {
      const authUrl = await fetchAuthStartUrl(provider, authReturnTo, authNonce);
      if (provider === 'telegram' && /accounts\.google\.com|google\.com\/o\/oauth|provider=google|auth\/google/i.test(authUrl)) {
        throw new Error('Сервер вернул Google-ссылку для кнопки Telegram. Нужно задеплоить свежий server на Railway и проверить TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_BOT_ID.');
      }
      onClose();
      await openExternalUrl(authUrl);
    } catch (error) {
      Alert.alert('Не удалось открыть вход', error instanceof Error ? error.message : 'Попробуйте ещё раз.');
    } finally {
      setOpeningProvider(null);
    }
  };

  const handleToggleNotifications = async () => {
    if (isNotificationBusy) return;
    setNotificationBusy(true);
    try {
      await onTogglePromotionsNotifications(!notificationSettings.promotionsEnabled);
    } finally {
      setNotificationBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.authModalBackdrop}>
        <TouchableOpacity style={styles.modalBackdropTouch} activeOpacity={1} onPress={onClose} />
        <ScrollView
          style={styles.authSheet}
          contentContainerStyle={styles.authSheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tipModalHandle} />
          <View style={styles.authSheetHeader}>
            <View>
              <Text style={styles.authSheetTitle}>{user ? 'Авторизованный профиль' : 'Войти в Danang Guide'}</Text>
              <Text style={styles.authSheetText}>{user ? 'Данные профиля используются для личных функций приложения.' : 'Авторизация нужна для избранного, объявлений и персональных функций.'}</Text>
            </View>
            <TouchableOpacity style={styles.authCloseButton} onPress={onClose}>
              <Text style={styles.authCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          {user ? (
            <>
              <View style={styles.profileBlock}>
                <View style={styles.profileAvatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.profileAvatarImage} />
                  ) : (
                    <Text style={styles.profileAvatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.profileName}>{displayName}</Text>
                  {userEmail ? <Text style={styles.profileEmail}>{userEmail}</Text> : null}
                </View>
                <TouchableOpacity activeOpacity={0.84} onPress={onLogout} style={styles.profileLogoutButton}>
                  <Text style={styles.profileLogoutText}>Выйти</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={isNotificationBusy}
                onPress={() => void handleToggleNotifications()}
                style={[styles.profileNotificationRow, isNotificationBusy && styles.authProviderButtonDisabled]}
              >
                <View style={styles.flex}>
                  <Text style={styles.profileNotificationTitle}>Уведомления об акциях</Text>
                  <Text style={styles.profileNotificationText}>Получайте уведомления о специальных предложениях заведений Danang Guide. Можно отключить в любой момент.</Text>
                </View>
                <View style={[styles.profileNotificationSwitch, notificationSettings.promotionsEnabled && styles.profileNotificationSwitchActive]}>
                  <View style={[styles.profileNotificationKnob, notificationSettings.promotionsEnabled && styles.profileNotificationKnobActive]} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.84} onPress={onDeleteProfile} style={styles.profileDeleteButton}>
                <Text style={styles.profileDeleteText}>Удалить данные профиля</Text>
              </TouchableOpacity>
              {legalBaseUrl ? (
                <View style={styles.authLegalLinks}>
                  <TouchableOpacity activeOpacity={0.82} onPress={() => void openLegalPage('/delete-profile')}>
                    <Text style={styles.authLegalLinkText}>Подробнее об удалении данных</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.82} onPress={() => void openLegalPage('/support')}>
                    <Text style={styles.authLegalLinkText}>Поддержка</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : (
            <>
              {!API_BASE_URL ? (
                <View style={styles.authNotice}>
                  <Text style={styles.authNoticeText}>Для входа нужно указать EXPO_PUBLIC_API_BASE_URL в mobile/.env.</Text>
                </View>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={!providerEnabled('google') || Boolean(openingProvider)}
                onPress={() => void openProvider('google')}
                style={[styles.authProviderButton, (!providerEnabled('google') || openingProvider === 'google') && styles.authProviderButtonDisabled]}
              >
                <Text style={styles.authProviderBrand}>G</Text>
                <View style={styles.flex}>
                  <Text style={styles.authProviderTitle}>Войти через Google</Text>
                  <Text style={styles.authProviderSub}>{providerEnabled('google') ? 'После входа приложение откроется обратно' : 'Google сейчас не настроен на сервере'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={!canAttemptProvider('apple') || Boolean(openingProvider)}
                onPress={() => void openProvider('apple')}
                style={[styles.authProviderButton, (!canAttemptProvider('apple') || openingProvider === 'apple') && styles.authProviderButtonDisabled]}
              >
                <Text style={styles.authProviderBrand}></Text>
                <View style={styles.flex}>
                  <Text style={styles.authProviderTitle}>Войти через Apple</Text>
                  <Text style={styles.authProviderSub}>После входа приложение откроется обратно</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={!providerEnabled('telegram') || Boolean(openingProvider)}
                onPress={() => void openProvider('telegram')}
                style={[styles.authProviderButton, (!providerEnabled('telegram') || openingProvider === 'telegram') && styles.authProviderButtonDisabled]}
              >
                <Text style={styles.authProviderBrand}>T</Text>
                <View style={styles.flex}>
                  <Text style={styles.authProviderTitle}>Войти через Telegram</Text>
                  <Text style={styles.authProviderSub}>{providerEnabled('telegram') ? 'Откроется Telegram-авторизация и возврат в приложение' : 'Telegram сейчас не настроен на сервере'}</Text>
                </View>
              </TouchableOpacity>
              {legalBaseUrl ? (
                <Text style={styles.authLegalText}>
                  Авторизуясь, вы соглашаетесь с{' '}
                  <Text onPress={() => void openLegalPage('/terms')} style={styles.authLegalTextLink}>Пользовательским соглашением</Text>
                  {' '}и{' '}
                  <Text onPress={() => void openLegalPage('/privacy')} style={styles.authLegalTextLink}>Политикой конфиденциальности</Text>.
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function DetailScreen({
  place,
  category,
  isFavorite,
  onToggleFavorite,
  authUser,
  onOpenAuth,
  onReportBulletin,
  onHideBulletinAuthor
}: {
  place: GuidePlace;
  category?: GuideCategory;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  authUser: Record<string, unknown> | null;
  onOpenAuth: () => void;
  onReportBulletin: (place: GuidePlace) => void;
  onHideBulletinAuthor: (place: GuidePlace) => void;
}) {
  const mobileInsets = useMobileInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const gallery = getPlaceImageUrls(place);
  const [fullscreenImage, setFullscreenImage] = useState('');
  const [isVerificationOpen, setVerificationOpen] = useState(false);
  const detailImageWidth = Math.max(280, viewportWidth - 28);
  const details = Array.from(new Set([...toTextArray((place as GuidePlace & { extra?: unknown }).extra), ...toTextArray((place as GuidePlace & { services?: unknown }).services)]));
  const tags = toTextArray((place as GuidePlace & { tags?: unknown }).tags);
  const description = toText(place.description || place.shortDescription, 'Описание пока не заполнено.');
  const title = toText(place.title, 'Место');
  const categoryLabel = toText(category?.title || place.kind || place.categoryId, 'Раздел');
  const phone = toText(place.phoneNumber || place.phone);
  const website = toText(place.websiteUrl || place.website);
  const address = toText(place.address || place.location);
  const hours = toText(place.hours);
  const price = toText(place.priceLabel);
  const cuisine = toText(place.cuisine);
  const district = toText(place.district);
  const hasMapPoint = Boolean(placeCoordinate(place));
  const hasInfoFields = Boolean(address || hours || phone);
  const qualityBadgeText = toText(place.qualityBadgeText, 'привет,молодцы что посмотрели');
  const isBulletin = place.categoryId === 'bulletin-board';
  const isOwnBulletin = Boolean(authUser?.id && place.createdByUserId && String(authUser.id) === String(place.createdByUserId));

  return (
    <ScrollView
      style={styles.content}
      contentContainerStyle={[
        styles.detailContentInner,
        { paddingTop: mobileInsets.top + 14, paddingBottom: 28 + mobileInsets.bottom }
      ]}
      showsVerticalScrollIndicator={false}
    >
      {gallery.length > 0 ? (
        <View style={styles.detailGalleryWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.detailGallery}
          >
            {gallery.map((imageUrl, index) => (
              <TouchableOpacity key={`${imageUrl}-${index}`} activeOpacity={0.92} onPress={() => setFullscreenImage(imageUrl)}>
                <Image source={{ uri: imageUrl }} style={[styles.detailImage, { width: detailImageWidth }]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {gallery.length > 1 ? <Text style={styles.detailImageCount}>{gallery.length} фото</Text> : null}
        </View>
      ) : <View style={[styles.detailImage, styles.detailImageFallback]} />}

      <View style={styles.detailPlainHeader}>
        <View style={styles.detailTitleRow}>
          <View style={styles.flex}>
            <Text style={styles.detailSubtitle}>{categoryLabel}</Text>
            <Text style={styles.detailTitle}>{title}</Text>
          </View>
          {place.qualityBadge ? (
            <TouchableOpacity activeOpacity={0.82} onPress={() => setVerificationOpen(true)} style={styles.detailVerificationButton}>
              <Image source={placeVerificationBadge} resizeMode="contain" style={styles.detailVerificationImage} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity activeOpacity={0.8} onPress={onToggleFavorite} style={styles.detailFavorite}>
            <Text style={styles.detailFavoriteText}>{isFavorite ? '♥' : '♡'}</Text>
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

      {hasInfoFields ? (
        <View style={styles.detailInfoList}>
          {address ? <InfoBlock title="Адрес" value={address} /> : null}
          {hours ? <InfoBlock title="Время работы" value={hours} /> : null}
          {phone ? <InfoBlock title="Телефон" value={phone} onPress={() => {
            const contactUrl = contactUrlFromText(phone);
            if (contactUrl) void openExternalUrl(contactUrl);
          }} /> : null}
        </View>
      ) : null}

      <View style={styles.actionsGrid}>
        <AppButton label="Маршрут" onPress={() => void openExternalUrl(directionsUrl(place))} />
        {website ? <AppButton label="Сайт" variant="ghost" onPress={() => void openExternalUrl(website)} /> : null}
      </View>

      {isBulletin && !isOwnBulletin ? (
        <View style={styles.bulletinSafetyActions}>
          <TouchableOpacity activeOpacity={0.84} onPress={authUser ? () => onReportBulletin(place) : onOpenAuth} style={styles.bulletinSafetyButton}>
            <Text style={styles.bulletinSafetyText}>Пожаловаться</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.84} onPress={authUser ? () => onHideBulletinAuthor(place) : onOpenAuth} style={styles.bulletinSafetyButton}>
            <Text style={styles.bulletinSafetyText}>Скрыть автора</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
          <InlineErrorBoundary
            fallback={(
              <View style={styles.detailMapFallback}>
                <Text style={styles.detailMapFallbackTitle}>Карта временно недоступна</Text>
                <Text style={styles.detailMapFallbackText}>Карточка открыта, а маршрут можно построить кнопкой выше.</Text>
              </View>
            )}
          >
            <GuideMap places={[place]} height={250} />
          </InlineErrorBoundary>
        </View>
      ) : null}
      <Modal visible={isVerificationOpen && Boolean(place.qualityBadge)} transparent animationType="fade" onRequestClose={() => setVerificationOpen(false)}>
        <View style={styles.verificationModalBackdrop}>
          <View style={styles.verificationModalCard}>
            <Image source={placeVerificationBadge} resizeMode="contain" style={styles.verificationModalImage} />
            <Text style={styles.verificationModalTitle}>Проверка места</Text>
            <Text style={styles.verificationModalText}>{qualityBadgeText}</Text>
            <TouchableOpacity activeOpacity={0.86} onPress={() => setVerificationOpen(false)} style={styles.verificationModalButton}>
              <Text style={styles.verificationModalButtonText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <FullscreenImageModal imageUrl={fullscreenImage} onClose={() => setFullscreenImage('')} />
    </ScrollView>
  );
}

function InfoBlock({ title, value, onPress }: { title: string; value: string; onPress?: () => void }) {
  const content = (
    <>
      <Text style={styles.infoLabel}>{title}</Text>
      <Text style={[styles.infoValue, onPress && styles.infoValueLink]}>{value}</Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.infoBlock}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.infoBlock}>
      {content}
    </View>
  );
}

function FullscreenImageModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    <Modal visible={Boolean(imageUrl)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fullscreenImageBackdrop}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.fullscreenImageCloseArea}>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.fullscreenImage} resizeMode="contain" /> : null}
          <View style={styles.fullscreenImageCloseButton}>
            <Text style={styles.fullscreenImageCloseText}>×</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
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

function BottomTabs({ active, onChange, bottomInset }: { active: TabKey; onChange: (tab: TabKey) => void; bottomInset: number }) {
  return (
    <View style={[styles.bottomTabs, { paddingBottom: bottomInset + 8 }]}>
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
  homeHero: { width: '100%', minWidth: '100%', alignSelf: 'stretch', height: Platform.OS === 'android' ? 150 + ANDROID_STATUS_BAR_INSET : 150, paddingTop: ANDROID_STATUS_BAR_INSET, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: '#1c65a0' },
  homeHeroImage: { resizeMode: 'cover' },
  homeHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 18, 38, 0.08)' },
  homeUtilityDot: { position: 'absolute', right: 18, top: 6, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroAuthButton: { position: 'absolute', right: 14, top: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 10 : 12, zIndex: 4, width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8, 18, 37, 0.36)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  heroAuthAvatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)' },
  heroAuthIcon: { color: '#ffffff', fontSize: 20, lineHeight: 23, fontWeight: '900' },
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
  welcomeScreen: { flex: 1, width: '100%', backgroundColor: '#156db2' },
  welcomeBackgroundImage: { resizeMode: 'cover' },
  welcomeOverlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 22, backgroundColor: 'rgba(8, 24, 48, 0.18)' },
  welcomeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  welcomeLogo: { width: 190, height: 190 },
  welcomeText: { maxWidth: 310, color: '#ffffff', fontSize: 21, lineHeight: 28, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.36)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  welcomeButton: { width: '100%', minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', shadowColor: '#102a43', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 7 },
  welcomeButtonText: { color: '#102a43', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  welcomePolicyText: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  welcomePolicyLink: { color: '#ffffff', fontWeight: '900', textDecorationLine: 'underline' },

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
  legalLinksCard: { padding: 14, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', gap: 4 },
  legalLinksTitle: { color: '#102a43', fontSize: 15, lineHeight: 19, fontWeight: '900', marginBottom: 4 },
  legalLinkRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  legalLinkText: { color: '#1f63c7', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  legalLinkArrow: { color: '#8a9aae', fontSize: 22, lineHeight: 24, fontWeight: '700' },

  detailContentInner: { paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 14 : 14, paddingBottom: 28 + ANDROID_NAVIGATION_BAR_INSET, backgroundColor: '#ffffff', gap: 14 },
  detailGalleryWrap: { width: '100%', height: 270, borderRadius: 28, overflow: 'hidden', backgroundColor: '#dce8f4' },
  detailGallery: { width: '100%', height: 270 },
  detailImage: { width: '100%', height: 270, borderRadius: 28, backgroundColor: '#dce8f4' },
  detailImageCount: { position: 'absolute', right: 14, bottom: 14, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(9, 19, 38, 0.62)', color: '#ffffff', fontSize: 12, fontWeight: '900' },
  detailImageFallback: { backgroundColor: '#d7e6f5' },
  detailCard: { padding: 18, borderRadius: 26, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e0ea', gap: 10 },
  detailPlainHeader: { gap: 12, paddingHorizontal: 2, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  detailPlainSection: { gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  detailMapSection: { gap: 10, paddingTop: 2, paddingBottom: 4 },
  detailMapFallback: { minHeight: 128, borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: '#f3f7ff', borderWidth: 1, borderColor: '#d8e4f2' },
  detailMapFallbackTitle: { color: '#102a43', fontSize: 15, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
  detailMapFallbackText: { color: '#60718a', fontSize: 12.5, lineHeight: 18, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  fullscreenImageBackdrop: { flex: 1, backgroundColor: 'rgba(2, 8, 23, 0.94)' },
  fullscreenImageCloseArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  fullscreenImage: { width: '100%', height: '86%' },
  fullscreenImageCloseButton: { position: 'absolute', top: 44, right: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImageCloseText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '600' },
  detailInfoList: { borderTopWidth: 1, borderTopColor: 'rgba(214, 223, 235, 0.92)' },
  detailTitleRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  detailTitle: { color: '#102a43', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 5 },
  detailSubtitle: { color: '#53739b', fontSize: 15, fontWeight: '800', marginTop: 6 },
  detailVerificationButton: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#fff7e5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f2d58a' },
  detailVerificationImage: { width: 38, height: 38 },
  detailFavorite: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#f1f5fa', alignItems: 'center', justifyContent: 'center' },
  detailFavoriteText: { color: '#2f78d6', fontSize: 24, lineHeight: 26, fontWeight: '900' },
  detailPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  detailText: { color: '#486581', fontSize: 16, lineHeight: 24 },
  infoBlock: { paddingVertical: 13, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)', gap: 4 },
  infoLabel: { color: '#53739b', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { color: '#102a43', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  infoValueLink: { color: '#1f63c7' },
  actionsGrid: { gap: 10 },
  bulletinSafetyActions: { flexDirection: 'row', gap: 8 },
  bulletinSafetyButton: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 10 },
  bulletinSafetyText: { color: '#9a3412', fontSize: 12.5, lineHeight: 16, fontWeight: '900' },
  verificationModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(9, 19, 38, 0.42)' },
  verificationModalCard: { width: '100%', maxWidth: 340, borderRadius: 24, backgroundColor: '#ffffff', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 },
  verificationModalImage: { width: 88, height: 88 },
  verificationModalTitle: { color: '#102a43', fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  verificationModalText: { color: '#53657c', fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  verificationModalButton: { minHeight: 46, borderRadius: 15, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, marginTop: 18 },
  verificationModalButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  bulletText: { color: '#486581', fontSize: 15, lineHeight: 22 },
  nearbyCardWrap: { gap: 8 },
  nearbyBadge: { alignSelf: 'flex-start', marginLeft: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#102a43' },
  nearbyText: { color: '#fff', fontWeight: '800' },
  nativeMapCard: { width: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: '#e8f1f8', borderWidth: 1, borderColor: '#d8e0ea', justifyContent: 'center' },
  nativeMap: { ...StyleSheet.absoluteFillObject },
  nativeStaticMapLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#dfeaf2' },
  nativeStaticMapTile: { position: 'absolute', width: staticMapTileSize, height: staticMapTileSize, backgroundColor: '#dfeaf2' },
  nativePlaceMarker: { position: 'absolute', width: 26, height: 34, alignItems: 'center', justifyContent: 'center' },
  nativePlaceMarkerText: { color: '#e05a3f', fontSize: 31, lineHeight: 32, textShadowColor: 'rgba(255,255,255,0.95)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  nativeRouteMarker: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#1f63c7', borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  nativeRouteMarkerText: { color: '#ffffff', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  nativeMapAttribution: { position: 'absolute', left: 8, bottom: 8, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 7, paddingVertical: 4 },
  nativeMapAttributionText: { color: '#50627a', fontSize: 9, lineHeight: 11, fontWeight: '800' },
  nativeMapEmptyTitle: { color: '#162640', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  nativeMapEmptyText: { color: '#60718a', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center', marginTop: 6, paddingHorizontal: 18 },
  nativeMapPopup: { position: 'absolute', left: 12, right: 12, bottom: 12, minHeight: 58, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#12213a', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  nativeMapPopupTitle: { color: '#162640', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  nativeMapPopupText: { color: '#60718a', fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  nativeMapPopupButton: { minHeight: 36, borderRadius: 12, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  nativeMapPopupButtonText: { color: '#ffffff', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  nearbyMapFallbackCard: { minHeight: 178 },
  nearbyMapCount: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', backgroundColor: '#e8f1ff', color: '#1f63c7', fontSize: 12, lineHeight: 15, fontWeight: '900' },

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
  restaurantCardImageSlide: { width: 118, height: 94, justifyContent: 'flex-end' },
  restaurantCardImageFallback: { backgroundColor: '#dce8f4' },
  restaurantCardImageReal: { borderRadius: 16 },
  restaurantCardImageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7, 17, 34, 0.30)' },
  restaurantCardImageTitle: { position: 'absolute', left: 7, right: 7, bottom: 7, color: '#ffffff', fontSize: 11, lineHeight: 13, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  restaurantCardImageCount: { position: 'absolute', left: 6, top: 5, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(9, 19, 38, 0.58)', color: '#ffffff', fontSize: 9.5, fontWeight: '900' },
  restaurantCardSavedMark: { position: 'absolute', right: 6, top: 5, color: '#ffffff', fontSize: 13, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  restaurantCardBody: { flex: 1, minWidth: 0, maxWidth: '100%', justifyContent: 'center', gap: 4, paddingTop: 0, paddingRight: 2, overflow: 'hidden' },
  restaurantCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  restaurantCardQualityBadge: { width: 22, height: 22, flexShrink: 0 },
  restaurantCardTitle: { flex: 1, minWidth: 0, color: '#162640', fontSize: 14.2, lineHeight: 17, fontWeight: '900', letterSpacing: -0.2 },
  restaurantCardSubtitle: { color: '#60718a', fontSize: 11.8, lineHeight: 15, fontWeight: '500' },
  restaurantFacts: { gap: 4, marginTop: 3 },
  restaurantFactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restaurantFactText: { flex: 1, minWidth: 0, color: '#24364f', fontSize: 11.6, lineHeight: 16, fontWeight: '800' },
  restaurantClockIcon: { width: 17, height: 17, borderRadius: 8.5, borderWidth: 1.8, borderColor: '#2b78dd', flexShrink: 0, position: 'relative' },
  restaurantClockHourHand: { position: 'absolute', left: 7.2, top: 3.6, width: 1.8, height: 5.4, borderRadius: 1, backgroundColor: '#2b78dd' },
  restaurantClockMinuteHand: { position: 'absolute', left: 7.2, top: 7.1, width: 5.5, height: 1.8, borderRadius: 1, backgroundColor: '#2b78dd' },
  restaurantCuisineIcon: { width: 20, height: 18, flexShrink: 0, position: 'relative' },
  restaurantCuisinePlate: { position: 'absolute', left: 2, top: 3, width: 12, height: 12, borderRadius: 6, borderWidth: 1.8, borderColor: '#ef8b32' },
  restaurantCuisineForkHandle: { position: 'absolute', right: 2, top: 3, width: 1.9, height: 13, borderRadius: 1, backgroundColor: '#ef8b32' },
  restaurantCuisineForkTine: { position: 'absolute', right: 5, top: 3, width: 1.6, height: 5, borderRadius: 1, backgroundColor: '#ef8b32' },
  restaurantCuisineForkTineRight: { right: 0.2 },
  restaurantTypeIcon: { width: 18, height: 18, borderRadius: 7, borderWidth: 1.8, borderColor: '#6a7d95', flexShrink: 0, position: 'relative' },
  restaurantTypeIconDot: { position: 'absolute', left: 4, top: 4, width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#6a7d95' },
  restaurantTypeIconLine: { position: 'absolute', left: 4, right: 4, bottom: 4, height: 1.8, borderRadius: 1, backgroundColor: '#6a7d95' },
  restaurantDollarIcon: { width: 18, color: '#22a06b', fontSize: 18, lineHeight: 19, fontWeight: '900', textAlign: 'center', flexShrink: 0 },

  bulletinContentInner: { paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 18 : 18 },
  bulletinToolbar: { alignItems: 'center' },
  bulletinSearchBar: { flex: 1, minHeight: 42, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(214, 223, 235, 0.94)', backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  bulletinSearchIcon: { color: '#6e7f97', fontSize: 16, fontWeight: '900' },
  bulletinSearchInput: { flex: 1, minHeight: 40, color: '#162640', fontSize: 13, fontWeight: '700', padding: 0 },
  bulletinClearButton: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf3fb' },
  bulletinClearText: { color: '#50627a', fontSize: 20, lineHeight: 22, fontWeight: '800' },
  bulletinPostButton: { minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', marginTop: 2 },
  bulletinPostText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  myBulletinsBlock: { gap: 8, padding: 12, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe7f1' },
  myBulletinsTitle: { color: '#102a43', fontSize: 15, fontWeight: '900' },
  myBulletinCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#edf3fb' },
  myBulletinTitle: { color: '#102a43', fontSize: 14, fontWeight: '800' },
  myBulletinStatus: { color: '#53739b', fontSize: 12, fontWeight: '800', marginTop: 2 },
  myBulletinNote: { color: '#8f1d1d', fontSize: 12, lineHeight: 16, marginTop: 4 },
  myBulletinDeleteButton: { minHeight: 34, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#ffd1d1' },
  myBulletinDeleteText: { color: '#8f1d1d', fontSize: 12, fontWeight: '900' },
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
  bulletinPostSheet: { maxHeight: '82%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#f8fbff' },
  bulletinPostSheetContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 18 + ANDROID_NAVIGATION_BAR_INSET, gap: 10 },
  bulletinPostInput: { minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: '#d8e0ea', backgroundColor: '#ffffff', paddingHorizontal: 13, color: '#162640', fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  bulletinPostInputMultiline: { minHeight: 104, paddingTop: 12, paddingBottom: 12 },
  bulletinPhotoHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bulletinPhotoTitle: { color: '#162640', fontSize: 15, fontWeight: '900' },
  bulletinAddPhotoButton: { minHeight: 34, borderRadius: 13, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  bulletinAddPhotoText: { color: '#1f63c7', fontSize: 12, fontWeight: '900' },
  bulletinPhotoRow: { gap: 8, paddingRight: 6 },
  bulletinPhotoThumbWrap: { width: 84, height: 84, borderRadius: 16, overflow: 'hidden', backgroundColor: '#dce8f4' },
  bulletinPhotoThumb: { width: '100%', height: '100%' },
  bulletinRemovePhotoButton: { position: 'absolute', right: 5, top: 5, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9, 19, 38, 0.70)' },
  bulletinRemovePhotoText: { color: '#ffffff', fontSize: 18, lineHeight: 20, fontWeight: '900' },

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
  authSheet: { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#f8fbff' },
  authSheetContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 18 + ANDROID_NAVIGATION_BAR_INSET, gap: 10 },
  authSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 4 },
  authSheetTitle: { color: '#102a43', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  authSheetText: { color: '#5e7088', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 5, maxWidth: 270 },
  authCloseButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  authCloseText: { color: '#102a43', fontSize: 24, lineHeight: 26, fontWeight: '700' },
  authNotice: { padding: 12, borderRadius: 16, backgroundColor: '#fff8e7', borderWidth: 1, borderColor: '#f0dfb8' },
  authNoticeText: { color: '#80611c', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  authProviderButton: { minHeight: 62, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e0e8f2' },
  authProviderButtonDisabled: { opacity: 0.48 },
  authProviderBrand: { width: 38, height: 38, borderRadius: 14, overflow: 'hidden', backgroundColor: '#edf4ff', color: '#1f63c7', textAlign: 'center', textAlignVertical: 'center', fontSize: 17, lineHeight: 38, fontWeight: '900' },
  authProviderTitle: { color: '#102a43', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  authProviderSub: { color: '#718096', fontSize: 11.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  authLegalText: { color: '#718096', fontSize: 11.5, lineHeight: 17, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
  authLegalTextLink: { color: '#1f63c7', fontWeight: '900', textDecorationLine: 'underline' },
  authLegalLinks: { paddingHorizontal: 4, gap: 8 },
  authLegalLinkText: { color: '#1f63c7', fontSize: 12.5, lineHeight: 17, fontWeight: '900', textDecorationLine: 'underline' },
  profileBlock: { minHeight: 76, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e0e8f2', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  profileAvatar: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', overflow: 'hidden' },
  profileAvatarImage: { width: 46, height: 46 },
  profileAvatarText: { color: '#ffffff', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  profileName: { color: '#102a43', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  profileEmail: { color: '#718096', fontSize: 11.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  profileLogoutButton: { minHeight: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5fa', paddingHorizontal: 12 },
  profileLogoutText: { color: '#1f63c7', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  profileNotificationRow: { minHeight: 82, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e0e8f2', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  profileNotificationTitle: { color: '#102a43', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  profileNotificationText: { color: '#718096', fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  profileNotificationSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#d8e0ea', padding: 3, justifyContent: 'center' },
  profileNotificationSwitchActive: { backgroundColor: '#1f63c7' },
  profileNotificationKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff' },
  profileNotificationKnobActive: { transform: [{ translateX: 20 }] },
  profileDeleteButton: { minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#ffd1d1', paddingHorizontal: 12 },
  profileDeleteText: { color: '#8f1d1d', fontSize: 12.5, lineHeight: 16, fontWeight: '900' },

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
