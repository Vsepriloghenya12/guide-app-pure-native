import { TelegramLoginWidget } from './TelegramLoginWidget';
import { useUserAuth } from './userAuthContext';

function getInitials(displayName: string) {
  const parts = displayName
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((item) => item[0]?.toUpperCase() || '').join('') || 'U';
}

function GoogleIcon() {
  return <span className="public-auth-provider__brand public-auth-provider__brand--google" aria-hidden="true">G</span>;
}

function AppleIcon() {
  return (
    <span className="public-auth-provider__brand public-auth-provider__brand--apple" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M15.07 3.31c.77-.94 1.32-2.23 1.17-3.31-1.11.08-2.43.75-3.22 1.67-.72.81-1.37 2.11-1.19 3.32 1.24.1 2.47-.62 3.24-1.68ZM19.12 17.5c-.58 1.31-.85 1.9-1.6 3.03-1.06 1.59-2.56 3.58-4.42 3.6-1.65.02-2.07-1.07-4.31-1.05-2.24.01-2.71 1.07-4.36 1.05-1.86-.02-3.28-1.8-4.34-3.39-2.97-4.46-3.28-9.69-1.45-12.5 1.31-2.01 3.38-3.2 5.31-3.2 1.96 0 3.2 1.08 4.82 1.08 1.57 0 2.53-1.08 4.8-1.08 1.72 0 3.54.94 4.84 2.57-4.23 2.31-3.55 8.45.71 9.89Z"
        />
      </svg>
    </span>
  );
}

function TelegramIcon() {
  return (
    <span className="public-auth-provider__brand public-auth-provider__brand--telegram" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path fill="currentColor" d="m18.38 5.52-12.6 4.85c-.86.34-.85.82-.15 1.04l3.23 1 1.25 4c.15.42.08.59.52.59.34 0 .49-.15.68-.34l1.58-1.53 3.28 2.42c.6.33 1.03.16 1.18-.56l2.15-10.12c.22-.88-.34-1.28-.92-1.05ZM9.56 12.14l7.57-4.77c.38-.23.72-.11.43.15l-6.24 5.64-.24 2.59-1.52-3.61Z" />
      </svg>
    </span>
  );
}

export function PublicAuthSheet() {
  const {
    session,
    isSheetOpen,
    closeSheet,
    feedback,
    clearFeedback,
    logout,
    buildProviderStartPath,
    buildTelegramCallbackPath
  } = useUserAuth();

  if (!isSheetOpen) {
    return null;
  }

  const profileName = session.user?.displayName || 'Пользователь';

  return (
    <div className="modal-backdrop" role="presentation" onClick={closeSheet}>
      <div className="modal-window filter-modal public-auth-sheet" role="dialog" aria-modal="true" aria-labelledby="public-auth-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-window__header public-auth-sheet__header">
          <div>
            <strong id="public-auth-title">Профиль и вход</strong>
            <small>Сохраняйте аккаунт и входите через Telegram, Google или Apple.</small>
          </div>
          <button className="modal-window__close" type="button" onClick={closeSheet} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="modal-window__body public-auth-sheet__body">
          {feedback ? (
            <div className={`public-auth-feedback public-auth-feedback--${feedback.tone}`}>
              <span>{feedback.message}</span>
              <button type="button" onClick={clearFeedback} aria-label="Скрыть сообщение">
                ×
              </button>
            </div>
          ) : null}

          {session.authenticated && session.user ? (
            <section className="public-auth-profile-card">
              <div className="public-auth-profile-card__identity">
                <span className="public-auth-profile-card__avatar" aria-hidden="true">
                  {session.user.avatarUrl ? <img src={session.user.avatarUrl} alt="" loading="lazy" decoding="async" /> : getInitials(profileName)}
                </span>
                <div className="public-auth-profile-card__copy">
                  <strong>{profileName}</strong>
                  <span>{session.user.email || (session.user.username ? `@${session.user.username}` : 'Аккаунт подключён')}</span>
                  <small>Вход через {session.user.provider === 'google' ? 'Google' : session.user.provider === 'apple' ? 'Apple' : 'Telegram'}</small>
                </div>
              </div>

              <button className="travel-secondary-button public-auth-sheet__logout" type="button" onClick={() => void logout()}>
                Выйти
              </button>
            </section>
          ) : (
            <section className="public-auth-intro-card">
              <strong>Войдите, чтобы использовать персональные функции приложения.</strong>
              <p>Новый пользователь создаётся автоматически при первом входе через выбранную соцсеть.</p>
            </section>
          )}

          <section className="public-auth-provider-stack">
            <a
              className={`public-auth-provider${session.providers.google ? '' : ' is-disabled'}`}
              href={session.providers.google ? buildProviderStartPath('google') : undefined}
              aria-disabled={!session.providers.google}
              onClick={(event) => {
                if (!session.providers.google) {
                  event.preventDefault();
                }
              }}
            >
              <GoogleIcon />
              <span className="public-auth-provider__copy">
                <strong>Продолжить с Google</strong>
                <span>{session.providers.google ? 'Быстрый вход и регистрация' : 'Провайдер пока не настроен'}</span>
              </span>
            </a>

            <a
              className={`public-auth-provider${session.providers.apple ? '' : ' is-disabled'}`}
              href={session.providers.apple ? buildProviderStartPath('apple') : undefined}
              aria-disabled={!session.providers.apple}
              onClick={(event) => {
                if (!session.providers.apple) {
                  event.preventDefault();
                }
              }}
            >
              <AppleIcon />
              <span className="public-auth-provider__copy">
                <strong>Продолжить с Apple</strong>
                <span>{session.providers.apple ? 'Подходит для iPhone и Safari' : 'Провайдер пока не настроен'}</span>
              </span>
            </a>

            <div className={`public-auth-provider public-auth-provider--telegram-shell${session.providers.telegram ? '' : ' is-disabled'}`}>
              <div className="public-auth-provider__copy public-auth-provider__copy--telegram">
                <div className="public-auth-provider__heading">
                  <TelegramIcon />
                  <div>
                    <strong>Войти через Telegram</strong>
                    <span>{session.providers.telegram ? 'Официальный Telegram login widget' : 'Провайдер пока не настроен'}</span>
                  </div>
                </div>
              </div>

              {session.providers.telegram && session.providers.telegramBotUsername ? (
                <TelegramLoginWidget botUsername={session.providers.telegramBotUsername} authUrl={buildTelegramCallbackPath()} />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
