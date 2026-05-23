import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useUserAuth } from '../components/auth/userAuthContext';

const FAVORITES_KEY = 'guide-app-favorites-v2';

function readFavorites() {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const { session } = useUserAuth();
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>(() => readFavorites());
  const loadedServerFavoritesFor = useRef<string | null>(null);
  const skipNextServerSync = useRef(false);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteSlugs));
  }, [favoriteSlugs]);

  useEffect(() => {
    const userId = session.user?.id || null;
    if (!session.authenticated || !userId || loadedServerFavoritesFor.current === userId) {
      return;
    }

    let cancelled = false;
    loadedServerFavoritesFor.current = userId;

    api.userFavorites()
      .then((response) => {
        if (cancelled) {
          return;
        }

        const merged = Array.from(new Set([...readFavorites(), ...response.slugs]));
        skipNextServerSync.current = true;
        setFavoriteSlugs(merged);

        if (merged.length !== response.slugs.length || merged.some((slug) => !response.slugs.includes(slug))) {
          void api.saveUserFavorites(merged).catch(() => undefined);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [session.authenticated, session.user?.id]);

  useEffect(() => {
    if (!session.authenticated || !session.user?.id) {
      loadedServerFavoritesFor.current = null;
      return;
    }

    if (skipNextServerSync.current) {
      skipNextServerSync.current = false;
      return;
    }

    void api.saveUserFavorites(favoriteSlugs).catch(() => undefined);
  }, [favoriteSlugs, session.authenticated, session.user?.id]);

  const isFavorite = useCallback(
    (slug: string) => favoriteSlugs.includes(slug),
    [favoriteSlugs]
  );

  const toggleFavorite = useCallback((slug: string) => {
    setFavoriteSlugs((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]
    );
  }, []);

  return useMemo(
    () => ({ favoriteSlugs, isFavorite, toggleFavorite }),
    [favoriteSlugs, isFavorite, toggleFavorite]
  );
}
