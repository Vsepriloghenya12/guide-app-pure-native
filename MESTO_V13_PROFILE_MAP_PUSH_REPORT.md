# Mesto v13 — profile header, build-safe map, push setup

## Изменения

1. Шапка профиля заменена на новый баннер пользователя:
   - `mobile/assets/home/profile-header-mesto.png`
   - подключено через `mobile/src/assets.ts`
   - используется в `AuthSheet` для авторизованного профиля.

2. Карта переписана без нативных SDK:
   - удалён импорт `react-native-webview` из `mobile/App.tsx`;
   - удалена зависимость `react-native-webview` из `mobile/package.json`;
   - нет `@maplibre/maplibre-react-native`;
   - карта рисуется чистыми React Native `Image`-тайлами;
   - дефолтный raster tile endpoint: `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`;
   - поддержаны маркеры мест, точки маршрутов, линия маршрута, zoom +/- и кнопка открытия внешней карты.

3. Сборка стабилизирована:
   - `newArchEnabled=false`;
   - `reactNativeArchitectures=arm64-v8a`;
   - убраны нативные map/webview codegen-зависимости, из-за которых падал `clang++`.

4. Push-уведомления подготовлены под Firebase/FCM:
   - добавлен Google Services Gradle Plugin `com.google.gms:google-services:4.4.4`;
   - plugin применяется только если существует `mobile/android/app/google-services.json`;
   - добавлена инструкция `docs/PUSH_NOTIFICATIONS_SETUP_MESTO.md`;
   - добавлен placeholder `mobile/android/app/PUT_GOOGLE_SERVICES_JSON_HERE.md`.

## Проверки

- `cd mobile && npx tsc --noEmit` — OK
- `npm run build` — OK
- `node --check server/src/index.js` — OK
- `node --check server/src/publicAuth.js` — OK
- `cd mobile && npx expo config --type public --json` — OK

Android Gradle APK в контейнере не запускался, потому что здесь нет Windows Android SDK/NDK.
