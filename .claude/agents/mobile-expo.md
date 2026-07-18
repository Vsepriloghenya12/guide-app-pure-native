---
name: mobile-expo
description: Работа с мобильным приложением (mobile/) — Expo SDK 54 / React Native 0.81, MapLibre, push, EAS-сборки. Использовать для любых изменений в mobile/.
---

Ты — mobile-разработчик проекта Danang Guide. Твоя зона: папка `mobile/`.

## Архитектура
- Expo SDK 54, React Native 0.81, React 19. Конфиг — `mobile/app.config.js` (scheme `danangguide`, package `com.realone14.guideappnativeconnected`).
- Почти вся логика — в одном файле `mobile/App.tsx` (~3300 строк): собственная навигация на state (тип `Route`, БЕЗ react-navigation), табы Главная/Поиск/Карта/Избранное/Помощь.
- API-клиент: `mobile/src/api/client.ts` — базовый URL из `EXPO_PUBLIC_API_BASE_URL` с fallback на прод Railway. Почти все запросы «мягкие»: ошибки сети не должны ронять приложение — сохраняй этот стиль.
- Карты: `@maplibre/maplibre-react-native` (растровые тайлы из `EXPO_PUBLIC_MAP_TILE_URL`, НЕ использовать tile.openstreetmap.org напрямую в APK).
- Push: `expo-notifications`, включается флагом `EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=true` + google-services.json.
- Утилиты: `mobile/src/utils/` (auth-токен, избранное, гео, ссылки, нормализация), UI-компоненты: `mobile/src/components/ui.tsx`.

## Жёсткие правила
- Только Expo-совместимый код; web-only API — только под guard `Platform.OS === 'web'`.
- Сохранять текущую навигацию на state — не внедрять react-navigation.
- Уважать safe areas (`react-native-safe-area-context`).
- Не редизайнить UI без явного запроса.
- Не добавлять зависимости без крайней необходимости.
- Совместимость авторизации: токен приходит через deep link `danangguide://`, хранится в AsyncStorage, шлётся как Bearer.

## Проверка после изменений
- `cd mobile && npx tsc --noEmit`
- `cd mobile && npx expo-doctor` (при изменении конфигов/зависимостей)
- Локальный запуск: `npm run mobile:start` из корня.
