# Danang Guide — native mobile + Railway backend

Проект состоит из двух частей:

- `mobile` — чистое мобильное приложение Expo / React Native.
- `server` — backend/API для Railway.

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
