import type { BootstrapPayload, SupportContentStore } from '../types';
import { normalizeBootstrap, normalizeSupportContent } from '../utils/normalizers';

const rawApiBaseUrl = String(process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/g, '');
export const API_BASE_URL = rawApiBaseUrl.includes('your-app.up.railway.app') || rawApiBaseUrl.includes('your-railway-backend') ? '' : rawApiBaseUrl;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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
