# Native migration status

## Итог

Проект переведён из web/Capacitor-подхода в отдельную Expo / React Native структуру.

## Удалено из рабочей базы

- `webapp/`.
- Vite-конфигурация.
- React DOM.
- React Router DOM.
- Capacitor Android shell.
- PWA manifest / service worker / offline HTML.
- Web CSS и CSS-классы.
- Generated native build artifacts.
- `.env`, `.git`, логи, `node_modules`, `dist`, build-кэши.

## Проверки

- В проекте нет строк `Capacitor`, `Vite`, `webapp`, `react-dom`, `react-router-dom`, `window`, `document`, `localStorage`, `className`.
- `server/src/index.js` проходит `node -c`.
- `server/src/publicAuth.js` проходит `node -c`.
- Root `npm run build:server` проходит.
- TypeScript/TSX syntax мобильного кода проверен через TypeScript transpile diagnostics.

## Текущий функционал mobile

- Public app: главная, разделы, список, детали, поиск, избранное, nearby, контакты.
- Избранное хранится в `@react-native-async-storage/async-storage`.
- Геолокация использует `expo-location`.
- Внешние ссылки открываются через React Native `Linking`.
- Данные загружаются из `/api/bootstrap` и `/api/support-content`.
- Если API недоступен, используется `shared/default-guide-content.json`.

## Ограничения первой native-итерации

- Owner CMS не перенесён в mobile UI.
- Google/Apple/Telegram login flow пока сохранён на backend, но не интегрирован как полноценный native OAuth/deep-link flow.
- Интерактивная карта в приложении заменена на native-переходы в карты. Для встроенной карты можно добавить `react-native-maps` отдельной итерацией.

## Следующий этап

1. Добавить native-auth: Apple Sign In / Google Sign-In / Telegram login с deep links.
2. Решить, нужна ли нативная owner-админка внутри приложения.
3. Добавить EAS config для App Store / Google Play.
4. Добавить production app icons/splash под финальный бренд.
5. Подключить push notifications, если нужны уведомления.
