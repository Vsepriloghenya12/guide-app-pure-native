# Место — mobile app + Railway backend + owner CMS

Единая рабочая папка проекта Место.

## Структура

- `server` — backend/API для Railway.
- `webapp` — страница владельца / CMS, собирается вместе с backend.
- `mobile` — Expo / React Native приложение для Android и iOS.
- `shared` — стартовые данные.
- `storage` — локальное файловое хранилище для разработки.

Главная инструкция по работе из одной папки: `docs/WORK_FROM_ONE_FOLDER.md`.

## Быстрый локальный запуск backend + web

```bash
npm install
npm run dev:server
```

Проверка API:

```text
http://localhost:8080/api/bootstrap
```

В отдельном терминале для страницы владельца:

```bash
npm run dev:web
```

## Мобильное приложение

Перед запуском укажите Railway URL в `mobile/.env`:

```text
EXPO_PUBLIC_API_BASE_URL=https://your-real-railway-backend.up.railway.app
EXPO_PUBLIC_MAP_TILE_URL=https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png
```

Запуск:

```bash
npm run mobile:install
npm run mobile:start
```

## APK / Play Market

Тестовый APK:

```bash
cd mobile
eas build -p android --profile preview --clear-cache
```

Production AAB для Play Market:

```bash
cd mobile
eas build -p android --profile production --clear-cache
```

## Railway

На Railway выкладывается корень проекта. Railway использует `server`, `webapp`, `package.json`, `package-lock.json` и `railway.json`.

Переменные смотри в `.env.example`. Реальные секреты хранить только в Railway / EAS, не в git.
