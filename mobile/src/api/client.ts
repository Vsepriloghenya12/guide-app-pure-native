import type { BootstrapPayload, SupportContentStore } from '../types';
import { normalizeBootstrap, normalizeSupportContent } from '../utils/normalizers';
import { getAuthToken } from '../utils/auth';

const rawApiBaseUrl = String(process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/g, '');
export const API_BASE_URL = rawApiBaseUrl.includes('your-app.up.railway.app') || rawApiBaseUrl.includes('your-railway-backend') ? '' : rawApiBaseUrl;

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
