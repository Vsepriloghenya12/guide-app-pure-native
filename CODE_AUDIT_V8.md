# Code audit v8

Дата: 2026-06-06

## Что исправлено после v7

1. Карта возвращена на исходный рабочий API MapLibre v11: `Map`, `GeoJSONSource`, `Layer`, `Camera`. Ошибка `Element type is invalid ... got: undefined` возникала из-за несовместимой переделки карты на v10-компоненты `MapView/ShapeSource/LineLayer/CircleLayer` при текущей сборке.
2. `@maplibre/maplibre-react-native` возвращён на `^11.3.2`, как в исходной рабочей базе проекта.
3. `newArchEnabled=true` возвращён в `mobile/android/gradle.properties`, потому что MapLibre v11 работает через New Architecture.
4. OpenStreetMap volunteer tiles (`tile.openstreetmap.org`) не используются в APK: fallback и env-примеры оставлены на Carto Voyager tiles.
5. Telegram native auth flow из v7 сохранён: мобильная кнопка открывает `/api/auth/telegram/native?returnTo=danangguide:///auth`, а не Google flow.
6. `mobile/package-lock.json` очищен от internal registry URLs после локальной проверки.

## Проверки

- `npm run build` — OK
- `cd mobile && npx tsc --noEmit` — OK
- `cd mobile && npx expo config --type public --json` — OK

Android Gradle APK в контейнере не запускался: здесь нет Windows Android SDK/NDK. Для локальной сборки на ПК сначала удалить старые кэши `android/app/.cxx`, `android/app/build`, `android/build`, затем собирать release APK.
