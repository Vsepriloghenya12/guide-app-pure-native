import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'danang-guide-auth-token';

export async function saveAuthToken(token: string) {
  const normalized = String(token || '').trim();
  if (!normalized) return;
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, normalized);
}

export async function getAuthToken() {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function clearAuthToken() {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

function decodeBase64Url(value: string) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4 || 4)) % 4)}`;

  if (typeof globalThis.atob === 'function') {
    try {
      return decodeURIComponent(
        Array.prototype.map
          .call(globalThis.atob(padded), (char: string) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join('')
      );
    } catch {
      return globalThis.atob(padded);
    }
  }

  return '';
}

export function readUserFromAuthToken(token: string | null): Record<string, unknown> | null {
  const [encodedPayload] = String(token || '').split('.');
  if (!encodedPayload) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload));
    if (!payload?.user || typeof payload.user !== 'object') return null;

    const exp = Number(payload.exp);
    if (Number.isFinite(exp) && exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload.user as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getCachedAuthUser() {
  return readUserFromAuthToken(await getAuthToken());
}
