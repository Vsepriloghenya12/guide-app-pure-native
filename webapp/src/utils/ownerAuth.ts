import { buildApiUrl } from '../api/url';

async function ownerFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(input), {
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers
    },
    ...init
  });

  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };

  if (!response.ok) {
    throw new Error(payload?.message || 'Owner request failed');
  }

  return payload;
}

export async function getOwnerSession() {
  return ownerFetch<{ ok: true; authenticated: boolean }>('/api/owner/session');
}

export async function loginOwner(password: string) {
  return ownerFetch<{ ok: true; authenticated: boolean }>('/api/owner/login', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export async function logoutOwner() {
  return ownerFetch<{ ok: true }>('/api/owner/logout', {
    method: 'POST'
  });
}
