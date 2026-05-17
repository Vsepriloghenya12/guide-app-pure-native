import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'guide-native-favorites-v1';

export async function loadFavoriteSlugs(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveFavoriteSlugs(slugs: string[]) {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(new Set(slugs))));
}
