import { useMemo } from 'react';
import { useUserAuth } from './userAuthContext';

type UserAuthTriggerProps = {
  variant?: 'hero' | 'topbar';
};

function getInitials(displayName: string) {
  const parts = displayName
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((item) => item[0]?.toUpperCase() || '').join('') || 'U';
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12.8A4.4 4.4 0 1 0 12 4a4.4 4.4 0 0 0 0 8.8Zm0 2.2c-4.16 0-7.54 2.34-7.54 5.22 0 .43.35.78.78.78h13.52c.43 0 .78-.35.78-.78 0-2.88-3.38-5.22-7.54-5.22Z"
      />
    </svg>
  );
}

export function UserAuthTrigger({ variant = 'topbar' }: UserAuthTriggerProps) {
  const { session, openSheet } = useUserAuth();

  const initials = useMemo(
    () => (session.user?.displayName ? getInitials(session.user.displayName) : 'U'),
    [session.user?.displayName]
  );

  return (
    <button
      type="button"
      className={`user-auth-trigger user-auth-trigger--${variant}${session.authenticated ? ' is-authenticated' : ''}`}
      onClick={openSheet}
      aria-label={session.authenticated ? `Профиль: ${session.user?.displayName || 'пользователь'}` : 'Вход или регистрация'}
    >
      <span className="user-auth-trigger__avatar" aria-hidden="true">
        {session.authenticated && session.user?.avatarUrl ? (
          <img src={session.user.avatarUrl} alt="" loading="lazy" decoding="async" />
        ) : session.authenticated ? (
          <span className="user-auth-trigger__initials">{initials}</span>
        ) : (
          <UserIcon />
        )}
      </span>
    </button>
  );
}
