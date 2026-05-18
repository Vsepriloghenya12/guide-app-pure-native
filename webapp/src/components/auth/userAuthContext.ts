import { createContext, useContext } from 'react';
import type { PublicAuthProviderId, PublicAuthProviders, PublicAuthSession } from '../../types';

export type UserAuthFeedback = {
  tone: 'success' | 'error';
  message: string;
} | null;

export type UserAuthContextValue = {
  session: PublicAuthSession;
  loading: boolean;
  isSheetOpen: boolean;
  feedback: UserAuthFeedback;
  openSheet: () => void;
  closeSheet: () => void;
  clearFeedback: () => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  buildProviderStartPath: (provider: Extract<PublicAuthProviderId, 'google' | 'apple'>, returnTo?: string) => string;
  buildTelegramCallbackPath: (returnTo?: string) => string;
};

export const emptyAuthProviders: PublicAuthProviders = {
  google: false,
  apple: false,
  telegram: false,
  telegramBotUsername: ''
};

export const emptyAuthSession: PublicAuthSession = {
  authenticated: false,
  user: null,
  providers: emptyAuthProviders
};

export const UserAuthContext = createContext<UserAuthContextValue | null>(null);

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error('useUserAuth must be used within UserAuthProvider');
  }
  return context;
}
