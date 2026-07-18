---
name: eas-build
description: Сборка мобильного приложения через EAS — тестовый APK, production AAB для Play Market, iOS preview. Использовать при задачах про сборку APK/AAB/IPA, версии приложения и EAS-переменные.
---

# EAS-сборки мобильного приложения

Все команды выполняются из папки `mobile/` (или через корневые npm-скрипты).

## Команды

- Тестовый Android APK: `cd mobile && eas build -p android --profile preview --clear-cache` (или `npm run android:apk` из корня).
- Production AAB для Play Market: `cd mobile && eas build -p android --profile production --clear-cache`.
- iOS preview/ad hoc: `cd mobile && eas build -p ios --profile preview --clear-cache` (или `npm run ios:preview`).

## Перед сборкой

1. `cd mobile && npx tsc --noEmit` — типы чистые.
2. `cd mobile && npx expo-doctor` — без критичных предупреждений.
3. Проверить версии в `mobile/app.config.js`: `version` (marketing) и `android.versionCode` — versionCode обязательно инкрементить для Play Market.
4. EAS/Expo переменные для нужного environment (preview/production):
   - `EXPO_PUBLIC_API_BASE_URL` — URL Railway backend (есть fallback на прод в коде).
   - `EXPO_PUBLIC_MAP_TILE_URL` — растровые тайлы; НЕ использовать tile.openstreetmap.org напрямую в APK.
   - `EXPO_PUBLIC_TELEGRAM_BOT_ID` — для Telegram-входа.
   - `EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=true` + google-services.json — только если push реально настроен (FCM).
   Локально те же значения — в `mobile/.env`.

## Идентификаторы

- Android package: `com.realone14.guideappnativeconnected`
- iOS bundle: `com.danangguide.app`
- EAS projectId: `5d3c1adc-6568-443d-9eb1-b1a829d388ec`
- Deep link scheme: `danangguide://` (должен совпадать с `NATIVE_ANDROID_PACKAGE` и auth-возвратом на сервере).

## История граблей

Смотри отчёты в `docs/` (LOCKFILE_FIX_V22, MESTO_V11/V12_BUILD_FIX и др.) — там решения прошлых проблем сборки: рассинхрон package-lock, крэши Android, entry point Expo.
