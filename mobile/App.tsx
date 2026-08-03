import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
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
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { BootstrapPayload, GuideCategory, GuideCollection, GuidePlace, GuideTip, SupportContentStore } from './src/types';
import { fetchBootstrap, fetchSupportContent, fetchAuthSession, fetchAuthStartUrl, logoutAuthSession, deleteAuthProfile, reportBulletin, fetchHiddenAuthors, hideBulletinAuthor, API_BASE_URL, sendAnalytics, submitBulletinListing, fetchMyBulletinListings, deleteMyBulletinListing, getNotificationSettings, registerPushToken, updateNotificationSettings, type NotificationSettings } from './src/api/client';
import { directionsUrl, openExternalUrl } from './src/utils/links';
import {
  fetchRoute,
  fetchWalkingRoute,
  formatDistanceMeters,
  formatDurationShort,
  formatRouteShort,
  formatRouteSummary,
  travelModeWord,
  type LatLng,
  type RouteStep,
  type TravelMode,
  type WalkingRoute
} from './src/utils/directions';
import { GUIDE_MAP_STYLE, MAP_BG_COLOR } from './src/utils/mapStyle';
import { buildClusterIndex, getClusterNodes, regionForZoom } from './src/utils/clustering';
import { estimateTravelTime, formatDistance, hasCoordinates, haversineDistanceKm } from './src/utils/geo';
import { loadFavoriteSlugs, saveFavoriteSlugs } from './src/utils/favorites';
import { clearAuthToken, getAuthUserAvatarUrl, getCachedAuthUser, readUserFromAuthToken, saveAuthToken } from './src/utils/auth';
import { EmptyState, AppButton, CategoryCard, ListingCard, LoadingState, Pill } from './src/components/ui';
import { normalizeImageUrl } from './src/utils/normalizers';
import { appLogo, categoryIcons, defaultCategoryIcon, homeHeaderImage, placeVerificationBadge, welcomeBackground } from './src/assets';

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

function isPushTokenRegistrationEnabled() {
  const extra = Constants.expoConfig?.extra as { pushNotificationsEnabled?: boolean | string } | undefined;
  return extra?.pushNotificationsEnabled === true || String(extra?.pushNotificationsEnabled || '').toLowerCase() === 'true';
}

function notificationPlatform(): 'ios' | 'android' | 'unknown' {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return 'unknown';
}

