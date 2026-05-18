# v15 — Android crash/auth/maps fixes

## Что исправлено

- Карточка места и экран карты стали устойчивее к неправильным координатам: если в CMS случайно перепутали lat/lng, приложение пробует исправить порядок; невалидные координаты не передаются в нативную карту.
- Google/Telegram авторизация теперь возвращает пользователя обратно в приложение через deep link `danangguide://auth`, а не на web-версию.
- Сервер теперь принимает native session token через `Authorization: Bearer ...`, поэтому мобильное приложение может быть авторизовано после внешнего OAuth-входа.
- Telegram вход теперь открывает отдельную страницу `/api/auth/telegram/start`, а не ошибочный прямой callback.
- В Android-карту добавлены стандартный тип карты и loading-состояния.

## Важно для Google Login

Для текущего backend OAuth-flow нужен именно OAuth Client типа **Web application**.

Authorized redirect URI должен быть:

```text
https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/auth/google/callback
```

На Railway должны быть переменные:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
PUBLIC_APP_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
AUTH_SESSION_SECRET=long-random-secret
```

Если сделать Android OAuth Client вместо Web OAuth Client, Google может показать ошибку “доступ заблокирован / недопустимый запрос”.

## Важно для Telegram Login

На Railway должны быть переменные:

```text
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=your_bot_username
```

Без `@` в `TELEGRAM_BOT_USERNAME` тоже допустимо.

## Важно для Google Map

В Expo EAS для environment `preview` должны быть plain text переменные:

```text
EXPO_PUBLIC_API_BASE_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

Переменные с `EXPO_PUBLIC_` нельзя делать Secret, они должны быть Plain text.

После изменения ключа или Railway URL APK нужно пересобрать:

```bash
cd mobile
eas build -p android --profile preview --clear-cache
```

Если карта остаётся синей, обычно причина вне кода: не включён Maps SDK for Android, не подключён Billing, ключ не попал в EAS build, ключ ограничен не тем package/SHA-1, или установлен старый APK.
