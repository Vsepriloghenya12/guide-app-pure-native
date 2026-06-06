# FIX_TELEGRAM_MAP_V5

Дата: 2026-06-05

## Что исправлено

### Telegram авторизация

Мобильное приложение больше не запрашивает стартовую ссылку Telegram через общий JSON auth-start, чтобы не было сценария, когда сервер/кэш/старая сборка возвращает Google URL.

Теперь кнопка `Войти через Telegram` открывает отдельный route:

```text
/api/auth/telegram/native?returnTo=danangguide:///auth
```

На backend добавлен отдельный HTML-screen Telegram Login Widget. После подтверждения Telegram callback остаётся прежним:

```text
/api/auth/telegram/callback
```

Callback создаёт пользователя, session cookie и native session token, после чего возвращает пользователя в приложение по deep link `danangguide:///auth`.

Также `/api/auth/telegram/start` теперь для JSON и обычного открытия возвращает/редиректит только на `/api/auth/telegram/native`, а не на Google или общий webapp auth flow.

Railway должен быть обновлён этой server-версией. На Railway нужны:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...
AUTH_SESSION_SECRET=...
PUBLIC_APP_URL=https://guide-app-pure-native-production.up.railway.app
```

`TELEGRAM_BOT_ID` больше не обязателен для native flow, потому что используется Telegram Login Widget через bot username.

### Карта

Вернул нормальную native-карту на MapLibre:

```text
@maplibre/maplibre-react-native
```

Убрана временная картинка из tile Image, из-за которой OpenStreetMap показывал `403 Access blocked`.

Карта теперь снова работает как интерактивная native-карта. Источник тайлов по умолчанию:

```text
https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png
```

Это можно заменить через:

```env
EXPO_PUBLIC_MAP_TILE_URL=...
```

### Android-сборка

`newArchEnabled=false` оставлен, чтобы MapLibre не ломал локальную Gradle-сборку через CMake/codegen.

## Проверки

- `node --check server/src/publicAuth.js` — OK
- `node --check server/src/index.js` — OK
- `cd mobile && npx tsc --noEmit` — OK
- `npm run build --workspace server` — OK

Полный `npm run build` в среде ChatGPT не был завершён из-за таймаута Vite build, явной ошибки webapp не получено.
