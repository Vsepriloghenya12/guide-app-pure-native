# Da Nang Guide — Pure Native Mobile

Это версия проекта без web-frontend, Capacitor, Vite, PWA, service worker и generated Android WebView-обёртки.

Архитектура:

- `mobile/` — чистое мобильное приложение на Expo / React Native.
- `server/` — Express API для Railway.
- `shared/` — единый seed-контент, который использует и backend, и mobile fallback.
- `storage/` — локальное fallback-хранилище для backend.

## Что уже перенесено в native

- Главная.
- Разделы.
- Список мест.
- Детальная карточка места.
- Поиск.
- Избранное через native storage.
- Раздел «Рядом» через native location permission.
- Контакты и экстренные номера.
- Открытие телефонов, сайтов и карт через native Linking.
- Offline seed fallback, если API временно недоступен.

## Что намеренно не включено

- `webapp/`.
- Capacitor.
- PWA/offline HTML.
- Web CSS.
- Browser APIs: `window`, `document`, `localStorage`.
- Owner CMS как web-интерфейс.

Owner API на backend сохранён. Для полноценной нативной админки нужно делать отдельный owner-раздел в React Native или оставить CMS как отдельный защищённый web-инструмент.

## Локальный запуск backend

```bash
npm install
cp .env.example .env
npm run dev:server
```

## Локальный запуск mobile

```bash
cd mobile
cp .env.example .env
# в .env указать Railway или локальный backend:
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8080
npm install
npm run start
```

Для теста на физическом телефоне нельзя использовать `localhost` как API URL, потому что телефон будет искать backend на самом себе. Используйте IP компьютера в локальной сети или Railway URL.

## Android build

```bash
cd mobile
npm install
npm run prebuild
npm run android
```

Для production-сборки лучше использовать EAS Build.

## Railway backend

Railway запускает только API-сервер:

```bash
npm run build
npm run start
```

Backend больше не пытается отдавать `webapp/dist`.
