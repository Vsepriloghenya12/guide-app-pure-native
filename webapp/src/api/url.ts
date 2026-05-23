const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/g, '');

export const API_BASE_URL = rawApiBaseUrl;

export function buildApiUrl(input: string): string {
  const value = String(input || '').trim();

  if (!value) {
    return API_BASE_URL || '/';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const path = value.startsWith('/') ? value : `/${value}`;
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export function buildAuthUrl(input: string): string {
  return buildApiUrl(input);
}
