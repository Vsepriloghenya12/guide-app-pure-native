import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'danang-guide-auth-token';
const AUTH_USER_KEY = 'danang-guide-auth-user';
// SecureStore forbids some characters that are fine in AsyncStorage keys
const SECURE_TOKEN_KEY = 'danang_guide_auth_token';

// The session token lives in the OS keystore (encrypted at rest, excluded from
// device backups); the non-sensitive cached user profile stays in AsyncStorage.
// Reads fall back to the legacy AsyncStorage slot once, migrate the value and
// wipe the plaintext copy — existing logins survive the upgrade.
async function readSecureToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    if (token) return token;
  } catch {
    // keystore unavailable (rare vendor quirk) — fall through to legacy slot
  }

  const legacy = String((await AsyncStorage.getItem(AUTH_TOKEN_KEY)) || '').trim();
  if (!legacy) return null;
  try {
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, legacy);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // migration failed — keep serving the legacy copy rather than logging out
  }
  return legacy;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function toText(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function decodeUtf8Bytes(bytes: number[]) {
  let result = '';
  let index = 0;

  while (index < bytes.length) {
    const first = bytes[index++];

    if (first < 0x80) {
      result += String.fromCharCode(first);
      continue;
    }

    if (first >= 0xc0 && first < 0xe0 && index < bytes.length) {
      const second = bytes[index++];
      result += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
      continue;
    }

    if (first >= 0xe0 && first < 0xf0 && index + 1 < bytes.length) {
      const second = bytes[index++];
      const third = bytes[index++];
      result += String.fromCharCode(((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f));
      continue;
    }

    if (first >= 0xf0 && first < 0xf8 && index + 2 < bytes.length) {
      const second = bytes[index++];
      const third = bytes[index++];
      const fourth = bytes[index++];
      const codePoint = ((first & 0x07) << 18) | ((second & 0x3f) << 12) | ((third & 0x3f) << 6) | (fourth & 0x3f);
      const offset = codePoint - 0x10000;
      result += String.fromCharCode(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
      continue;
    }
  }

  return result;
}

function decodeBase64Fallback(value: string) {
  const cleanValue = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (let index = 0; index < cleanValue.length; index += 1) {
    const char = cleanValue.charAt(index);
    if (char === '=') break;

    const code = BASE64_ALPHABET.indexOf(char);
    if (code < 0) continue;

    buffer = (buffer << 6) | code;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return decodeUtf8Bytes(bytes);
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
      try {
        return globalThis.atob(padded);
      } catch {
        return decodeBase64Fallback(padded);
      }
    }
  }

  return decodeBase64Fallback(padded);
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

export async function saveAuthToken(token: string) {
  const normalized = String(token || '').trim();
  if (!normalized) return;

  try {
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, normalized);
  } catch {
    // keystore unavailable — degrade to AsyncStorage so login still works
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, normalized);
  }

  const user = readUserFromAuthToken(normalized);
  if (user) {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
}

export async function getAuthToken() {
  const token = await readSecureToken();
  const normalized = String(token || '').trim();
  return normalized || null;
}

export async function clearAuthToken() {
  try {
    await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
  } catch {
    // nothing stored securely — fine
  }
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
}

export async function getCachedAuthUser() {
  const userFromToken = readUserFromAuthToken(await getAuthToken());
  if (userFromToken) return userFromToken;

  try {
    const savedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    return parsedUser && typeof parsedUser === 'object' ? parsedUser as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function getAuthUserAvatarUrl(user: Record<string, unknown> | null) {
  return toText(user?.avatarUrl || user?.picture || user?.photoUrl || user?.photo_url);
}
