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
