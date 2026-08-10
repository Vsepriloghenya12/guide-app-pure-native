import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from '../api/client';
import { openExternalUrl } from './links';
import { filterTextMap, legalBaseUrl, ANDROID_STATUS_BAR_INSET, ANDROID_NAVIGATION_BAR_INSET } from '../data/constants';
import type { Route } from '../types/app';
import type { GuideCategory } from '../types';

export function useMobileInsets() {
  const insets = useSafeAreaInsets();
  return {
    top: Math.max(insets.top, ANDROID_STATUS_BAR_INSET),
    bottom: Math.max(insets.bottom, ANDROID_NAVIGATION_BAR_INSET)
  };
}

export function toText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return toText(record.title || record.name || record.label || record.text || record.value, fallback);
  }
  return fallback;
}

export function toTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }
  const textValue = toText(value);
  if (!textValue) return [];
  return textValue.split(/\n|,/g).map((item) => item.trim()).filter(Boolean);
}

export function normalizeToken(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function getFilterDisplayText(value: string) {
  const normalized = normalizeToken(value);
  return filterTextMap[normalized] || value;
}

export function positiveModulo(value: number, divisor: number) {
  if (!divisor) return 0;
  return ((value % divisor) + divisor) % divisor;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function contactUrlFromText(value: string) {
  const contact = value.trim();
  if (!contact) return '';
  if (/^https?:\/\//i.test(contact)) return contact;
  if (/^(t.me|telegram.me)\//i.test(contact)) return `https://${contact}`;
  if (contact.startsWith('@') && contact.length > 1) return `https://t.me/${contact.slice(1)}`;
  const digits = contact.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

export function normalizeBulletinSection(value: unknown) {
  const text = toText(value, 'Разное');
  const normalized = normalizeToken(text);
  if (!normalized || normalized.includes('аренд')) return 'Разное';
  return text;
}

export function bulletinStatusLabel(status?: string) {
  if (status === 'published') return 'Опубликовано';
  if (status === 'hidden') return 'Не прошло модерацию';
  return 'На модерации';
}

export function routeKey(route: Route) {
  if (route.name === 'tabs') return `tabs:${route.tab}`;
  if (route.name === 'category') return `category:${route.categoryId}`;
  if (route.name === 'routeDetail') return `routeDetail:${route.routeId}`;
  if (route.name === 'detail') return `detail:${route.slug}`;
  return route.name;
}

export function fallbackBackRoute(route: Route): Route | null {
  if (route.name === 'routeDetail') return { name: 'routes' };
  if (route.name === 'category' || route.name === 'routes' || route.name === 'programs' || route.name === 'tips' || route.name === 'detail') {
    return { name: 'tabs', tab: 'home' };
  }
  if (route.name === 'tabs' && route.tab !== 'home') {
    return { name: 'tabs', tab: 'home' };
  }
  return null;
}

export function isAuthDeepLink(url: string | null) {
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

export function parseDeepLinkParams(url: string) {
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
        accumulator[key] = decodeURIComponent(rawValue.replace(/ + /g, ' '));
      }
      return accumulator;
    }, {});
}

export function normalizeBannerLink(value: unknown) {
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

export function isExternalBannerLink(value: string) {
  return /^(https?:|mailto:|tel:|tg:|telegram:|whatsapp:|geo:|maps:)/i.test(value);
}

export function dedupeHomeCategories(categories: GuideCategory[]) {
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

export function legalPageUrl(path: string) {
  return legalBaseUrl ? `${legalBaseUrl}${path}` : '';
}

export function openLegalPage(path: string) {
  return openExternalUrl(legalPageUrl(path));
}

export function getApiOriginForAuth() {
  const raw = API_BASE_URL.replace(/\/api\/?$/i, '').replace(/\/+$/g, '');
  return raw || API_BASE_URL;
}

export function buildTelegramNativeLoginUrl(returnTo: string, authNonce = '') {
  const origin = getApiOriginForAuth();
  const searchParams = new URLSearchParams({
    returnTo,
    mode: 'native',
    source: 'mobile'
  });
  if (authNonce) searchParams.set('authNonce', authNonce);
  return `${origin}/api/auth/telegram/native?${searchParams.toString()}`;
}

// ── Push-уведомления ──
export function getExpoProjectId() {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return Constants.easConfig?.projectId || extra?.eas?.projectId || '';
}

export function isPushTokenRegistrationEnabled() {
  const extra = Constants.expoConfig?.extra as { pushNotificationsEnabled?: boolean | string } | undefined;
  return extra?.pushNotificationsEnabled === true || String(extra?.pushNotificationsEnabled || '').toLowerCase() === 'true';
}

export function notificationPlatform(): 'ios' | 'android' | 'unknown' {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return 'unknown';
}

export async function getPromotionPushToken(): Promise<string> {
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
      throw new Error('Не удалось получить push-токен из-за сетевой ошибки. Проверьте интернет на телефоне и настройки Firebase/FCM для этой сборки.');
    }
    throw error;
  }
}

export function getPromotionListingIdFromNotification(response: Notifications.NotificationResponse | null) {
  const data = response?.notification?.request?.content?.data || {};
  if (data?.type !== 'promotion') return '';
  return String(data?.listing_id || data?.listingId || '').trim();
}