async function getPromotionPushToken() {
  if (Platform.OS === 'web') {
    throw new Error('Push-уведомления доступны только в мобильном приложении.');
  }

  if (!isPushTokenRegistrationEnabled()) {
    throw new Error('Push-уведомления пока не подключены в этой APK-сборке. Нужно настроить Firebase/FCM, добавить google-services.json и включить EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=true перед сборкой.');
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
    if (/network request failed|network|failed to fetch|java\.net|timeout|unable to resolve host/i.test(message)) {
      throw new Error('Не удалось получить push-токен из-за сетевой ошибки. Проверьте интернет на телефоне и настройки Firebase/FCM для этой APK-сборки.');
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


function buildMapRegion(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length === 0) {
    // Центр Дананга по умолчанию.
    return { latitude: 16.0678, longitude: 108.2208, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }

  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.4)
  };
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

function googleMapsRouteUrl(route: NativeRoute) {
  const origin = route.points[0];
  const destination = route.points[route.points.length - 1];
  const waypoints = route.points
    .slice(1, -1)
    .map((point) => `${point.lat},${point.lng}`)
    .join('|');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=walking`;
  return waypoints ? `${base}&waypoints=${encodeURIComponent(waypoints)}` : base;
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
  const [contentSource, setContentSource] = useState<'network' | 'cache' | 'default'>('network');
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

  // Android hardware Back walks our route history instead of minimizing the app.
  // Modals (fullscreen map, auth sheet…) handle their own back via onRequestClose,
  // which Android dispatches before this listener — no conflict.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (routeHistoryRef.current.length > 0 || fallbackBackRoute(routeRef.current)) {
        goBack();
        return true;
      }
      return false; // at the home root — let the system minimize
    });
    return () => subscription.remove();
  }, [goBack]);

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
    const [bootstrapResult, nextSupport, savedFavorites, authSession, cachedAuthUser, nextHiddenAuthorIds, nextNotificationSettings] = await Promise.all([
      fetchBootstrap(),
      fetchSupportContent(),
      loadFavoriteSlugs(),
      fetchAuthSession(),
      getCachedAuthUser(),
      fetchHiddenAuthors(),
      getNotificationSettings()
    ]);
    setPayload(bootstrapResult.payload);
    setContentSource(bootstrapResult.source);
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
  const hideTopHeader = isHomeRoot || route.name === 'category' || route.name === 'routes' || route.name === 'routeDetail' || route.name === 'programs' || route.name === 'tips' || route.name === 'detail';

  return (
    <View style={styles.safeArea} {...backSwipeResponder.panHandlers}>
      <MapWarmup />
      <StatusBar translucent barStyle={route.name === 'detail' ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
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

      {contentSource !== 'network' ? (
        <View style={[styles.offlineBanner, hideTopHeader ? { paddingTop: mobileInsets.top + 6 } : null]}>
          <Text style={styles.offlineBannerText}>
            {contentSource === 'cache'
              ? 'Нет соединения — показаны сохранённые данные'
              : 'Нет соединения — показан демо-контент'}
          </Text>
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
          onBack={goBack}
          allPlaces={listings}
          onOpenPlace={(nextPlace) => setRoute({ name: 'detail', slug: nextPlace.slug || nextPlace.id })}
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
  const { top: topInset } = useSafeAreaInsets();
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
      <View style={[styles.homeHero, { width: viewportWidth, height: 150 + topInset }]}>
        <ImageBackground source={homeHeaderImage} style={styles.full} imageStyle={styles.homeHeroImage}>
          <View style={styles.homeHeroOverlay} />
        </ImageBackground>
        <TouchableOpacity activeOpacity={0.86} onPress={onOpenAuth} style={[styles.heroAuthButton, { top: topInset + 8 }]}>
          {heroAvatarUrl ? (
            <Image source={{ uri: heroAvatarUrl }} style={styles.heroAuthAvatar} />
          ) : authUser ? (
            <Text style={styles.heroAuthIcon}>{toText(authUser.displayName || authUser.username || authUser.email, 'П').slice(0, 1).toUpperCase()}</Text>
          ) : (
            <Text style={styles.heroAuthIcon}>👤</Text>
          )}
        </TouchableOpacity>
      </View>

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
              {loopedBanners.map((banner, index) => {
                const bannerSource = bannerImageSource(banner);
                return (
                  <TouchableOpacity
                    key={`${banner.id}-${index}`}
                    activeOpacity={0.9}
                    onPress={() => openBannerLink(banner)}
                    style={[styles.homeBanner, styles.homeBannerSlide, { width: bannerCardWidth }]}
                  >
                    {bannerSource ? (
                      <ImageBackground source={bannerSource} style={styles.full} imageStyle={styles.homeBannerImage}>
                        <View style={styles.bannerOverlay} />
                      </ImageBackground>
                    ) : (
                      <View style={[styles.full, styles.homeBannerFallback]}>
                        <View style={styles.bannerOverlay} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
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
                <View style={styles.tipThumbPlaceholder}><Text style={styles.tipThumbGlyph}>i</Text></View>
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
  return image ? { uri: image } : null;
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
  const { height: viewportHeight } = useWindowDimensions();
  const [selectedQuickTokens, setSelectedQuickTokens] = useState<string[]>([]);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [isMapOpen, setMapOpen] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [activeTab, setActiveTab] = useState<'open' | 'near' | 'verified' | null>('open');
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
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

  // Тихо берём позицию, если доступ уже выдан — тогда в строках появляется «N м · M мин пешком»
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const point = { lat: current.coords.latitude, lng: current.coords.longitude };
        if (Math.abs(point.lat) < 0.5 && Math.abs(point.lng) < 0.5) return;
        setUserPosition(point);
      } catch {
        // без позиции просто не показываем расстояния
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestPosition = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { lat: current.coords.latitude, lng: current.coords.longitude };
      if (Math.abs(point.lat) < 0.5 && Math.abs(point.lng) < 0.5) return;
      setUserPosition(point);
    } catch {
      // отказ или сбой GPS — сортировка «Рядом» останется недоступной
    }
  }, []);

  // Чипы кухонь — из реальных данных карточек этой категории
  const cuisineOptions = useMemo(() => {
    const seen = new Map<string, string>();
    publishedListings.forEach((item) => {
      const value = toText(item.cuisine).trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (!seen.has(key)) seen.set(key, value);
    });
    return Array.from(seen.values()).slice(0, 12);
  }, [publishedListings]);

  const cuisineFiltered = useMemo(
    () => selectedCuisine
      ? filteredListings.filter((item) => toText(item.cuisine).trim().toLowerCase() === selectedCuisine.toLowerCase())
      : filteredListings,
    [filteredListings, selectedCuisine]
  );

  const listingsWithDistance = useMemo(() => {
    if (!userPosition) return cuisineFiltered;
    return cuisineFiltered.map((item) => {
      const coordinate = placeCoordinate(item);
      return coordinate
        ? { ...item, distanceKm: haversineDistanceKm(userPosition, { lat: coordinate.latitude, lng: coordinate.longitude }) }
        : item;
    });
  }, [cuisineFiltered, userPosition]);

  const visibleListings = useMemo(() => {
    if (activeTab === 'open') {
      // Лояльный фильтр: места с нечитаемыми часами не прячем
      return listingsWithDistance.filter((item) => isOpenNow(item.hours) !== false);
    }
    if (activeTab === 'verified') {
      return listingsWithDistance.filter((item) => Boolean(item.qualityBadge));
    }
    if (activeTab === 'near') {
      return [...listingsWithDistance].sort((a, b) => {
        const aKm = Number((a as GuidePlace & { distanceKm?: unknown }).distanceKm);
        const bKm = Number((b as GuidePlace & { distanceKm?: unknown }).distanceKm);
        return (Number.isFinite(aKm) ? aKm : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bKm) ? bKm : Number.MAX_SAFE_INTEGER);
      });
    }
    return listingsWithDistance;
  }, [listingsWithDistance, activeTab]);

  const mappablePlaces = useMemo(() => visibleListings.filter((item) => Boolean(placeCoordinate(item))), [visibleListings]);

  // На карту точку «вы здесь» добавляем только рядом с Данангом — далёкая точка
  // растянула бы регион карты до масштаба страны и схлопнула все пины в один
  const nearbyUserPoint = useMemo<LatLng | null>(() => {
    if (!userPosition) return null;
    const kmFromDanang = haversineDistanceKm(userPosition, {
      lat: DANANG_DEMO_ORIGIN.latitude,
      lng: DANANG_DEMO_ORIGIN.longitude
    });
    return kmFromDanang <= 50 ? { latitude: userPosition.lat, longitude: userPosition.lng } : null;
  }, [userPosition]);

  const handleTabPress = useCallback((tab: 'open' | 'near' | 'verified') => {
    if (tab === 'near' && !userPosition) {
      void requestPosition();
    }
    setActiveTab((current) => (current === tab ? null : tab));
  }, [userPosition, requestPosition]);

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
      <View style={styles.categoryHeaderRow}>
        <TouchableOpacity activeOpacity={0.82} onPress={onBack} style={styles.categoryBackPill}>
          <Text style={styles.categoryBackPillText}>‹ Назад</Text>
        </TouchableOpacity>
        <Text style={styles.categoryHeaderTitle} numberOfLines={1}>{category.title}</Text>
        <TouchableOpacity activeOpacity={0.78} onPress={() => setFilterOpen(true)} style={styles.categoryHeaderCircle}>
          <Text style={styles.categoryFilterIcon}>☰</Text>
          {selectedQuickTokens.length > 0 ? (
            <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{selectedQuickTokens.length}</Text></View>
          ) : null}
        </TouchableOpacity>
      </View>

      {cuisineOptions.length >= 2 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cuisineChipsScroll}
          contentContainerStyle={styles.cuisineChipsRow}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSelectedCuisine('')}
            style={[styles.cuisineChip, !selectedCuisine && styles.cuisineChipActive]}
          >
            <Text style={[styles.cuisineChipText, !selectedCuisine && styles.cuisineChipTextActive]}>
              {category.id === 'restaurants' ? 'Все кухни' : 'Все'}
            </Text>
          </TouchableOpacity>
          {cuisineOptions.map((option) => {
            const isActive = selectedCuisine.toLowerCase() === option.toLowerCase();
            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.8}
                onPress={() => setSelectedCuisine(isActive ? '' : option)}
                style={[styles.cuisineChip, isActive && styles.cuisineChipActive]}
              >
                <Text style={[styles.cuisineChipText, isActive && styles.cuisineChipTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.categoryTabsRow}>
        {([
          { key: 'open' as const, label: 'Открыто сейчас' },
          { key: 'near' as const, label: 'Рядом' },
          { key: 'verified' as const, label: 'Проверено' }
        ]).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.8}
              onPress={() => handleTabPress(tab.key)}
              style={[styles.categoryTab, isActive && styles.categoryTabActive]}
            >
              <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {activeTab === 'near' && !userPosition ? (
        <Text style={styles.categoryLocateNote}>Разрешите доступ к геолокации, чтобы сортировать места по расстоянию.</Text>
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
        data={visibleListings}
        keyExtractor={(item) => item.id}
        renderItem={renderListing}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          publishedListings.length > 0 ? (
            <EmptyState
              title="Ничего не нашлось"
              text={activeTab === 'open'
                ? 'Сейчас всё закрыто или скрыто фильтрами. Нажмите «Открыто сейчас» ещё раз, чтобы показать все места.'
                : 'По выбранным фильтрам мест нет. Сбросьте фильтры или выберите другую кухню.'}
            />
          ) : (
            <EmptyState title="Пока пусто" text="В этом разделе нет опубликованных карточек." />
          )
        }
        style={[styles.content, styles.categoryContent]}
        contentContainerStyle={[
          styles.categoryContentInner,
          // Запас под таб-бар + плавающую пилюлю «Показать на карте»
          { paddingTop: mobileInsets.top + 14, paddingBottom: 74 + mobileInsets.bottom + 76 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      />
      {mappablePlaces.length > 0 ? (
        // 74 = высота таб-бара без инсета (paddingTop 6 + minHeight 60 + paddingBottom 8) — пилюля висит НАД ним
        <View pointerEvents="box-none" style={[styles.categoryMapFloatWrap, { bottom: 74 + mobileInsets.bottom + 14 }]}>
          <TouchableOpacity activeOpacity={0.88} onPress={() => setMapOpen(true)} style={styles.categoryMapFloatButton}>
            <PinIcon size={15} color="#ffffff" strokeWidth={2} />
            <Text style={styles.categoryMapFloatText}>Показать на карте</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <Modal
        visible={isMapOpen}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setMapOpen(false)}
      >
        <View style={styles.mapFullscreenRoot}>
          <InlineErrorBoundary
            fallback={(
              <View style={[styles.mapFullscreenRoot, styles.mapFullscreenFallback]}>
                <Text style={styles.detailMapFallbackTitle}>Карта временно недоступна</Text>
                <Text style={styles.detailMapFallbackText}>Вернитесь к списку и попробуйте ещё раз.</Text>
              </View>
            )}
          >
            <GuideMap
              flat
              places={mappablePlaces}
              userPoint={nearbyUserPoint}
              height={viewportHeight}
              showControls
              controlsTopOffset={mobileInsets.top + 10}
              showsUserLocation={Boolean(nearbyUserPoint)}
              onOpenPlace={(item) => {
                setMapOpen(false);
                openDetail(item);
              }}
            />
          </InlineErrorBoundary>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMapOpen(false)}
            style={[styles.mapFullscreenClose, { top: mobileInsets.top + 10 }]}
          >
            <CloseIcon />
          </TouchableOpacity>
          <View pointerEvents="none" style={[styles.categoryMapCountChip, { top: mobileInsets.top + 16 }]}>
            <Text style={styles.categoryMapCountText}>{category.title} · {mappablePlaces.length}</Text>
          </View>
        </View>
      </Modal>
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
  const imageUrl = getPlaceImageUrls(place)[0];
  const avgCheckValue = Number(place.avgCheck);
  const checkLabel = toText(place.priceLabel) || (Number.isFinite(avgCheckValue) && avgCheckValue > 0 ? `от ${avgCheckValue.toLocaleString('ru-RU')} ₫` : '');
  const hoursLabel = toText(place.hours);
  const cuisineLabel = toText(place.cuisine) || toText(place.kind || place.listingType || place.type);
  const distanceKmValue = Number((place as GuidePlace & { distanceKm?: unknown }).distanceKm);
  const distanceLabel = Number.isFinite(distanceKmValue) && distanceKmValue > 0
    ? `${formatDistance(distanceKmValue)} ${estimateTravelTime(distanceKmValue)}`.trim()
    : '';
  const ratingRaw = Number((place as GuidePlace & { rating?: unknown }).rating);
  const ratingLabel = Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw.toFixed(1).replace('.', ',') : '';

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.listRow}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.listRowImage} />
      ) : (
        <View style={[styles.listRowImage, styles.listRowImageFallback]} />
      )}
      <View style={styles.listRowBody}>
        <View style={styles.listRowTitleRow}>
          <Text style={styles.listRowTitle} numberOfLines={1}>{toText(place.title, 'Место')}</Text>
          {place.qualityBadge ? (
            <Image source={placeVerificationBadge} resizeMode="contain" style={styles.listRowBadge} />
          ) : null}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggleFavorite}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <HeartIcon size={18} filled={isFavorite} color={isFavorite ? '#e05a3f' : '#c2ccda'} />
          </TouchableOpacity>
        </View>
        {hoursLabel ? (
          <View style={styles.listRowFact}>
            <ClockIcon />
            <Text style={styles.listRowFactText} numberOfLines={1}>{hoursLabel}</Text>
          </View>
        ) : null}
        {cuisineLabel ? (
          <View style={styles.listRowFact}>
            <CoffeeIcon />
            <Text style={styles.listRowFactText} numberOfLines={1}>{cuisineLabel}</Text>
          </View>
        ) : null}
        {distanceLabel ? (
          <View style={styles.listRowFact}>
            <PinIcon />
            <Text style={styles.listRowFactText} numberOfLines={1}>{distanceLabel}</Text>
          </View>
        ) : null}
        {checkLabel || ratingLabel ? (
          <View style={styles.listRowBottomRow}>
            {checkLabel ? (
              <View style={[styles.listRowFact, styles.flex]}>
                <BanknoteIcon />
                <Text style={styles.listRowFactText} numberOfLines={1}>{checkLabel}</Text>
              </View>
            ) : (
              <View style={styles.flex} />
            )}
            {ratingLabel ? (
              <Text style={styles.listRowRating}>
                <Text style={styles.detailStatsStar}>★</Text> {ratingLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}





function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}


const TRAVEL_MODES: TravelMode[] = ['walk', 'scooter', 'bike', 'taxi'];
const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  walk: 'Пешком',
  scooter: 'Скутер',
  bike: 'Велосипед',
  taxi: 'Такси'
};
// google.com/maps/dir universal URL supports walking | bicycling | driving | transit
const EXTERNAL_TRAVEL_MODE: Record<TravelMode, string> = {
  walk: 'walking',
  scooter: 'driving',
  bike: 'bicycling',
  taxi: 'driving'
};

// Мост Дракона — стартовая точка демо-маршрута, когда пользователь далеко от Дананга
const DANANG_DEMO_ORIGIN: LatLng = { latitude: 16.0611, longitude: 108.2229 };

// Best-effort «открыто сейчас» из строки часов ("07:00–22:00", "Ежедневно 7.30-21.00"…).
// null = не смогли распарсить (такие места фильтр не прячет).
function isOpenNow(hoursRaw: unknown): boolean | null {
  const text = toText(hoursRaw);
  if (!text) return null;
  if (/круглосуточ|24\s*\/\s*7|24\s*час/i.test(text)) return true;
  const match = text.match(/(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  // Часы мест — данангские (UTC+7); телефон туриста может жить в любом поясе
  const now = new Date();
  const current = (now.getUTCHours() * 60 + now.getUTCMinutes() + 7 * 60) % (24 * 60);
  if (end === start) return true;
  if (end > start) return current >= start && current < end;
  // ночной график, например 18:00–02:00
  return current >= start || current < end;
}

// Прогрев Google Maps SDK: первый MapView в процессе Android инициализирует
// Play Services Maps (~1-3 сек на слабых устройствах). Держим невидимую карту
// 1×1 px при старте — все настоящие карты после этого открываются мгновенно.
function MapWarmup() {
  const [isArmed, setArmed] = useState(false);
  const [isDone, setDone] = useState(false);

  useEffect(() => {
    // не соревнуемся с первичным рендером приложения
    const timer = setTimeout(() => setArmed(true), 600);
    return () => clearTimeout(timer);
  }, []);

  if (Platform.OS !== 'android' || !isArmed || isDone) return null;

  return (
    <View pointerEvents="none" style={styles.mapWarmup}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.mapWarmupMap}
        initialRegion={{ latitude: 16.06, longitude: 108.22, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
        liteMode={false}
        onMapReady={() => {
          // даём SDK дозагрузить рендерер и убираем прогревочную карту
          setTimeout(() => setDone(true), 800);
        }}
      />
    </View>
  );
}

// ─── Иконки из дизайн-макета (Карта места) ──────────────────────────────────
function WalkIcon({ size = 16, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={4.3} r={2.1} fill={color} stroke="none" />
      <Path d="M12 7.4v5.2" /><Path d="M12 9.2l-3 1.9" /><Path d="M12 9.2l3 1.3" /><Path d="M12 12.6l-2.4 6" /><Path d="M12 12.6l2.4 6" />
    </Svg>
  );
}

function ScooterIcon({ size = 22, color = '#8493a8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={6} cy={17} r={3} /><Circle cx={18.5} cy={17} r={3} />
      <Path d="M9 17h4.8l2.4-6H19" /><Path d="M11.2 11h3.6" /><Path d="M6 17l3-6" />
    </Svg>
  );
}

function BikeIcon({ size = 22, color = '#8493a8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={5.6} cy={16.6} r={3.3} /><Circle cx={18.4} cy={16.6} r={3.3} />
      <Path d="M5.6 16.6l4.2-7.2h4.4" /><Path d="M9.8 9.4l4.4 7.2" /><Path d="M8.3 9.4h3" />
    </Svg>
  );
}

function TaxiIcon({ size = 22, color = '#8493a8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4.4 12.4l1.5-3.7A2 2 0 0 1 7.8 7.4h8.4a2 2 0 0 1 1.9 1.3l1.5 3.7" />
      <Path d="M3.6 12.4h16.8v3a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1z" />
      <Circle cx={7} cy={17} r={1.3} fill={color} stroke="none" /><Circle cx={17} cy={17} r={1.3} fill={color} stroke="none" />
      <Path d="M9.8 7.4V5.6h4.4v1.8" />
    </Svg>
  );
}

function TravelModeIcon({ mode, size = 22, color = '#8493a8' }: { mode: TravelMode; size?: number; color?: string }) {
  if (mode === 'walk') return <WalkIcon size={size} color={color} />;
  if (mode === 'scooter') return <ScooterIcon size={size} color={color} />;
  if (mode === 'bike') return <BikeIcon size={size} color={color} />;
  return <TaxiIcon size={size} color={color} />;
}

function TrafficIcon({ active = false, size = 20 }: { active?: boolean; size?: number }) {
  const color = active ? '#1f63c7' : '#8493a8';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M8 3.5h8v17H8z" />
      <Circle cx={12} cy={7.5} r={1.7} fill="#e05a3f" stroke="none" />
      <Circle cx={12} cy={12} r={1.7} fill="#f5a623" stroke="none" />
      <Circle cx={12} cy={16.5} r={1.7} fill="#22a06b" stroke="none" />
    </Svg>
  );
}

function CloseIcon({ size = 16, color = '#20304c' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

function CompassIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#c7d2e0" strokeWidth={1.5} />
      <Path d="M12 5.5 15 12.5 9 12.5Z" fill="#e05a3f" />
      <Path d="M12 18.5 15 12.5 9 12.5Z" fill="#94a1b4" />
    </Svg>
  );
}

function LocateIcon({ size = 22, color = '#1f63c7' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <Circle cx={12} cy={12} r={1.3} fill={color} stroke="none" />
    </Svg>
  );
}

function ZoomGlyph({ minus = false, size = 20 }: { minus?: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#35507a" strokeWidth={2.2} strokeLinecap="round">
      {minus ? <Path d="M6 12h12" /> : <Path d="M12 6v12M6 12h12" />}
    </Svg>
  );
}

function SendIcon({ size = 17, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 11l18-8-8 18-2-8-8-2z" />
    </Svg>
  );
}

function ShareIcon({ size = 19, color = '#35507a' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={6} cy={12} r={2.4} /><Circle cx={17} cy={6} r={2.4} /><Circle cx={17} cy={18} r={2.4} />
      <Path d="M8.1 10.9 14.9 7.2M8.1 13.1 14.9 16.8" />
    </Svg>
  );
}

function ForkIcon({ size = 20, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 3v6a2 2 0 0 0 4 0V3" /><Path d="M8 9v12" />
      <Path d="M16.5 3c-1.4 0-2.5 2-2.5 4.5s1.1 4 2.5 4" /><Path d="M16.5 3v18" />
    </Svg>
  );
}

function StarIcon({ size = 14, color = '#f5a623' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3.4l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.2 19.6l1-5.8L2.9 9.6l5.9-.9z" />
    </Svg>
  );
}

function ClockIcon({ size = 17, color = '#e08a1e' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7.2v5l3.4 2" />
      <Path d="M12 3.4v1.3M20.6 12h-1.3M12 20.6v-1.3M3.4 12h1.3" />
    </Svg>
  );
}

function PinIcon({ size = 17, color = '#e05a3f', strokeWidth = 1.5 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 21.5c4-4 6.5-7 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 14.5 8 17.5 12 21.5z" />
      <Circle cx={12} cy={10.8} r={2.4} />
    </Svg>
  );
}

function CoffeeIcon({ size = 17, color = '#1f63c7' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.4 13.8a3.4 3.4 0 0 1-.5-6.75 4.1 4.1 0 0 1 7.95-1.3A3.5 3.5 0 0 1 17.6 13.8z" />
      <Path d="M7 13.8h10v5a1.1 1.1 0 0 1-1.1 1.1H8.1A1.1 1.1 0 0 1 7 18.8z" />
      <Path d="M10 14v3.2M14 14v3.2" />
    </Svg>
  );
}

function BanknoteIcon({ size = 17, color = '#1f9d63' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 8.5h13a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 6 4.5h9.5v4" />
      <Circle cx={16.2} cy={14} r={1.1} />
    </Svg>
  );
}

function HeartIcon({ size = 19, color = '#e05a3f', filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20s-7-4.7-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.3-7 10-7 10z" />
    </Svg>
  );
}

function ChevronGlyph() {
  return <Text style={{ color: '#c2ccda', fontWeight: '800', fontSize: 15 }}>›</Text>;
}

function StepManeuverIcon({ maneuver, size = 19 }: { maneuver: RouteStep['maneuver']; size?: number }) {
  if (maneuver === 'right') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1f63c7" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M8 19v-6.3a3 3 0 0 1 3-3h5.2" /><Path d="M13.6 6l4 3.7-4 3.7" />
      </Svg>
    );
  }
  if (maneuver === 'left') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1f63c7" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M16 19v-6.3a3 3 0 0 0-3-3H7.8" /><Path d="M10.4 6l-4 3.7 4 3.7" />
      </Svg>
    );
  }
  if (maneuver === 'finish') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e05a3f" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M7 20V4.4" /><Path d="M7 5.4h9l-2.2 3 2.2 3H7" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1f63c7" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 19V6" /><Path d="M7.6 10.4L12 6l4.4 4.4" />
    </Svg>
  );
}

function GuideMap({
  places = [],
  routePoints = [],
  routePolyline,
  routeIsFallback = false,
  userPoint,
  onOpenPlace,
  height = 250,
  flat = false,
  markerVariant = 'dot',
  showControls = false,
  controlsTopOffset = 16,
  popupActionLabel = 'Открыть',
  disablePlacePopup = false,
  preview = false,
  showsUserLocation = false,
  mapBottomPadding = 0,
  onMapPress
}: {
  places?: GuidePlace[];
  routePoints?: NativeRoutePoint[];
  routePolyline?: LatLng[] | null;
  routeIsFallback?: boolean;
  userPoint?: LatLng | null;
  onOpenPlace?: (place: GuidePlace) => void;
  height?: number;
  flat?: boolean;
  markerVariant?: 'dot' | 'pin';
  showControls?: boolean;
  controlsTopOffset?: number;
  popupActionLabel?: string;
  disablePlacePopup?: boolean;
  /** Non-interactive styled preview: full native map, gestures off, tap = onMapPress */
  preview?: boolean;
  /** Native blue "my location" dot + locate button (needs granted permission) */
  showsUserLocation?: boolean;
  /** Keeps the Google logo/camera clear of bottom sheets */
  mapBottomPadding?: number;
  onMapPress?: () => void;
}) {
  const [selectedPlace, setSelectedPlace] = useState<GuidePlace | null>(null);
  // react-native-svg paints asynchronously; with tracksViewChanges=false from the
  // first frame the Android marker snapshot can miss the SVG glyph (blank pin).
  // Track briefly so the icon rasterizes, then freeze to keep the map performant.
  // Re-armed whenever the marker set changes — the screen is reused across places,
  // and a freshly mounted Marker must go through a tracking window again.
  const placesKey = places.map((place) => place.id).join('|');
  const [pinTracks, setPinTracks] = useState(true);
  useEffect(() => {
    setPinTracks(true);
    setSelectedPlace(null);
    const timer = setTimeout(() => setPinTracks(false), 1500);
    return () => clearTimeout(timer);
  }, [placesKey]);
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
  const roadPolyline = Array.isArray(routePolyline) && routePolyline.length > 1 ? routePolyline : null;
  const allCoordinates = [
    ...routeCoordinates,
    ...placeMarkers.map((item) => item.coordinate),
    ...(roadPolyline || []),
    ...(userPoint ? [userPoint] : [])
  ];
  const mapRegion = allCoordinates.length === 1
    ? { latitude: allCoordinates[0].latitude, longitude: allCoordinates[0].longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }
    : buildMapRegion(allCoordinates);

  const mapViewRef = useRef<MapView | null>(null);
  // Content-derived signature: refit must trigger when coordinates change even if counts stay equal
  const coordSignature = (point?: { latitude: number; longitude: number } | null) =>
    point ? `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}` : '';
  const regionFitKey = [
    allCoordinates.length,
    coordSignature(allCoordinates[0]),
    coordSignature(allCoordinates[allCoordinates.length - 1]),
    roadPolyline?.length || 0,
    coordSignature(roadPolyline?.[Math.floor((roadPolyline?.length || 0) / 2)]),
    coordSignature(userPoint)
  ].join('|');
  const lastFitKeyRef = useRef(regionFitKey);
  // animateToRegion is a silent no-op before the native map is ready (Android/PROVIDER_GOOGLE),
  // so queue the region and replay it from onMapReady instead of consuming the fit key for nothing
  const isMapReadyRef = useRef(false);
  const pendingRegionRef = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  useEffect(() => {
    if (lastFitKeyRef.current === regionFitKey) return;
    lastFitKeyRef.current = regionFitKey;
    if (allCoordinates.length === 0) return;
    if (isMapReadyRef.current && mapViewRef.current) {
      mapViewRef.current.animateToRegion(mapRegion, 420);
    } else {
      pendingRegionRef.current = mapRegion;
    }
  }, [regionFitKey]);

  // ── Кластеризация: при 10+ точках маркеры группируются в пузыри с числом,
  // тап по пузырю приближает камеру до распада кластера ──
  const clusteringEnabled = placeMarkers.length >= 10 && !preview;
  const [visibleRegion, setVisibleRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [showsTrafficLayer, setShowsTrafficLayer] = useState(false);
  const clusterIndex = useMemo(
    () =>
      clusteringEnabled
        ? buildClusterIndex(placeMarkers.map(({ place, coordinate }) => ({
            id: place.id,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude
          })))
        : null,
    [clusteringEnabled, placesKey]
  );
  const clusterNodes = useMemo(
    () => (clusterIndex ? getClusterNodes(clusterIndex, visibleRegion ?? mapRegion) : []),
    [clusterIndex, visibleRegion, mapRegion]
  );
  const placeById = useMemo(() => {
    const map = new Map<string, { place: GuidePlace; coordinate: { latitude: number; longitude: number } }>();
    placeMarkers.forEach((entry) => map.set(entry.place.id, entry));
    return map;
  }, [placesKey]);

  // Apple Maps' camera has no `zoom` field (only altitude) — fall back to halving/doubling
  // the altitude so the zoom buttons work on iOS too.
  const zoomCamera = (direction: 1 | -1) => {
    void mapViewRef.current?.getCamera()
      .then((camera) => {
        if (typeof camera.zoom === 'number' && Number.isFinite(camera.zoom)) {
          mapViewRef.current?.animateCamera({ ...camera, zoom: camera.zoom + direction }, { duration: 220 });
        } else if (typeof camera.altitude === 'number' && Number.isFinite(camera.altitude)) {
          const altitude = direction > 0 ? Math.max(camera.altitude / 2, 120) : camera.altitude * 2;
          mapViewRef.current?.animateCamera({ ...camera, altitude }, { duration: 220 });
        }
      })
      .catch(() => {});
  };

  const cardStyle = flat ? styles.nativeMapFlat : styles.nativeMapCard;

  if (allCoordinates.length === 0) {
    return (
      <View style={[cardStyle, { height }]}>
        <Text style={styles.nativeMapEmptyTitle}>Карта пока пустая</Text>
        <Text style={styles.nativeMapEmptyText}>Добавь координаты lat/lng в карточки, и точки появятся на карте.</Text>
      </View>
    );
  }

  return (
    <View style={[cardStyle, { height }]}>
      <MapView
        ref={mapViewRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.nativeMap}
        initialRegion={mapRegion}
        customMapStyle={GUIDE_MAP_STYLE}
        showsCompass={!preview}
        toolbarEnabled={false}
        loadingEnabled
        loadingIndicatorColor="#1f63c7"
        loadingBackgroundColor={MAP_BG_COLOR}
        scrollEnabled={!preview}
        zoomEnabled={!preview}
        rotateEnabled={!preview}
        pitchEnabled={!preview}
        moveOnMarkerPress={false}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={showsUserLocation && !preview}
        showsTraffic={showsTrafficLayer}
        mapPadding={mapBottomPadding ? { top: 0, right: 0, bottom: mapBottomPadding, left: 0 } : undefined}
        onPress={onMapPress}
        onRegionChangeComplete={clusteringEnabled ? setVisibleRegion : undefined}
        onMapReady={() => {
          isMapReadyRef.current = true;
          if (pendingRegionRef.current) {
            mapViewRef.current?.animateToRegion(pendingRegionRef.current, 420);
            pendingRegionRef.current = null;
          }
        }}
      >
        {roadPolyline ? (
          routeIsFallback ? (
            // Straight-line fallback — dashed so it's clearly not a real road route
            <Polyline coordinates={roadPolyline} strokeColor="#1f63c7" strokeWidth={4} lineDashPattern={[10, 10]} />
          ) : (
            <>
              {/* White casing under the blue line — the route reads cleanly over any map colors */}
              <Polyline coordinates={roadPolyline} strokeColor="#ffffff" strokeWidth={9} zIndex={1} />
              <Polyline coordinates={roadPolyline} strokeColor="#1f63c7" strokeWidth={5} zIndex={2} />
            </>
          )
        ) : routeCoordinates.length > 1 ? (
          <Polyline coordinates={routeCoordinates} strokeColor="#1f63c7" strokeWidth={5} />
        ) : null}
        {routeCoordinates.map((point, index) => (
          <Marker
            key={`route-point-${index}`}
            coordinate={point}
            title={toText(routePoints[index]?.title, 'Точка маршрута')}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.nativeMapMarkerHalo}>
              <View
                style={[
                  styles.nativeMapMarkerRouteDot,
                  { backgroundColor: index === 0 ? '#22a06b' : index === routeCoordinates.length - 1 ? '#e05a3f' : '#1f63c7' }
                ]}
              />
            </View>
          </Marker>
        ))}
        {(() => {
          const renderPlaceMarker = (entry: { place: GuidePlace; coordinate: { latitude: number; longitude: number } }) => (
            <Marker
              key={`place-${entry.place.id}`}
              coordinate={entry.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={markerVariant === 'pin' ? pinTracks : false}
              onPress={disablePlacePopup ? undefined : () => setSelectedPlace(entry.place)}
            >
              {markerVariant === 'pin' ? (
                <View style={styles.nativeMapPinMarker}>
                  <ForkIcon size={20} />
                </View>
              ) : (
                <View style={styles.nativeMapMarkerHaloLarge}>
                  <View style={styles.nativeMapMarkerPlaceDot} />
                </View>
              )}
            </Marker>
          );

          if (!clusteringEnabled) return placeMarkers.map(renderPlaceMarker);

          return clusterNodes.map((node) => {
            if (node.type === 'cluster') {
              return (
                <Marker
                  key={`cluster-${node.id}`}
                  coordinate={{ latitude: node.latitude, longitude: node.longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                  onPress={() => {
                    mapViewRef.current?.animateToRegion(
                      regionForZoom(node.latitude, node.longitude, node.expansionZoom + 0.4),
                      320
                    );
                  }}
                >
                  <View style={styles.clusterBubble}>
                    <Text style={styles.clusterBubbleText}>{node.count}</Text>
                  </View>
                </Marker>
              );
            }
            const entry = placeById.get(node.id);
            return entry ? renderPlaceMarker(entry) : null;
          });
        })()}
        {userPoint ? (
          <Marker coordinate={userPoint} title="Вы здесь" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.nativeMapUserRing}>
              <View style={styles.nativeMapUserDotNew} />
            </View>
          </Marker>
        ) : null}
      </MapView>
      {showControls ? (
        <View style={[styles.mapControlsColumn, { top: controlsTopOffset }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.mapControlButton}
            onPress={() => {
              void mapViewRef.current?.getCamera()
                .then((camera) => {
                  mapViewRef.current?.animateCamera({ ...camera, heading: 0 }, { duration: 300 });
                })
                .catch(() => {});
            }}
          >
            <CompassIcon />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.mapControlButton}
            onPress={() => {
              if (allCoordinates.length > 0) {
                mapViewRef.current?.animateToRegion(mapRegion, 420);
              }
            }}
          >
            <LocateIcon />
          </TouchableOpacity>
          <View style={styles.mapZoomPanel}>
            <TouchableOpacity activeOpacity={0.85} style={styles.mapZoomButton} onPress={() => zoomCamera(1)}>
              <ZoomGlyph />
            </TouchableOpacity>
            <View style={styles.mapZoomDivider} />
            <TouchableOpacity activeOpacity={0.85} style={styles.mapZoomButton} onPress={() => zoomCamera(-1)}>
              <ZoomGlyph minus />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.mapControlButton, showsTrafficLayer && styles.mapControlButtonActive]}
            onPress={() => setShowsTrafficLayer((value) => !value)}
          >
            <TrafficIcon active={showsTrafficLayer} />
          </TouchableOpacity>
        </View>
      ) : null}
      {selectedPlace ? (
        <View style={styles.nativeMapPopup}>
          {getPlaceImageUrls(selectedPlace)[0] ? (
            <Image source={{ uri: getPlaceImageUrls(selectedPlace)[0] }} style={styles.nativeMapPopupThumb} />
          ) : null}
          <View style={styles.flex}>
            <Text style={styles.nativeMapPopupTitle} numberOfLines={1}>{toText(selectedPlace.title, 'Место')}</Text>
            <View style={styles.nativeMapPopupMetaRow}>
              {userPoint && placeCoordinate(selectedPlace) ? (
                <>
                  <Text style={styles.nativeMapPopupDistance}>
                    {formatDistanceMeters(
                      haversineDistanceKm(
                        { lat: userPoint.latitude, lng: userPoint.longitude },
                        { lat: placeCoordinate(selectedPlace)!.latitude, lng: placeCoordinate(selectedPlace)!.longitude }
                      ) * 1000
                    )}
                  </Text>
                  <Text style={styles.nativeMapPopupDot}>·</Text>
                </>
              ) : null}
              <Text style={styles.nativeMapPopupText} numberOfLines={1}>
                {toText(selectedPlace.kind || selectedPlace.district || selectedPlace.address, 'Открыть карточку')}
              </Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.82} onPress={() => onOpenPlace?.(selectedPlace)} style={styles.nativeMapPopupButton}>
            <Text style={styles.nativeMapPopupButtonText}>{popupActionLabel}</Text>
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
  const [roadRoute, setRoadRoute] = useState<WalkingRoute | null>(null);
  const [isRouteLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const coordinates = route.points
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

    if (coordinates.length < 2) {
      setRoadRoute(null);
      return undefined;
    }

    setRouteLoading(true);
    setRoadRoute(null);
    void fetchWalkingRoute(coordinates[0], coordinates[coordinates.length - 1], coordinates.slice(1, -1)).then((result) => {
      if (cancelled) return;
      // Keep the straight-line fallback rendering (GuideMap draws it from routePoints)
      setRoadRoute(result.roadRoute ? result : null);
      setRouteLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [route]);

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
        <GuideMap routePoints={route.points} routePolyline={roadRoute?.coordinates} height={290} />
        {isRouteLoading ? <Text style={styles.routeMapStatusText}>Строим пеший маршрут по улицам…</Text> : null}
        {roadRoute ? <Text style={styles.routeMapStatusText}>🚶 {formatRouteSummary(roadRoute)}</Text> : null}
        <TouchableOpacity activeOpacity={0.86} onPress={() => void openExternalUrl(googleMapsRouteUrl(route))} style={styles.routeMapButton}>
          <Text style={styles.routeMapButtonText}>Открыть в навигаторе</Text>
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
      .map((place) => {
        // Use placeCoordinate (repairs swapped lat/lng from the CMS) — not the raw fields
        const coordinate = placeCoordinate(place);
        const distanceKm = position && coordinate
          ? haversineDistanceKm(position, { lat: coordinate.latitude, lng: coordinate.longitude })
          : null;
        return { ...place, distanceKm };
      })
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
        <CategoryListingCard
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
            <View style={styles.tipThumbPlaceholder}><Text style={styles.tipThumbGlyph}>i</Text></View>
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


function buildTelegramNativeLoginUrl(returnTo: string, authNonce = '') {
  const origin = getApiOriginForAuth();
  const searchParams = new URLSearchParams({
    returnTo,
    mode: 'native',
    source: 'mobile'
  });
  if (authNonce) searchParams.set('authNonce', authNonce);
  return `${origin}/api/auth/telegram/native?${searchParams.toString()}`;
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const insets = useMobileInsets();

  return (
    <View style={styles.welcomeScreen}>
      <StatusBar translucent barStyle="light-content" backgroundColor="transparent" />
      <ImageBackground source={welcomeBackground} style={styles.full} imageStyle={styles.welcomeBackgroundImage}>
        <View style={[styles.welcomeOverlay, { paddingTop: insets.top + 34, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.welcomeCenter}>
            <Image source={appLogo} style={styles.welcomeLogo} resizeMode="contain" />
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
    </View>
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
      const authUrl = provider === 'telegram'
        ? buildTelegramNativeLoginUrl(authReturnTo, authNonce)
        : await fetchAuthStartUrl(provider, authReturnTo, authNonce);
      if (provider === 'telegram' && /accounts\.google\.com|google\.com\/o\/oauth|provider=google|auth\/google/i.test(authUrl)) {
        throw new Error('Telegram-кнопка получила Google-ссылку. Обнови APK из текущего архива и backend на Railway.');
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
  onHideBulletinAuthor,
  onBack,
  allPlaces = [],
  onOpenPlace
}: {
  place: GuidePlace;
  category?: GuideCategory;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  authUser: Record<string, unknown> | null;
  onOpenAuth: () => void;
  onReportBulletin: (place: GuidePlace) => void;
  onHideBulletinAuthor: (place: GuidePlace) => void;
  onBack?: () => void;
  allPlaces?: GuidePlace[];
  onOpenPlace?: (place: GuidePlace) => void;
}) {
  const mobileInsets = useMobileInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const gallery = getPlaceImageUrls(place);
  const [fullscreenImage, setFullscreenImage] = useState('');
  const [isVerificationOpen, setVerificationOpen] = useState(false);
  const [isMapFullscreen, setMapFullscreen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const detailScrollRef = useRef<ScrollView | null>(null);
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [routeMessage, setRouteMessage] = useState('');
  const [builtRoute, setBuiltRoute] = useState<WalkingRoute | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<LatLng | null>(null);
  const [routeMode, setRouteMode] = useState<TravelMode>('walk');
  const [isSheetExpanded, setSheetExpanded] = useState(false);
  const routesCacheRef = useRef<Partial<Record<TravelMode, WalkingRoute>>>({});
  const originTimestampRef = useRef(0);
  const pendingModeRef = useRef<TravelMode | null>(null);
  // Mirror of routeMode for async chains: a finishing build must only commit its
  // result if the user still has that mode selected
  const routeModeRef = useRef<TravelMode>('walk');
  // Bumped when background prefetch fills the cache so the switcher re-renders with per-mode times
  const [, setCacheTick] = useState(0);
  const [isDemoOrigin, setDemoOrigin] = useState(false);
  const isDemoOriginRef = useRef(false);
  const [isTooFar, setTooFar] = useState(false);
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
  const ratingRaw = Number((place as GuidePlace & { rating?: unknown }).rating);
  const ratingLabel = Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw.toFixed(1).replace('.', ',') : '';
  const hasMapPoint = Boolean(placeCoordinate(place));
  const hasInfoFields = Boolean(address || hours || phone);
  const qualityBadgeText = toText(place.qualityBadgeText, 'Это место отмечено знаком качества Danang Guide.');
  const isBulletin = place.categoryId === 'bulletin-board';
  const isOwnBulletin = Boolean(authUser?.id && place.createdByUserId && String(authUser.id) === String(place.createdByUserId));

  const activePlaceIdRef = useRef(place.id);
  const isBuildingRouteRef = useRef(false);
  const routeRequestTokenRef = useRef(0);
  const [showLocationSettingsLink, setShowLocationSettingsLink] = useState(false);

  // Drop the built route when the screen is reused for a different place
  useEffect(() => {
    activePlaceIdRef.current = place.id;
    // Invalidate any in-flight build for the previous place and unblock new ones
    routeRequestTokenRef.current += 1;
    isBuildingRouteRef.current = false;
    routesCacheRef.current = {};
    originTimestampRef.current = 0;
    pendingModeRef.current = null;
    routeModeRef.current = 'walk';
    isDemoOriginRef.current = false;
    setDemoOrigin(false);
    setTooFar(false);
    setRouteStatus('idle');
    setRouteMessage('');
    setBuiltRoute(null);
    setRouteOrigin(null);
    setRouteMode('walk');
    setSheetExpanded(false);
    setShowLocationSettingsLink(false);
  }, [place.id]);

  const buildInAppRoute = useCallback(async (modeArg?: TravelMode, originOverride?: LatLng) => {
    const mode = modeArg ?? routeMode;
    const destination = placeCoordinate(place);
    if (!destination) {
      // No coordinates to route to — the external map search is the only option
      void openExternalUrl(directionsUrl(place));
      return;
    }
    // Ref-based guard: immune to the state-commit delay on a rapid double-tap
    if (isBuildingRouteRef.current) return;
    isBuildingRouteRef.current = true;

    const requestPlaceId = place.id;
    const requestToken = ++routeRequestTokenRef.current;
    const isStale = () => activePlaceIdRef.current !== requestPlaceId || routeRequestTokenRef.current !== requestToken;

    setRouteStatus('loading');
    setRouteMessage('');
    setShowLocationSettingsLink(false);
    setTooFar(false);
    try {
      let origin = routeOrigin;
      const originAgeMs = Date.now() - originTimestampRef.current;

      if (originOverride) {
        // Demo mode: route from a fixed Da Nang point, no GPS involved
        origin = originOverride;
        isDemoOriginRef.current = true;
        setDemoOrigin(true);
        routesCacheRef.current = {};
        originTimestampRef.current = Date.now();
        setRouteOrigin(originOverride);
      } else if (!origin) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (isStale()) return;
        if (permission.status !== 'granted') {
          setRouteStatus('error');
          setRouteMessage('Разрешите доступ к геолокации, чтобы построить маршрут от вас до места.');
          setShowLocationSettingsLink(permission.canAskAgain === false);
          return;
        }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isStale()) return;
        origin = { latitude: current.coords.latitude, longitude: current.coords.longitude };

        // A (0,0) "null island" fix means the GPS failed, not that the user is in the ocean
        if (Math.abs(origin.latitude) < 0.5 && Math.abs(origin.longitude) < 0.5) {
          setRouteStatus('error');
          setRouteMessage('Не удалось определить ваше местоположение (GPS вернул пустую точку). Включите геолокацию и попробуйте ещё раз.');
          setTooFar(true);
          return;
        }

        // Routes only make sense nearby — a tourist browsing from home would get an absurd line
        const straightKm = haversineDistanceKm(
          { lat: origin.latitude, lng: origin.longitude },
          { lat: destination.latitude, lng: destination.longitude }
        );
        if (straightKm > 50) {
          setRouteStatus('error');
          setRouteMessage(`Вы сейчас в ~${Math.round(straightKm)} км от места — маршрут не построить. Когда будете в Дананге, маршрут появится на карте.`);
          setTooFar(true);
          return;
        }
        isDemoOriginRef.current = false;
        setDemoOrigin(false);
        originTimestampRef.current = Date.now();
        setRouteOrigin(origin);
      } else if (!isDemoOriginRef.current && originAgeMs > 120000) {
        // The user may have moved since the first GPS fix — refresh it quietly
        // (permission is already granted, so this never prompts)
        try {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (isStale()) return;
          const fresh: LatLng = { latitude: current.coords.latitude, longitude: current.coords.longitude };
          // Ignore failed (0,0) fixes — keep routing from the previous position
          if (Math.abs(fresh.latitude) >= 0.5 || Math.abs(fresh.longitude) >= 0.5) {
            const movedKm = haversineDistanceKm(
              { lat: origin.latitude, lng: origin.longitude },
              { lat: fresh.latitude, lng: fresh.longitude }
            );
            if (movedKm > 0.15) {
              // Cached routes were computed from the old position — they are wrong now
              routesCacheRef.current = {};
            }
            origin = fresh;
            originTimestampRef.current = Date.now();
            setRouteOrigin(fresh);
          }
        } catch {
          // GPS hiccup — keep routing from the previous fix
        }
      }
      if (isStale()) return;

      const cached = routesCacheRef.current[mode];
      if (cached) {
        setBuiltRoute(cached);
        setRouteStatus('ready');
        return;
      }

      const route = await fetchRoute(origin, destination, [], mode);
      if (isStale()) return;
      // Never cache degraded results: a straight-line fallback would otherwise
      // poison this mode until the user leaves the screen
      if (route.roadRoute) {
        routesCacheRef.current[mode] = route;
      }
      // Commit only if the user still has this mode selected — they may have
      // tapped a cached mode while this build was in flight
      if (routeModeRef.current === mode) {
        setBuiltRoute(route);
        setRouteStatus('ready');
        setRouteMessage('');
      }
      // Warm the other modes in the background so switching is instant and the
      // switcher shows each mode's own time right away
      void prefetchOtherModes(origin, destination, requestPlaceId);
    } catch {
      if (!isStale()) {
        setRouteStatus('error');
        setRouteMessage('Не удалось построить маршрут. Проверьте геолокацию и попробуйте ещё раз.');
      }
    } finally {
      // Only release the guard if this chain still owns it (a place switch may have reset it)
      if (routeRequestTokenRef.current === requestToken) {
        isBuildingRouteRef.current = false;
        const pending = pendingModeRef.current;
        pendingModeRef.current = null;
        if (pending && pending !== mode && !isStale()) {
          const cached = routesCacheRef.current[pending];
          if (cached) {
            setBuiltRoute(cached);
            setRouteStatus('ready');
          } else {
            void buildInAppRoute(pending);
          }
        }
      }
    }
  }, [place, routeMode, routeOrigin]);

  // Fetches routes for the modes the user hasn't opened yet. bike reuses the taxi
  // (DRIVE) result — Google has no bicycling data for Vietnam, so bike falls back
  // to the road route anyway; the alias saves two API calls per place.
  const prefetchOtherModes = useCallback(async (origin: LatLng, destination: LatLng, requestPlaceId: string) => {
    const targets: TravelMode[] = ['walk', 'scooter', 'taxi'];
    await Promise.all(
      targets
        .filter((m) => !routesCacheRef.current[m])
        .map(async (m) => {
          try {
            const route = await fetchRoute(origin, destination, [], m);
            if (activePlaceIdRef.current !== requestPlaceId) return;
            if (route.roadRoute) {
              routesCacheRef.current[m] = route;
            }
          } catch {
            // background warm-up only — the user-facing path retries on demand
          }
        })
    );
    if (activePlaceIdRef.current !== requestPlaceId) return;
    const taxiRoute = routesCacheRef.current.taxi;
    if (!routesCacheRef.current.bike && taxiRoute) {
      routesCacheRef.current.bike = { ...taxiRoute, mode: 'bike' };
    }
    // If the visible route is a straight-line fallback and the prefetch just got
    // a real road route for that same mode — upgrade it in place
    setBuiltRoute((current) => {
      if (!current || current.roadRoute) return current;
      const upgraded = routesCacheRef.current[routeModeRef.current];
      return upgraded && upgraded.roadRoute ? upgraded : current;
    });
    setCacheTick((value) => value + 1);
  }, []);

  // The origin (and everything cached from it) is trustworthy for ~2 minutes;
  // demo origin never expires
  const isOriginFresh = useCallback(
    () => isDemoOriginRef.current || Date.now() - originTimestampRef.current <= 120000,
    []
  );

  const switchRouteMode = useCallback((mode: TravelMode) => {
    setRouteMode(mode);
    routeModeRef.current = mode;
    const cached = routesCacheRef.current[mode];
    if (cached && isOriginFresh()) {
      setBuiltRoute(cached);
      setRouteStatus('ready');
      return;
    }
    if (isBuildingRouteRef.current) {
      // A build is in flight — remember the tap and run it as soon as the
      // current build releases the guard (instead of silently dropping it)
      pendingModeRef.current = mode;
      return;
    }
    // Either uncached, or the GPS fix is stale — buildInAppRoute refreshes the
    // origin (and clears the cache if the user moved) before serving anything
    void buildInAppRoute(mode);
  }, [buildInAppRoute, isOriginFresh]);

  const shareRoute = useCallback(async () => {
    try {
      await Share.share({ message: `${toText(place.title, 'Место')} — ${directionsUrl(place)}` });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }, [place]);

  const sharePlace = useCallback(async () => {
    const destination = placeCoordinate(place);
    const mapsUrl = destination
      ? `https://www.google.com/maps/search/?api=1&query=${destination.latitude},${destination.longitude}`
      : directionsUrl(place);
    const parts = [toText(place.title, 'Место'), toText(place.address || place.district), mapsUrl].filter(Boolean);
    try {
      await Share.share({ message: parts.join('\n') });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }, [place]);

  // Close the fullscreen map, reset the gallery and scroll back to the hero
  // when the screen is reused for another place (via «Похожие рядом» or a push)
  useEffect(() => {
    setMapFullscreen(false);
    setActivePhotoIndex(0);
    setFullscreenImage('');
    setVerificationOpen(false);
    detailScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [place.id]);

  // «Похожие рядом» — places from the same category, excluding this one
  const similarPlaces = useMemo(
    () =>
      allPlaces
        .filter((item) => item.id !== place.id && item.categoryId === place.categoryId)
        .slice(0, 6),
    [allPlaces, place.id, place.categoryId]
  );

  const openFullscreenRoute = useCallback(() => {
    setMapFullscreen(true);
    // Rebuild when there's no route yet — or when the GPS fix behind the cached
    // one is older than the TTL (the user may have walked away since)
    if (routeStatus === 'idle' || routeStatus === 'error' || !isOriginFresh()) {
      void buildInAppRoute();
    }
  }, [routeStatus, buildInAppRoute, isOriginFresh]);

  const statCells = [
    ratingLabel ? { key: 'rating', star: true, value: ratingLabel, caption: 'рейтинг', color: '#102a43' } : null,
    hours ? { key: 'hours', star: false, value: hours, caption: 'время работы', color: '#22a06b' } : null,
    builtRoute?.distanceMeters
      ? {
          key: 'distance',
          star: false,
          value: formatDistanceMeters(builtRoute.distanceMeters),
          caption: builtRoute.durationSeconds ? `≈ ${formatDurationShort(builtRoute.durationSeconds)}` : 'до места',
          color: '#e05a3f'
        }
      : null,
    price ? { key: 'price', star: false, value: price, caption: 'средний чек', color: '#102a43' } : null
  ].filter((cell): cell is { key: string; star: boolean; value: string; caption: string; color: string } => Boolean(cell));

  return (
    <View style={styles.flex}>
    <ScrollView
      ref={detailScrollRef}
      style={styles.content}
      contentContainerStyle={{ paddingBottom: 100 + mobileInsets.bottom, backgroundColor: '#ffffff' }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero: full-bleed swipeable photo pager with overlay controls */}
      <View style={styles.detailHero}>
        {gallery.length > 0 ? (
          <ScrollView
            key={`hero-pager-${place.id}`}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, viewportWidth));
              setActivePhotoIndex(Math.max(0, Math.min(gallery.length - 1, index)));
            }}
          >
            {gallery.map((imageUrl, index) => (
              <TouchableOpacity key={`${imageUrl}-${index}`} activeOpacity={0.94} onPress={() => setFullscreenImage(imageUrl)}>
                <Image source={{ uri: imageUrl }} style={{ width: viewportWidth, height: 440 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.detailHeroFallback, { width: viewportWidth }]} />
        )}
        <LinearGradient
          colors={['rgba(9, 22, 40, 0)', 'rgba(9, 22, 40, 0.85)']}
          style={styles.detailHeroGradient}
          pointerEvents="none"
        />
        <View pointerEvents="box-none" style={[styles.detailHeroTopRow, { top: mobileInsets.top + 8 }]}>
          <TouchableOpacity activeOpacity={0.85} onPress={onBack} style={styles.detailHeroCircle}>
            <Text style={styles.detailHeroBackGlyph}>‹</Text>
          </TouchableOpacity>
          <View pointerEvents="box-none" style={styles.detailHeroTopActions}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => void sharePlace()} style={styles.detailHeroCircle}>
              <ShareIcon size={18} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={onToggleFavorite} style={styles.detailHeroCircle}>
              <HeartIcon filled={isFavorite} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.detailHeroTitleRow} pointerEvents="none">
          <Text style={styles.detailHeroTitle} numberOfLines={2}>{title}</Text>
          <View style={styles.detailHeroChip}>
            <Text style={styles.detailHeroChipText}>{categoryLabel}</Text>
          </View>
        </View>
        {gallery.length > 1 ? (
          <View style={styles.detailHeroDots} pointerEvents="none">
            {gallery.map((_, index) => (
              <View key={`hero-dot-${index}`} style={[styles.detailHeroDot, index === activePhotoIndex && styles.detailHeroDotActive]} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.detailBody}>
        {statCells.length >= 2 ? (
          <View style={styles.detailStatsStrip}>
            {statCells.map((cell, index) => (
              <React.Fragment key={cell.key}>
                {index > 0 ? <View style={styles.detailStatsDivider} /> : null}
                <View style={styles.detailStatsCell}>
                  <Text style={[styles.detailStatsValue, { color: cell.color }]} numberOfLines={1}>
                    {cell.star ? <Text style={styles.detailStatsStar}>★ </Text> : null}
                    {cell.value}
                  </Text>
                  <Text style={styles.detailStatsCaption} numberOfLines={1}>{cell.caption}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        ) : null}

        <Text style={styles.detailText}>{description}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.detailBadgeScroll}
          contentContainerStyle={styles.detailBadgeRow}
        >
          {place.qualityBadge ? (
            <TouchableOpacity activeOpacity={0.85} onPress={() => setVerificationOpen(true)} style={styles.detailBadgeGold}>
              <Image source={placeVerificationBadge} resizeMode="contain" style={styles.detailBadgeGoldIcon} />
              <Text style={styles.detailBadgeGoldText}>Проверено гидом</Text>
            </TouchableOpacity>
          ) : null}
          {cuisine ? <View style={styles.detailPill}><Text style={styles.detailPillText}>{cuisine}</Text></View> : null}
          {place.breakfast ? <View style={styles.detailPill}><Text style={styles.detailPillText}>Завтраки</Text></View> : null}
          {place.vegan ? <View style={styles.detailPill}><Text style={styles.detailPillText}>Vegan</Text></View> : null}
          {place.pets || place.petFriendly ? <View style={styles.detailPill}><Text style={styles.detailPillText}>Pet-friendly</Text></View> : null}
          {place.childPrograms || place.childFriendly ? <View style={styles.detailPill}><Text style={styles.detailPillText}>Для детей</Text></View> : null}
          {Array.from(new Set(tags))
            .filter((tag) => tag !== cuisine)
            .map((tag) => (
              <View key={`tag-${tag}`} style={styles.detailPill}><Text style={styles.detailPillText}>{tag}</Text></View>
            ))}
        </ScrollView>

        {hasInfoFields || website ? (
          <View style={styles.detailInfoRows}>
            {address ? (
              <TouchableOpacity
                activeOpacity={hasMapPoint ? 0.82 : 1}
                disabled={!hasMapPoint}
                onPress={hasMapPoint ? openFullscreenRoute : undefined}
                style={styles.detailInfoRow}
              >
                <View style={styles.detailInfoRowIcon}><PinIcon size={17} color="#1f63c7" strokeWidth={2} /></View>
                <Text style={styles.detailInfoRowText} numberOfLines={2}>{address}{district ? ` · ${district}` : ''}</Text>
                {hasMapPoint ? <ChevronGlyph /> : null}
              </TouchableOpacity>
            ) : null}
            {hours ? (
              <View style={[styles.detailInfoRow, !phone && !website && styles.detailInfoRowLast]}>
                <View style={styles.detailInfoRowIcon}><ClockIcon size={17} color="#1f63c7" /></View>
                <Text style={styles.detailInfoRowText} numberOfLines={2}>{hours}</Text>
              </View>
            ) : null}
            {phone ? (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => {
                  const contactUrl = contactUrlFromText(phone);
                  if (contactUrl) void openExternalUrl(contactUrl);
                }}
                style={[styles.detailInfoRow, !website && styles.detailInfoRowLast]}
              >
                <View style={styles.detailInfoRowIcon}><Text style={styles.detailInfoRowGlyph}>✆</Text></View>
                <Text style={styles.detailInfoRowText} numberOfLines={1}>{phone}</Text>
                <ChevronGlyph />
              </TouchableOpacity>
            ) : null}
            {website ? (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => void openExternalUrl(/^[a-z][a-z0-9+.-]*:/i.test(website) ? website : `https://${website}`)}
                style={[styles.detailInfoRow, styles.detailInfoRowLast]}
              >
                <View style={styles.detailInfoRowIcon}><Text style={styles.detailInfoRowGlyph}>🌐</Text></View>
                <Text style={styles.detailInfoRowText} numberOfLines={1}>{website.replace(/^https?:\/\//, '')}</Text>
                <ChevronGlyph />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      {isBulletin && !isOwnBulletin ? (
        <View style={styles.detailPaddedSection}>
          <View style={styles.bulletinSafetyActions}>
            <TouchableOpacity activeOpacity={0.84} onPress={authUser ? () => onReportBulletin(place) : onOpenAuth} style={styles.bulletinSafetyButton}>
              <Text style={styles.bulletinSafetyText}>Пожаловаться</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.84} onPress={authUser ? () => onHideBulletinAuthor(place) : onOpenAuth} style={styles.bulletinSafetyButton}>
              <Text style={styles.bulletinSafetyText}>Скрыть автора</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {details.length > 0 ? (
        <View style={styles.detailPaddedSection}>
          <SectionTitle title="Дополнительно" />
          {details.map((item) => <Text key={item} style={styles.bulletText}>• {item}</Text>)}
        </View>
      ) : null}

      {similarPlaces.length > 0 ? (
        <View style={styles.detailSimilarSection}>
          <Text style={styles.detailSectionHeading}>Похожие рядом</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.detailSimilarScroll}
            contentContainerStyle={styles.detailSimilarRow}
          >
            {similarPlaces.map((item) => {
              const thumb = getPlaceImageUrls(item)[0];
              const itemRatingRaw = Number((item as GuidePlace & { rating?: unknown }).rating);
              const itemRating = Number.isFinite(itemRatingRaw) && itemRatingRaw > 0 ? itemRatingRaw.toFixed(1).replace('.', ',') : '';
              const meta = [itemRating ? `★ ${itemRating}` : '', toText(item.district || item.kind)].filter(Boolean).join(' · ');
              return (
                <TouchableOpacity key={item.id} activeOpacity={0.88} onPress={() => onOpenPlace?.(item)} style={styles.detailSimilarCard}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.detailSimilarImage} />
                  ) : (
                    <View style={[styles.detailSimilarImage, styles.detailSimilarImageFallback]} />
                  )}
                  <View style={styles.detailSimilarBody}>
                    <Text style={styles.detailSimilarTitle} numberOfLines={1}>{toText(item.title, 'Место')}</Text>
                    {meta ? <Text style={styles.detailSimilarMeta} numberOfLines={1}>{meta}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {hasMapPoint ? (
        <View style={styles.detailHowToSection}>
          <View style={styles.detailHowToHeader}>
            <Text style={styles.detailSectionHeading}>Как добраться</Text>
            {builtRoute?.distanceMeters ? (
              <Text style={styles.detailHowToMeta}>
                {formatDistanceMeters(builtRoute.distanceMeters)}{builtRoute.durationSeconds ? ` · ${formatDurationShort(builtRoute.durationSeconds)}` : ''}{!builtRoute.roadRoute ? ' (по прямой)' : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.detailMapFullNew}>
            <InlineErrorBoundary
              fallback={(
                <View style={styles.detailMapFallback}>
                  <Text style={styles.detailMapFallbackTitle}>Карта временно недоступна</Text>
                  <Text style={styles.detailMapFallbackText}>Карточка открыта, а маршрут можно открыть в навигаторе.</Text>
                  <TouchableOpacity activeOpacity={0.82} onPress={() => void openExternalUrl(directionsUrl(place))}>
                    <Text style={styles.detailRouteExternalLink}>Открыть в навигаторе</Text>
                  </TouchableOpacity>
                </View>
              )}
            >
              <GuideMap
                flat
                preview
                places={[place]}
                routePolyline={builtRoute?.coordinates}
                routeIsFallback={builtRoute ? !builtRoute.roadRoute : false}
                userPoint={routeOrigin}
                height={260}
                markerVariant="pin"
                disablePlacePopup
                onMapPress={openFullscreenRoute}
              />
            </InlineErrorBoundary>
          </View>
        </View>
      ) : null}
      <Modal
        visible={isMapFullscreen}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setMapFullscreen(false)}
      >
        <View style={styles.mapFullscreenRoot}>
          <InlineErrorBoundary
            fallback={(
              <View style={[styles.mapFullscreenRoot, styles.mapFullscreenFallback]}>
                <Text style={styles.detailMapFallbackTitle}>Карта временно недоступна</Text>
                <Text style={styles.detailMapFallbackText}>Маршрут можно открыть в навигаторе кнопкой ниже.</Text>
              </View>
            )}
          >
            <GuideMap
              flat
              places={[place]}
              routePolyline={builtRoute?.coordinates}
              routeIsFallback={builtRoute ? !builtRoute.roadRoute : false}
              userPoint={routeOrigin}
              height={viewportHeight}
              markerVariant="pin"
              showControls
              controlsTopOffset={mobileInsets.top + 10}
              disablePlacePopup
              showsUserLocation={Boolean(routeOrigin) && !isDemoOrigin}
              mapBottomPadding={168}
            />
          </InlineErrorBoundary>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setMapFullscreen(false)}
            style={[styles.mapFullscreenClose, { top: mobileInsets.top + 10 }]}
          >
            <CloseIcon />
          </TouchableOpacity>
          {routeStatus !== 'idle' ? (
            <View style={[styles.mapFullscreenCard, { paddingBottom: 16 + mobileInsets.bottom }]}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setSheetExpanded((value) => !value)} style={styles.sheetHandleZone}>
                <View style={styles.sheetHandle} />
              </TouchableOpacity>

              {builtRoute && routeStatus !== 'error' ? (
                <View style={styles.modeSwitcher}>
                  {TRAVEL_MODES.map((mode) => {
                    const isActive = mode === routeMode;
                    const cachedRoute = routesCacheRef.current[mode];
                    return (
                      <TouchableOpacity
                        key={mode}
                        activeOpacity={0.85}
                        onPress={() => switchRouteMode(mode)}
                        style={[styles.modeSegment, isActive && styles.modeSegmentActive]}
                      >
                        <TravelModeIcon mode={mode} size={20} color={isActive ? '#1f63c7' : '#8493a8'} />
                        <Text style={[styles.modeSegmentLabel, isActive && styles.modeSegmentLabelActive]}>{TRAVEL_MODE_LABELS[mode]}</Text>
                        <Text style={[styles.modeSegmentTime, isActive && styles.modeSegmentTimeActive]}>
                          {cachedRoute?.durationSeconds ? formatDurationShort(cachedRoute.durationSeconds) : '—'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {routeStatus === 'loading' ? (
                <View style={styles.sheetLoadingRow}>
                  <ActivityIndicator size="small" color="#1f63c7" />
                  <Text style={styles.sheetLoadingText}>Строим маршрут…</Text>
                </View>
              ) : null}

              {routeStatus === 'ready' && builtRoute ? (
                <>
                  <View style={styles.sheetSummaryRow}>
                    <View style={styles.sheetModeChip}>
                      <TravelModeIcon mode={builtRoute.mode} size={20} color="#ffffff" />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.sheetSummaryTitle}>{formatRouteShort(builtRoute)}</Text>
                      <Text style={styles.sheetSummarySub} numberOfLines={1}>
                        {isDemoOrigin ? 'от Моста Дракона' : travelModeWord(builtRoute.mode)} · {title}
                      </Text>
                    </View>
                  </View>

                  {isSheetExpanded && builtRoute.steps.length > 0 ? (
                    <ScrollView style={styles.sheetStepsScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {builtRoute.steps.map((step, index) => (
                        <View key={`route-step-${index}`} style={styles.sheetStepRow}>
                          <View style={styles.sheetStepIcon}>
                            <StepManeuverIcon maneuver={step.maneuver} />
                          </View>
                          <Text style={styles.sheetStepText}>{step.text}</Text>
                          {step.distanceMeters ? (
                            <Text style={styles.sheetStepDist}>{formatDistanceMeters(step.distanceMeters)}</Text>
                          ) : null}
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                  {builtRoute.steps.length > 0 ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => setSheetExpanded((value) => !value)}>
                      <Text style={styles.sheetStepsToggle}>
                        {isSheetExpanded ? 'Свернуть' : `Показать шаги (${builtRoute.steps.length})`}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.sheetActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={() => void openExternalUrl(`${directionsUrl(place)}&travelmode=${EXTERNAL_TRAVEL_MODE[builtRoute.mode]}`)}
                      style={styles.sheetGoButton}
                    >
                      <SendIcon />
                      <Text style={styles.sheetGoButtonText}>В путь</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.86} onPress={() => void shareRoute()} style={styles.sheetShareButton}>
                      <ShareIcon />
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {routeStatus === 'error' && routeMessage ? (
                <>
                  <Text style={styles.mapFullscreenError}>{routeMessage}</Text>
                  <View style={styles.mapFullscreenLinksRow}>
                    {showLocationSettingsLink ? (
                      <TouchableOpacity activeOpacity={0.82} onPress={() => void Linking.openSettings()}>
                        <Text style={styles.detailRouteExternalLink}>Открыть настройки</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity activeOpacity={0.82} onPress={() => void buildInAppRoute()}>
                      <Text style={styles.detailRouteExternalLink}>Повторить</Text>
                    </TouchableOpacity>
                    {isTooFar ? (
                      <TouchableOpacity activeOpacity={0.82} onPress={() => void buildInAppRoute(routeMode, DANANG_DEMO_ORIGIN)}>
                        <Text style={styles.detailRouteExternalLink}>Демо-маршрут от Моста Дракона</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity activeOpacity={0.82} onPress={() => void openExternalUrl(directionsUrl(place))}>
                      <Text style={styles.detailRouteExternalLink}>Открыть в навигаторе</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
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
    <View style={[styles.detailBottomBar, { paddingBottom: 14 + mobileInsets.bottom }]}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={hasMapPoint ? openFullscreenRoute : () => void openExternalUrl(directionsUrl(place))}
        style={styles.detailBottomCta}
      >
        <SendIcon />
        <Text style={styles.detailBottomCtaText}>
          {routeStatus === 'loading'
            ? 'Строим маршрут…'
            : builtRoute?.durationSeconds
              ? `Маршрут · ${formatDurationShort(builtRoute.durationSeconds)}`
              : 'Построить маршрут'}
        </Text>
      </TouchableOpacity>
    </View>
    </View>
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
  appHeader: { paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 10 : 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#d8e0ea', backgroundColor: '#f5f7fb' },
  logoText: { color: '#1f63c7', fontSize: 22, fontWeight: '900' },
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
  errorText: { color: '#62748b', fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  errorButton: { minHeight: 46, borderRadius: 16, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 18 },
  errorButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },

  homeRoot: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: '#ffffff' },
  homeHero: { width: '100%', minWidth: '100%', alignSelf: 'stretch', height: 150, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: '#1c65a0' },
  homeHeroImage: { resizeMode: 'cover' },
  homeHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 18, 38, 0.08)' },
  heroAuthButton: { position: 'absolute', right: 14, top: 12, zIndex: 4, width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8, 18, 37, 0.36)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  heroAuthAvatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)' },
  heroAuthIcon: { color: '#ffffff', fontSize: 20, lineHeight: 23, fontWeight: '900' },
  homeBody: { width: '100%', minWidth: '100%', alignSelf: 'stretch', marginTop: -18, paddingHorizontal: 0, paddingLeft: 0, paddingRight: 0, gap: 14, backgroundColor: '#ffffff' },
  bannerStack: { width: '100%', minWidth: '100%', height: 168, justifyContent: 'center', overflow: 'hidden' },
  bannerScrollerContent: { alignItems: 'center' },
  homeBanner: { height: 126, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1f63c7' },
  homeBannerSlide: { height: 134, borderRadius: 22, backgroundColor: '#1f63c7', shadowColor: '#293d5d', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 8 },
  homeBannerImage: { borderRadius: 20 },
  homeBannerFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  bannerDots: { position: 'absolute', left: 0, right: 0, bottom: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  bannerDot: { width: 18, height: 3, borderRadius: 999, backgroundColor: 'rgba(31, 99, 199, 0.18)' },
  bannerDotActive: { backgroundColor: '#1f63c7', width: 30 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginTop: 2, paddingHorizontal: 14 },
  quickItem: { width: '25%', alignItems: 'center', paddingHorizontal: 2 },
  quickIcon: { width: 68, height: 68, borderRadius: 18, backgroundColor: '#dbe7ef' },
  quickLabel: { color: '#102a43', fontSize: 10.5, lineHeight: 12.5, fontWeight: '900', textAlign: 'center', marginTop: 7, minHeight: 26 },
  programSpotlight: { position: 'relative', overflow: 'hidden', borderRadius: 24, backgroundColor: '#1f63c7', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 8, alignItems: 'center', marginHorizontal: 14, marginTop: 2 },
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
  homeSectionLink: { color: '#1f63c7', fontSize: 13, fontWeight: '900' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 0, borderRadius: 0, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(23, 37, 64, 0.08)' },
  tipThumbPlaceholder: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4edf7' },
  tipThumbGlyph: { color: '#1f63c7', fontSize: 20, fontWeight: '900' },
  tipTitle: { color: '#102a43', fontSize: 14, fontWeight: '900' },
  tipText: { color: '#62748b', fontSize: 12, lineHeight: 16, marginTop: 3 },
  tipChevron: { color: '#96a6bb', fontSize: 24, lineHeight: 26, fontWeight: '500' },
  tipModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 19, 38, 0.36)' },
  tipModalCard: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#ffffff' },
  tipModalHandle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 999, backgroundColor: '#d8e0ea', marginBottom: 14 },
  tipModalEyebrow: { color: '#1f63c7', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  tipModalTitle: { color: '#102a43', fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 8 },
  tipModalText: { color: '#62748b', fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 10 },
  tipModalButton: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', marginTop: 18 },
  tipModalButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  welcomeScreen: { flex: 1, width: '100%', backgroundColor: '#156db2' },
  welcomeBackgroundImage: { resizeMode: 'cover' },
  welcomeOverlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 22, backgroundColor: 'rgba(8, 24, 48, 0.28)' },
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
  contactCard: { padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e0ea', shadowColor: '#293d5d', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  contactCardTitle: { color: '#102a43', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  contactCardText: { color: '#62748b', fontSize: 14, lineHeight: 20, marginTop: 5, fontWeight: '700' },
  contactValue: { color: '#1f63c7', fontSize: 16, fontWeight: '900', marginTop: 10 },
  legalLinksCard: { padding: 14, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', gap: 4 },
  legalLinksTitle: { color: '#102a43', fontSize: 15, lineHeight: 19, fontWeight: '900', marginBottom: 4 },
  legalLinkRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  legalLinkText: { color: '#1f63c7', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  legalLinkArrow: { color: '#8a9aae', fontSize: 22, lineHeight: 24, fontWeight: '700' },

  detailMapFallback: { minHeight: 128, borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: '#eaf3ff', borderWidth: 1, borderColor: '#d8e4f2' },
  detailMapFallbackTitle: { color: '#102a43', fontSize: 15, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
  detailMapFallbackText: { color: '#62748b', fontSize: 12.5, lineHeight: 18, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  fullscreenImageBackdrop: { flex: 1, backgroundColor: 'rgba(2, 8, 23, 0.94)' },
  fullscreenImageCloseArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  fullscreenImage: { width: '100%', height: '86%' },
  fullscreenImageCloseButton: { position: 'absolute', top: 44, right: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImageCloseText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '600' },
  detailText: { color: '#62748b', fontSize: 16, lineHeight: 24 },
  infoBlock: { paddingVertical: 13, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)', gap: 4 },
  infoLabel: { color: '#62748b', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { color: '#102a43', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  infoValueLink: { color: '#1f63c7' },
  bulletinSafetyActions: { flexDirection: 'row', gap: 8 },
  bulletinSafetyButton: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 10 },
  bulletinSafetyText: { color: '#9a3412', fontSize: 12.5, lineHeight: 16, fontWeight: '900' },
  verificationModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(9, 19, 38, 0.42)' },
  verificationModalCard: { width: '100%', maxWidth: 340, borderRadius: 24, backgroundColor: '#ffffff', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 },
  verificationModalImage: { width: 88, height: 88 },
  verificationModalTitle: { color: '#102a43', fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  verificationModalText: { color: '#62748b', fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  verificationModalButton: { minHeight: 46, borderRadius: 15, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, marginTop: 18 },
  verificationModalButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  bulletText: { color: '#62748b', fontSize: 15, lineHeight: 22 },
  nativeMapCard: { width: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: '#e8f1f8', borderWidth: 1, borderColor: '#d8e0ea', justifyContent: 'center' },
  nativeMap: { ...StyleSheet.absoluteFillObject },
  nativeMapMarkerHalo: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255, 255, 255, 0.92)', alignItems: 'center', justifyContent: 'center' },
  nativeMapMarkerHaloLarge: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255, 255, 255, 0.94)', alignItems: 'center', justifyContent: 'center' },
  nativeMapMarkerRouteDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#ffffff' },
  nativeMapMarkerPlaceDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ffffff', backgroundColor: '#e05a3f' },
  detailRouteExternalLink: { fontSize: 12.5, color: '#1f63c7', fontWeight: '700', textDecorationLine: 'underline' },
  routeMapStatusText: { fontSize: 13.5, fontWeight: '700', color: '#20304c', marginTop: 8 },
  mapFullscreenFallback: { alignItems: 'center', justifyContent: 'center', padding: 26, gap: 8 },
  // ── Редизайн карточки места (Карточка места.dc) ──
  detailHero: { position: 'relative', height: 440, backgroundColor: '#e8f1f8', overflow: 'hidden' },
  detailHeroFallback: { height: 440, backgroundColor: '#dce8f4' },
  detailHeroGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 104 },
  detailHeroTopRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  detailHeroTopActions: { flexDirection: 'row', gap: 8 },
  detailHeroCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  detailHeroBackGlyph: { color: '#20304c', fontSize: 22, fontWeight: '800', marginTop: -2 },
  detailHeroTitleRow: { position: 'absolute', left: 20, right: 112, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  detailHeroTitle: { color: '#ffffff', fontSize: 32, fontWeight: '900', flexShrink: 1 },
  detailHeroDots: { position: 'absolute', right: 20, bottom: 30, flexDirection: 'row', gap: 5 },
  detailHeroDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  detailHeroDotActive: { width: 16, backgroundColor: '#ffffff' },
  detailBody: { paddingHorizontal: 20, paddingTop: 16, gap: 15 },
  detailStatsStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#f5f7fb',
    borderWidth: 1,
    borderColor: '#e3e9f1',
    borderRadius: 16,
    paddingVertical: 12
  },
  detailStatsCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 0, paddingHorizontal: 4 },
  detailStatsDivider: { width: 1, backgroundColor: '#e3e9f1', marginVertical: 2 },
  detailStatsValue: { fontSize: 14, fontWeight: '900' },
  detailStatsStar: { color: '#f5a623' },
  detailStatsCaption: { color: '#8493a8', fontSize: 10.5, fontWeight: '700' },
  detailBadgeScroll: { marginHorizontal: -20 },
  detailBadgeRow: { paddingHorizontal: 20, gap: 7, flexDirection: 'row', alignItems: 'center' },
  detailBadgeGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff7e5',
    borderWidth: 1,
    borderColor: '#f2d58a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10
  },
  detailBadgeGoldIcon: { width: 16, height: 16 },
  detailBadgeGoldText: { color: '#7a5c14', fontSize: 12, fontWeight: '800' },
  detailInfoRows: { backgroundColor: '#f5f7fb', marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 5 },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#e3e9f1' },
  detailInfoRowLast: { borderBottomWidth: 0 },
  detailInfoRowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eef4fb', alignItems: 'center', justifyContent: 'center' },
  detailInfoRowGlyph: { fontSize: 16, color: '#1f63c7' },
  detailInfoRowText: { flex: 1, color: '#102a43', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  detailPaddedSection: { paddingHorizontal: 20, paddingTop: 15, gap: 9 },
  detailSectionHeading: { color: '#102a43', fontSize: 18, fontWeight: '900' },
  detailSimilarSection: { backgroundColor: '#f5f7fb', marginTop: 16, paddingVertical: 13 },
  detailSimilarScroll: { marginTop: 10 },
  detailSimilarRow: { paddingHorizontal: 20, gap: 10, flexDirection: 'row' },
  detailSimilarCard: { width: 150, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e9f1', borderRadius: 16, overflow: 'hidden' },
  detailSimilarImage: { width: '100%', height: 84, backgroundColor: '#e8f1f8' },
  detailSimilarImageFallback: { backgroundColor: '#dce8f4' },
  detailSimilarBody: { paddingHorizontal: 11, paddingVertical: 9, gap: 2 },
  detailSimilarTitle: { color: '#102a43', fontSize: 13, fontWeight: '800' },
  detailSimilarMeta: { color: '#62748b', fontSize: 11.5, fontWeight: '700' },
  detailHowToSection: { marginTop: 16 },
  detailHowToHeader: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  detailHowToMeta: { color: '#e05a3f', fontSize: 13, fontWeight: '800' },
  detailMapFullNew: { marginTop: 10, overflow: 'hidden' },
  detailBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderTopWidth: 1,
    borderTopColor: '#e3e9f1',
    paddingHorizontal: 16,
    paddingTop: 12
  },
  detailBottomCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f63c7',
    borderRadius: 15,
    minHeight: 50
  },
  detailBottomCtaText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  offlineBanner: { backgroundColor: '#b3442e', paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' },
  offlineBannerText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  mapWarmup: { position: 'absolute', top: -10, left: -10, width: 1, height: 1, opacity: 0 },
  mapWarmupMap: { width: 1, height: 1 },
  clusterBubble: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 6,
    backgroundColor: '#1f63c7',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  clusterBubbleText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  mapControlButtonActive: { borderWidth: 2, borderColor: '#1f63c7' },
  // ── Строки списка категории (Прототип Твой гид.dc) ──
  listRow: {
    flexDirection: 'row',
    gap: 14,
    marginLeft: -14,
    // Compensates the parent containers' gap:10 so divider rows sit flush like a list
    marginVertical: -5,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f6',
    backgroundColor: '#ffffff'
  },
  listRowImage: { width: 120, minHeight: 150, alignSelf: 'stretch', backgroundColor: '#e8f1f8' },
  listRowImageFallback: { backgroundColor: '#dce8f4' },
  listRowBody: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 7, paddingVertical: 14, paddingRight: 2 },
  listRowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listRowTitle: { flex: 1, color: '#102a43', fontSize: 16, fontWeight: '900' },
  listRowBadge: { width: 28, height: 28 },
  listRowFact: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  listRowFactText: { flex: 1, color: '#35507a', fontSize: 13, fontWeight: '700' },
  listRowBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listRowRating: { color: '#102a43', fontSize: 13, fontWeight: '800' },
  // ── Шапка категории (Прототип Твой гид.dc) ──
  categoryHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryBackPill: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 8, flexShrink: 0 },
  categoryBackPillText: { color: '#102a43', fontWeight: '800', fontSize: 14 },
  categoryHeaderTitle: { flex: 1, minWidth: 0, textAlign: 'center', color: '#102a43', fontSize: 18, fontWeight: '900' },
  categoryHeaderCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ee', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cuisineChipsScroll: { marginHorizontal: -14, marginTop: 12 },
  cuisineChipsRow: { paddingHorizontal: 14, gap: 8, flexDirection: 'row' },
  cuisineChip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e9f1', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  cuisineChipActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  cuisineChipText: { color: '#35507a', fontSize: 13, fontWeight: '700' },
  cuisineChipTextActive: { color: '#ffffff', fontWeight: '800' },
  categoryTabsRow: { flexDirection: 'row', marginTop: 12, marginHorizontal: -14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#e3e9f1' },
  categoryTab: { flex: 1, alignItems: 'center', paddingTop: 2, paddingBottom: 11, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  categoryTabActive: { borderBottomColor: '#1f63c7' },
  categoryTabText: { color: '#8493a8', fontSize: 14, fontWeight: '700' },
  categoryTabTextActive: { color: '#102a43', fontWeight: '900' },
  categoryLocateNote: { color: '#62748b', fontSize: 12.5, fontWeight: '600', marginTop: 10, lineHeight: 17 },
  categoryMapFloatWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  categoryMapFloatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#102a43',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#0b2b57',
    shadowOpacity: 0.36,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7
  },
  categoryMapFloatText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  categoryMapCountChip: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#0b2b57',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5
  },
  categoryMapCountText: { color: '#102a43', fontSize: 13, fontWeight: '800' },
  mapFullscreenRoot: { flex: 1, backgroundColor: '#e8f1f8' },
  mapFullscreenClose: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 8
  },
  mapFullscreenCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 6,
    shadowColor: '#0b2b57',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12
  },
  mapFullscreenError: { fontSize: 13.5, color: '#b3442e', fontWeight: '600', lineHeight: 19 },
  mapFullscreenLinksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 },
  nativeMapFlat: { width: '100%', overflow: 'hidden', backgroundColor: '#e8f1f8', justifyContent: 'center' },
  // ── Новый визуал (дизайн «Карта места») ──
  detailHeroChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(16, 42, 67, 0.55)' },
  detailHeroChipText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  detailPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 11, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e9f1' },
  detailPillText: { color: '#35507a', fontSize: 13, fontWeight: '700' },
  nativeMapPinMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e05a3f',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e05a3f',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6
  },
  nativeMapUserRing: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(31, 99, 199, 0.26)', alignItems: 'center', justifyContent: 'center' },
  nativeMapUserDotNew: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#1f63c7', borderWidth: 3, borderColor: '#ffffff' },
  nativeMapPopupThumb: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#dfe7f0' },
  nativeMapPopupMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  nativeMapPopupDistance: { color: '#e05a3f', fontSize: 11, fontWeight: '800' },
  nativeMapPopupDot: { color: '#c2ccda', fontSize: 11 },
  mapControlsColumn: { position: 'absolute', right: 16, gap: 11, zIndex: 8 },
  mapControlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  mapZoomPanel: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  mapZoomButton: { width: 42, height: 41, alignItems: 'center', justifyContent: 'center' },
  mapZoomDivider: { height: 1, backgroundColor: '#e6ecf4' },
  sheetHandleZone: { paddingTop: 2, paddingBottom: 10, alignItems: 'center' },
  sheetHandle: { width: 40, height: 5, borderRadius: 999, backgroundColor: '#dce3ec' },
  sheetLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  sheetLoadingText: { color: '#20304c', fontSize: 16, fontWeight: '800' },
  modeSwitcher: { flexDirection: 'row', backgroundColor: '#eef2f7', borderRadius: 15, padding: 4, marginBottom: 12 },
  modeSegment: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 7, borderRadius: 11 },
  modeSegmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#102a43',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  modeSegmentLabel: { fontSize: 11, fontWeight: '700', color: '#8493a8', marginTop: 1 },
  modeSegmentLabelActive: { color: '#1f63c7', fontWeight: '800' },
  modeSegmentTime: { fontSize: 10, fontWeight: '700', color: '#9aa7b8' },
  modeSegmentTimeActive: { color: '#1f63c7' },
  sheetSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetModeChip: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center' },
  sheetSummaryTitle: { color: '#102a43', fontSize: 19, fontWeight: '900', lineHeight: 23 },
  sheetSummarySub: { color: '#62748b', fontSize: 13, fontWeight: '700', marginTop: 2 },
  sheetStepsScroll: { maxHeight: 250, marginTop: 12, borderTopWidth: 1, borderTopColor: '#eef1f6', paddingTop: 6 },
  sheetStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7 },
  sheetStepIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#eef4fb', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  sheetStepText: { flex: 1, color: '#20304c', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  sheetStepDist: { color: '#8493a8', fontSize: 12, fontWeight: '800', marginTop: 2 },
  sheetStepsToggle: { color: '#1f63c7', fontSize: 13, fontWeight: '800', marginTop: 10 },
  sheetActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetGoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f63c7',
    paddingVertical: 13,
    borderRadius: 14
  },
  sheetGoButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  sheetShareButton: { width: 52, borderRadius: 14, borderWidth: 1, borderColor: '#dbe3ee', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  nativeMapEmptyTitle: { color: '#102a43', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  nativeMapEmptyText: { color: '#62748b', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center', marginTop: 6, paddingHorizontal: 18 },
  nativeMapPopup: { position: 'absolute', left: 12, right: 12, bottom: 12, minHeight: 58, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#102a43', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  nativeMapPopupTitle: { color: '#102a43', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  nativeMapPopupText: { color: '#62748b', fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  nativeMapPopupButton: { minHeight: 36, borderRadius: 12, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  nativeMapPopupButtonText: { color: '#ffffff', fontSize: 11, lineHeight: 14, fontWeight: '900' },

  categoryContent: { flex: 1, backgroundColor: '#ffffff' },
  categoryContentInner: { paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 16, paddingBottom: 92, gap: 10, backgroundColor: '#ffffff' },
  categoryToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 },
  categoryToolbarTitle: { flex: 1, color: '#102a43', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  categoryBackButton: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#d8e0ea', shadowColor: '#2b405f', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4 },
  categoryBackGlyph: { color: '#1f63c7', fontSize: 34, lineHeight: 36, fontWeight: '500', marginTop: -2 },
  categoryFilterIcon: { color: '#1f63c7', fontSize: 19, lineHeight: 22, fontWeight: '900' },
  filterBadge: { position: 'absolute', right: -4, top: -4, minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', paddingHorizontal: 4 },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  restaurantListNative: { gap: 0 },

  bulletinContentInner: { paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 18 : 18 },
  bulletinToolbar: { alignItems: 'center' },
  bulletinSearchBar: { flex: 1, minHeight: 42, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(214, 223, 235, 0.94)', backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  bulletinSearchIcon: { color: '#62748b', fontSize: 16, fontWeight: '900' },
  bulletinSearchInput: { flex: 1, minHeight: 40, color: '#102a43', fontSize: 13, fontWeight: '700', padding: 0 },
  bulletinClearButton: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf3fb' },
  bulletinClearText: { color: '#50627a', fontSize: 20, lineHeight: 22, fontWeight: '800' },
  bulletinPostButton: { minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', marginTop: 2 },
  bulletinPostText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  myBulletinsBlock: { gap: 8, padding: 12, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e0ea' },
  myBulletinsTitle: { color: '#102a43', fontSize: 15, fontWeight: '900' },
  myBulletinCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#edf3fb' },
  myBulletinTitle: { color: '#102a43', fontSize: 14, fontWeight: '800' },
  myBulletinStatus: { color: '#62748b', fontSize: 12, fontWeight: '800', marginTop: 2 },
  myBulletinNote: { color: '#8f1d1d', fontSize: 12, lineHeight: 16, marginTop: 4 },
  myBulletinDeleteButton: { minHeight: 34, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#ffd1d1' },
  myBulletinDeleteText: { color: '#8f1d1d', fontSize: 12, fontWeight: '900' },
  bulletinMosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  bulletinMosaicCard: { width: '48.8%', minHeight: 92, overflow: 'hidden', borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e9f2', padding: 12, justifyContent: 'space-between' },
  bulletinMosaicCardActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  bulletinMosaicOrb: { position: 'absolute', right: -16, top: -18, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(31, 99, 199, 0.10)' },
  bulletinMosaicText: { color: '#102a43', fontSize: 15, lineHeight: 18, fontWeight: '900', marginTop: 44 },
  bulletinMosaicTextActive: { color: '#ffffff' },
  bulletinQuickRow: { gap: 8, paddingVertical: 2 },
  bulletinQuickButton: { minHeight: 34, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: '#d8e0ea', backgroundColor: '#ffffff', justifyContent: 'center' },
  bulletinQuickButtonActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  bulletinQuickText: { color: '#52667f', fontSize: 12, fontWeight: '900' },
  bulletinQuickTextActive: { color: '#ffffff' },
  bulletinFeedHead: { paddingTop: 4, paddingBottom: 2 },
  bulletinFeedTitle: { color: '#102a43', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  bulletinPostSheet: { maxHeight: '82%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#ffffff' },
  bulletinPostSheetContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 18 + ANDROID_NAVIGATION_BAR_INSET, gap: 10 },
  bulletinPostInput: { minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: '#d8e0ea', backgroundColor: '#ffffff', paddingHorizontal: 13, color: '#102a43', fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  bulletinPostInputMultiline: { minHeight: 104, paddingTop: 12, paddingBottom: 12 },
  bulletinPhotoHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bulletinPhotoTitle: { color: '#102a43', fontSize: 15, fontWeight: '900' },
  bulletinAddPhotoButton: { minHeight: 34, borderRadius: 13, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  bulletinAddPhotoText: { color: '#1f63c7', fontSize: 12, fontWeight: '900' },
  bulletinPhotoRow: { gap: 8, paddingRight: 6 },
  bulletinPhotoThumbWrap: { width: 84, height: 84, borderRadius: 16, overflow: 'hidden', backgroundColor: '#dce8f4' },
  bulletinPhotoThumb: { width: '100%', height: '100%' },
  bulletinRemovePhotoButton: { position: 'absolute', right: 5, top: 5, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9, 19, 38, 0.70)' },
  bulletinRemovePhotoText: { color: '#ffffff', fontSize: 18, lineHeight: 20, fontWeight: '900' },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 19, 38, 0.36)' },
  modalBackdropTouch: { ...StyleSheet.absoluteFillObject },
  filterSheet: { maxHeight: '74%', paddingHorizontal: 16, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#ffffff', gap: 14 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterSheetTitle: { color: '#102a43', fontSize: 22, fontWeight: '900' },
  filterSheetMeta: { color: '#6c7b90', fontSize: 12, fontWeight: '800', marginTop: 3 },
  filterCloseButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  filterCloseText: { color: '#102a43', fontSize: 24, lineHeight: 26, fontWeight: '700' },
  filterGroupLabel: { color: '#62748b', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  filterChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  filterChipActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  filterChipText: { color: '#4e6078', fontSize: 12, fontWeight: '900' },
  filterChipTextActive: { color: '#ffffff' },
  filterSheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  filterResetButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  filterResetText: { color: '#51647d', fontSize: 14, fontWeight: '900' },
  filterApplyButton: { flex: 1.2, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7' },
  filterApplyText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },

  routesIntroCard: { position: 'relative', overflow: 'hidden', borderRadius: 24, backgroundColor: '#1f63c7', paddingHorizontal: 20, paddingVertical: 18 },
  routesIntroEyebrow: { color: '#ffffff', opacity: 0.82, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  routesIntroTitle: { color: '#ffffff', fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 8 },
  routesIntroText: { color: '#edf5ff', fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 8 },
  routesList: { gap: 0, backgroundColor: '#ffffff' },
  routeListRow: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  routeListIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' },
  routeListIconText: { color: '#1f63c7', fontSize: 24, lineHeight: 28, fontWeight: '900' },
  routeListTitle: { color: '#102a43', fontSize: 15.5, lineHeight: 19, fontWeight: '900' },
  routeListSubtitle: { color: '#62748b', fontSize: 12.5, lineHeight: 17, fontWeight: '600', marginTop: 4 },
  routeMetaRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  routeMetaPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: '#eef4fb', color: '#1f63c7', fontSize: 10.5, fontWeight: '900' },
  routeChevron: { color: '#9aaabd', fontSize: 28, lineHeight: 30, fontWeight: '500' },
  routeDetailHero: { borderRadius: 24, backgroundColor: '#1f63c7', paddingHorizontal: 20, paddingVertical: 18 },
  routeDetailEyebrow: { color: '#edf5ff', opacity: 0.85, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  routeDetailTitle: { color: '#ffffff', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 8 },
  routeDetailText: { color: '#edf5ff', fontSize: 13.5, lineHeight: 20, fontWeight: '700', marginTop: 10 },
  routeDetailBlock: { paddingVertical: 4, gap: 9 },
  routeBlockTitle: { color: '#102a43', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  routeSeeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routeSeeDot: { color: '#1f63c7', fontSize: 18, lineHeight: 20, fontWeight: '900' },
  routeSeeText: { flex: 1, color: '#62748b', fontSize: 13.5, lineHeight: 20, fontWeight: '700' },
  routePointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  routePointIndex: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7' },
  routePointIndexText: { color: '#ffffff', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  routePointTitle: { color: '#102a43', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  routePointText: { color: '#62748b', fontSize: 12.5, lineHeight: 18, fontWeight: '700', marginTop: 3 },
  routeMapCard: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', padding: 14, gap: 12 },
  routeMapButton: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', paddingHorizontal: 12 },
  routeMapButtonText: { color: '#ffffff', fontSize: 13, lineHeight: 17, fontWeight: '900', textAlign: 'center' },

  programsHeroCard: { position: 'relative', overflow: 'hidden', borderRadius: 24, backgroundColor: '#1f63c7', paddingHorizontal: 22, paddingVertical: 20, alignItems: 'center' },
  programsList: { gap: 10 },
  programCard: { padding: 16, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f2', shadowColor: '#293d5d', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  programCardStay: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(31, 99, 199, 0.10)', color: '#1f63c7', fontSize: 11, fontWeight: '900' },
  programCardTitle: { color: '#102a43', fontSize: 18, lineHeight: 22, fontWeight: '900', marginTop: 10 },
  programCardText: { color: '#607086', fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 6 },
  programCardAction: { color: '#1f63c7', fontSize: 13, fontWeight: '900', marginTop: 12 },

  authModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 19, 38, 0.36)' },
  authSheet: { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#ffffff' },
  authSheetContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 18 + ANDROID_NAVIGATION_BAR_INSET, gap: 10 },
  authSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 4 },
  authSheetTitle: { color: '#102a43', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  authSheetText: { color: '#5e7088', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 5, maxWidth: 270 },
  authCloseButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  authCloseText: { color: '#102a43', fontSize: 24, lineHeight: 26, fontWeight: '700' },
  authNotice: { padding: 12, borderRadius: 16, backgroundColor: '#fff8e7', borderWidth: 1, borderColor: '#f0dfb8' },
  authNoticeText: { color: '#80611c', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  authProviderButton: { minHeight: 62, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  authProviderButtonDisabled: { opacity: 0.48 },
  authProviderBrand: { width: 38, height: 38, borderRadius: 14, overflow: 'hidden', backgroundColor: '#eaf3ff', color: '#1f63c7', textAlign: 'center', textAlignVertical: 'center', fontSize: 17, lineHeight: 38, fontWeight: '900' },
  authProviderTitle: { color: '#102a43', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  authProviderSub: { color: '#62748b', fontSize: 11.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  authLegalText: { color: '#62748b', fontSize: 11.5, lineHeight: 17, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
  authLegalTextLink: { color: '#1f63c7', fontWeight: '900', textDecorationLine: 'underline' },
  authLegalLinks: { paddingHorizontal: 4, gap: 8 },
  authLegalLinkText: { color: '#1f63c7', fontSize: 12.5, lineHeight: 17, fontWeight: '900', textDecorationLine: 'underline' },
  profileBlock: { minHeight: 76, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  profileAvatar: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', overflow: 'hidden' },
  profileAvatarImage: { width: 46, height: 46 },
  profileAvatarText: { color: '#ffffff', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  profileName: { color: '#102a43', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  profileEmail: { color: '#62748b', fontSize: 11.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  profileLogoutButton: { minHeight: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5fa', paddingHorizontal: 12 },
  profileLogoutText: { color: '#1f63c7', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  profileNotificationRow: { minHeight: 82, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  profileNotificationTitle: { color: '#102a43', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  profileNotificationText: { color: '#62748b', fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 4 },
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
  tabText: { color: '#62748b', fontWeight: '800', fontSize: 10.5, lineHeight: 12, marginTop: 0 },
  activeTabText: { color: '#1f63c7' }
});
