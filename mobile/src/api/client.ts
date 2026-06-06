import Constants from 'expo-constants';
import type { BootstrapPayload, GuidePlace, SupportContentStore } from '../types';
import { normalizeBootstrap, normalizeSupportContent } from '../utils/normalizers';
import { getAuthToken } from '../utils/auth';

const DEFAULT_API_BASE_URL = 'https://guide-app-pure-native-production.up.railway.app';
const configuredApiBaseUrl = String(
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  Constants.manifest2?.extra?.expoClient?.extra?.apiBaseUrl ||
  DEFAULT_API_BASE_URL
);
const rawApiBaseUrl = configuredApiBaseUrl.replace(/\/+$/g, '');
export const API_BASE_URL = rawApiBaseUrl.includes('your-app.up.railway.app') || rawApiBaseUrl.includes('your-railway-backend') ? DEFAULT_API_BASE_URL : rawApiBaseUrl;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  const authToken = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : typeof data?.error === 'string' ? data.error : 'Request failed';
    throw new Error(message);
  }

  return data as T;
}

export async function fetchBootstrap(): Promise<BootstrapPayload> {
  try {
    const data = await requestJson<{ ok: true } & BootstrapPayload>('/api/bootstrap');
    return normalizeBootstrap(data);
  } catch {
    return normalizeBootstrap(null);
  }
}

export async function fetchSupportContent(): Promise<SupportContentStore> {
  try {
    const data = await requestJson<{ ok: true; content: SupportContentStore }>('/api/support-content');
    return normalizeSupportContent(data.content);
  } catch {
    return normalizeSupportContent(null);
  }
}

export async function sendAnalytics(kind: string, label: string, path: string, entityId?: string, categoryId?: string) {
  if (!API_BASE_URL) return;
  try {
    await requestJson('/api/analytics', {
      method: 'POST',
      body: JSON.stringify({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind,
        label,
        path,
        entityId,
        categoryId,
        createdAt: new Date().toISOString()
      })
    });
  } catch {
    // Analytics must never block the native app.
  }
}

export async function fetchAuthSession() {
  if (!API_BASE_URL) return { ok: false, authenticated: false, user: null, providers: {} };
  try {
    return await requestJson<{ ok: boolean; authenticated: boolean; user: unknown; providers: Record<string, unknown> }>('/api/auth/session');
  } catch {
    return { ok: false, authenticated: false, user: null, providers: {} };
  }
}

export async function logoutAuthSession() {
  if (!API_BASE_URL) return;
  try {
    await requestJson('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  } catch {
    // Logout must never block local token cleanup.
  }
}

export async function deleteAuthProfile() {
  return requestJson<{ ok: boolean; deleted?: { profile: boolean; favorites: number; bulletins: number; sessions: number; files: number } }>('/api/me/profile', {
    method: 'DELETE'
  });
}

export type NotificationSettings = {
  promotionsEnabled: boolean;
  hasPushToken: boolean;
};

function normalizeNotificationSettings(data: { promotions_enabled?: unknown; promotionsEnabled?: unknown; has_push_token?: unknown; hasPushToken?: unknown } | null): NotificationSettings {
  return {
    promotionsEnabled: Boolean(data?.promotions_enabled ?? data?.promotionsEnabled),
    hasPushToken: Boolean(data?.has_push_token ?? data?.hasPushToken)
  };
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (!API_BASE_URL) return { promotionsEnabled: false, hasPushToken: false };
  try {
    const data = await requestJson<{ ok: boolean; promotions_enabled?: boolean; has_push_token?: boolean }>('/api/me/notification-settings');
    return normalizeNotificationSettings(data);
  } catch {
    return { promotionsEnabled: false, hasPushToken: false };
  }
}

export async function registerPushToken(payload: { fcmToken: string; platform: 'ios' | 'android' | 'unknown'; promotionsEnabled: boolean }) {
  return requestJson<{ ok: boolean }>('/api/me/push-token', {
    method: 'POST',
    body: JSON.stringify({
      fcm_token: payload.fcmToken,
      token_type: 'fcm',
      platform: payload.platform,
      promotions_enabled: payload.promotionsEnabled
    })
  });
}

export async function updateNotificationSettings(promotionsEnabled: boolean): Promise<NotificationSettings> {
  const data = await requestJson<{ ok: boolean; promotions_enabled?: boolean; has_push_token?: boolean }>('/api/me/notification-settings', {
    method: 'PATCH',
    body: JSON.stringify({ promotions_enabled: promotionsEnabled })
  });
  return normalizeNotificationSettings(data);
}

export async function reportBulletin(targetId: string, reason: 'spam' | 'illegal' | 'offensive' | 'misleading' | 'other', comment = '') {
  return requestJson<{ ok: boolean; report?: { id: string; duplicate?: boolean }; message?: string }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify({
      targetType: 'bulletin',
      targetId,
      reason,
      comment
    })
  });
}

export async function fetchHiddenAuthors() {
  if (!API_BASE_URL) return [];
  try {
    const data = await requestJson<{ ok: boolean; hiddenAuthorIds?: string[] }>('/api/me/hidden-authors');
    return Array.isArray(data.hiddenAuthorIds) ? data.hiddenAuthorIds : [];
  } catch {
    return [];
  }
}

export async function hideBulletinAuthor(targetId: string) {
  const data = await requestJson<{ ok: boolean; hiddenAuthorIds?: string[] }>('/api/me/hidden-authors', {
    method: 'POST',
    body: JSON.stringify({ targetId })
  });
  return Array.isArray(data.hiddenAuthorIds) ? data.hiddenAuthorIds : [];
}

export async function fetchAuthStartUrl(provider: 'google' | 'apple' | 'telegram', returnTo: string, authNonce: string) {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  const searchParams = new URLSearchParams({
    returnTo,
    mode: 'native',
    source: 'mobile',
    format: 'json',
    authNonce,
    provider
  });

  if (provider === 'telegram') {
    searchParams.set('prefer', 'oauth');
    searchParams.set('forceProvider', 'telegram');
  }

  const data = await requestJson<{ ok: boolean; provider?: string; url?: string }>(`/api/auth/${provider}/start?${searchParams.toString()}`);
  const returnedProvider = String(data.provider || provider).trim().toLowerCase();
  const url = String(data.url || '').trim();
  if (returnedProvider && returnedProvider !== provider) {
    throw new Error(`Auth provider mismatch: expected ${provider}, got ${returnedProvider}.`);
  }
  if (!url) {
    throw new Error('Auth provider did not return a start URL.');
  }
  if (provider === 'telegram' && /accounts\.google\.com|google\.com\/o\/oauth|auth\/google|provider=google/i.test(url)) {
    throw new Error('Server returned a Google URL for Telegram login. Deploy the updated backend and check Telegram environment variables.');
  }

  return url;
}

export async function submitBulletinListing(payload: Record<string, unknown>) {
  return requestJson<{ ok: boolean; listing?: unknown; message?: string }>('/api/bulletin-submissions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchMyBulletinListings() {
  if (!API_BASE_URL) return [];
  const data = await requestJson<{ ok: boolean; listings?: GuidePlace[] }>('/api/me/bulletins');
  return Array.isArray(data.listings) ? data.listings : [];
}

export async function deleteMyBulletinListing(id: string) {
  return requestJson<{ ok: boolean; deletedId?: string }>(`/api/me/bulletins/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}
