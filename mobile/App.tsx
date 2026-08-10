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
import { styles, retheme } from './src/theme/styles';
import { useLivingTheme } from './src/theme/useLivingTheme';
import { HomeScreen, SectionsScreen, SearchScreen, FavoritesScreen, NearbyScreen, ContactsScreen, CategoryScreen, RoutesScreen, RouteDetailScreen, ProgramsScreen, TipsScreen, DetailScreen, WelcomeScreen, AuthSheet, BottomTabs } from './src/screens';

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
  const theme = useLivingTheme();
    retheme(theme);
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
      <StatusBar translucent barStyle={theme.bucket === 'sunset' || theme.bucket === 'evening' || theme.bucket === 'night' ? 'light-content' : 'dark-content'} backgroundColor="transparent" />
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

