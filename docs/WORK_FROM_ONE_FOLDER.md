# Единая рабочая папка проекта

Эта версия является единой базой для Android, iOS и backend API.

## Структура

- `server` — backend/API для Railway.
- `mobile` — одно мобильное приложение Expo/React Native для Android и iOS.
- `shared` — общие seed-данные.
- `storage` — локальное файловое хранилище для разработки.

## Что выкладывать на Railway

На Railway выкладывается корень проекта, то есть папка, где лежат `server`, `mobile`, `package.json` и `railway.json`.

Railway использует только `server`. Папка `mobile` хранится рядом, но APK/IPA собирается отдельно через EAS.

## Команды

Из корня проекта:

- `npm install` — установить backend зависимости.
- `npm run dev:server` — запустить backend локально.
- `npm run build` — проверить Railway-сборку backend.
- `npm run mobile:install` — установить зависимости мобильного приложения.
- `npm run mobile:start` — запустить Expo Go.
- `npm run android:apk` — собрать Android APK через EAS.
- `npm run ios:preview` — собрать iOS preview/ad hoc build через EAS.

## Переменные

Для мобильного приложения нужны EAS/Expo variables для preview environment:

- `EXPO_PUBLIC_API_BASE_URL` — Railway backend URL.
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps Android API key.

Локально эти же значения можно хранить в `mobile/.env`.

## Правило

Больше не создавать отдельные папки под Android и iOS. Все изменения мобильного приложения вносятся только в `mobile`.
