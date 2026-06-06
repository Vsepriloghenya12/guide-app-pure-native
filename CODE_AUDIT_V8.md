# Code Audit V8

## Изменение после ошибки уведомлений

Проблема на телефоне: при включении уведомлений показывалось `Network request failed`.

Причина: приложение пыталось получить Expo push token в Android APK без гарантированно подключённых Firebase/FCM credentials. В такой сборке `expo-notifications` может падать на сетевом/Firebase-этапе до сохранения токена на backend.

## Исправление

- Добавлен флаг `extra.pushNotificationsEnabled` в `mobile/app.config.js`.
- По умолчанию флаг выключен: `EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=false`.
- Пока Firebase/FCM не настроены, приложение не пытается получать push token и показывает понятное сообщение вместо сырого `Network request failed`.
- Добавлена обработка сетевых ошибок при получении push token.

## Проверки

- `npm ci --ignore-scripts` в root — OK.
- `npm run build` в root — OK.
- `cd mobile && npm ci --ignore-scripts` — OK.
- `cd mobile && npx tsc --noEmit` — OK.
- `cd mobile && npx expo config --type public --json` — OK, `extra.pushNotificationsEnabled=false` виден.
- `node --check server/src/index.js` — OK.
- `node --check server/src/publicAuth.js` — OK.

## Что нужно для настоящих Android push

Для реальных push-уведомлений нужно:

1. Firebase project.
2. Android app с package name `com.realone14.guideappnativeconnected`.
3. `google-services.json` в mobile-проекте.
4. `android.googleServicesFile` в Expo config.
5. FCM V1 credentials для Expo/EAS или отдельная отправка напрямую через FCM.
6. Сборка с `EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=true`.
