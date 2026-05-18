# Danang Guide — native mobile + Railway backend + owner CMS

Проект состоит из трёх частей:

- `mobile` — чистое мобильное приложение Expo / React Native.
- `server` — backend/API для Railway.
- `webapp` — web-страница владельца/CMS, которая отдаётся backend после сборки.

Главный файл с пошаговым подключением: `CONNECT_AND_TEST.md`.

## Быстрый локальный запуск

```bash
npm install
npm run dev:server
```

Проверка API:

```text
http://localhost:8080/api/bootstrap
```

Во втором терминале для страницы владельца:

```bash
npm run dev:web
```

Страница владельца локально:

```text
http://127.0.0.1:5180/owner-login
```

Локальный пароль по умолчанию: `guide2026`.

## APK

Перед сборкой APK укажите реальный Railway URL в `mobile/.env`:

```text
EXPO_PUBLIC_API_BASE_URL=https://your-real-railway-backend.up.railway.app
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_android_api_key
```

Затем:

```bash
cd mobile
eas build -p android --profile preview --clear-cache
```
