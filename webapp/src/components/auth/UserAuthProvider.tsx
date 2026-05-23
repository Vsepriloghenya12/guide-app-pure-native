import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { buildAuthUrl } from '../../api/url';
import { PublicAuthSheet } from './PublicAuthSheet';
import { emptyAuthSession, UserAuthContext, type UserAuthFeedback } from './userAuthContext';

function buildCurrentReturnTo(pathname: string, search: string, hash: string) {
  return `${pathname}${search}${hash}`;
}

function providerLabel(provider: string) {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'apple':
      return 'Apple';
    case 'telegram':
      return 'Telegram';
    default:
      return 'аккаунт';
  }
}

export function UserAuthProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const [session, setSession] = useState(emptyAuthSession);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [feedback, setFeedback] = useState<UserAuthFeedback>(null);

  const refreshSession = useCallback(async () => {
    try {
      const nextSession = await api.authSession();
      setSession({
        authenticated: nextSession.authenticated,
        user: nextSession.user,
        providers: nextSession.providers
      });
    } catch {
      setSession(emptyAuthSession);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authState = params.get('auth');
    if (!authState) {
      return;
    }

    const provider = providerLabel(params.get('provider') || '');
    const message = params.get('message');
    if (authState === 'success') {
      setFeedback({ tone: 'success', message: `Вход через ${provider} выполнен.` });
      setIsSheetOpen(false);
      void refreshSession();
    } else if (authState === 'error') {
      setFeedback({ tone: 'error', message: message || `Не удалось войти через ${provider}.` });
      setIsSheetOpen(true);
    }

    params.delete('auth');
    params.delete('provider');
    params.delete('message');
    const nextSearch = params.toString();
    const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [location.hash, location.pathname, location.search, refreshSession]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const buildProviderStartPath = useCallback(
    (provider: 'google' | 'apple', returnTo = buildCurrentReturnTo(location.pathname, location.search, location.hash)) =>
      buildAuthUrl(`/api/auth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`),
    [location.hash, location.pathname, location.search]
  );

  const buildTelegramCallbackPath = useCallback(
    (returnTo = buildCurrentReturnTo(location.pathname, location.search, location.hash)) =>
      buildAuthUrl(`/api/auth/telegram/callback?returnTo=${encodeURIComponent(returnTo)}`),
    [location.hash, location.pathname, location.search]
  );

  const logout = useCallback(async () => {
    await api.authLogout();
    setFeedback({ tone: 'success', message: 'Вы вышли из аккаунта.' });
    setSession(emptyAuthSession);
    await refreshSession();
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      session,
      loading,
      isSheetOpen,
      feedback,
      openSheet: () => setIsSheetOpen(true),
      closeSheet: () => setIsSheetOpen(false),
      clearFeedback: () => setFeedback(null),
      refreshSession,
      logout,
      buildProviderStartPath,
      buildTelegramCallbackPath
    }),
    [buildProviderStartPath, buildTelegramCallbackPath, feedback, isSheetOpen, loading, logout, refreshSession, session]
  );

  return (
    <UserAuthContext.Provider value={value}>
      {children}
      <PublicAuthSheet />
    </UserAuthContext.Provider>
  );
}
