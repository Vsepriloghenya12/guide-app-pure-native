# Как подключить backend и APK

## Что находится в проекте

- `server` — backend/API для Railway.
- `mobile` — чистое мобильное приложение Expo/React Native для APK.

## 1. Локальный запуск backend

В корне проекта:

```bash
npm install
npm run dev:server
```

Проверка backend:

```text
http://localhost:8080/api/bootstrap
```

## 2. Railway backend

На Railway нужно задеплоить корень проекта. Railway будет выполнять:

```bash
npm run build
npm run start
```

После деплоя backend будет доступен по адресу Railway. Например:

```text
https://your-real-railway-backend.up.railway.app
```

Проверка:

```text
https://your-real-railway-backend.up.railway.app/api/bootstrap
```

## 3. Обязательные Railway переменные

В Railway Variables нужно добавить:

```text
NODE_ENV=production
OWNER_PASSWORD=ваш_пароль_владельца
OWNER_SESSION_SECRET=длинная_случайная_строка
AUTH_SESSION_SECRET=другая_длинная_случайная_строка
PUBLIC_APP_URL=https://your-real-railway-backend.up.railway.app
UPLOADS_DIR=/data/uploads
NATIVE_APP_MODE=true
COOKIE_SECURE=true
COOKIE_SAME_SITE=Lax
```

Если подключена PostgreSQL база, Railway сам даст `DATABASE_URL`.

## 4. Подключить APK к backend

Перед сборкой APK в файле `mobile/.env` нужно указать реальный Railway URL:

```text
EXPO_PUBLIC_API_BASE_URL=https://your-real-railway-backend.up.railway.app
EXPO_PUBLIC_MAP_TILE_URL=https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png
```

Если `mobile/.env` нет — скопируйте `mobile/.env.example` в `mobile/.env` и замените значения.

После изменения `.env` нужно пересобрать APK:

```bash
cd mobile
eas build -p android --profile preview --clear-cache
```

## 5. Установка APK

После сборки EAS даст ссылку. Откройте ссылку на Android-телефоне, скачайте APK и установите.

## 6. Как обновлять контент без пересборки APK

APK подтягивает данные с backend, поэтому APK пересобирать не нужно, если меняется только серверный контент или база.

APK нужно пересобирать, если меняется код приложения, карта, разрешения, иконка, splash screen или native-зависимости.
