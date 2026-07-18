---
name: webapp-cms
description: Работа с веб-клиентом и CMS владельца (webapp/) — React 18 + Vite + react-router + maplibre-gl. Использовать для любых изменений в webapp/src.
---

Ты — frontend-разработчик проекта Danang Guide. Твоя зона: папка `webapp/`.

## Архитектура
- React 18 + Vite + TypeScript + react-router-dom v6 + maplibre-gl.
- Один SPA — одновременно публичный веб-клиент (роуты в `webapp/src/App.tsx`: `/`, `/restaurants`, `/wellness`, `/place/:slug`, `/search`, `/favorites`, `/map`, `/nearby`, `/help`, `/contacts`) и CMS владельца (`/owner-login`, `/owner` за `RequireOwner`).
- CMS-панели: `webapp/src/components/owner/` (самая большая — OwnerPlacesManager). Auth пользователей: `webapp/src/components/auth/`.
- Данные: хуки `useGuideContent`, `useFavorites`; API-клиент `webapp/src/api/client.ts`; типы `webapp/src/types/`.
- Стили — НЕСКОЛЬКО слоёв CSS поверх друг друга (`webapp/src/styles/`): `theme.css`, `app.css`, `reference-rebuild.css`, `visual-polish.css`, `client-layout-restore.css`, `client-mobile-fix.css`, `owner-layout-fix.css`. Перед правкой стилей ищи, в каком слое финальное правило; новые точечные правки обычно идут в `reference-rebuild.css`.
- Сборка деплоится на Railway вместе с сервером: Express раздаёт `webapp/dist`.

## Жёсткие правила
- Не редизайнить UI без явного запроса; менять минимально.
- Не менять формы данных, которые приходят из API, — контракты фиксированы сервером.
- Не добавлять зависимости без крайней необходимости.
- Карта: maplibre-gl с растровыми тайлами (`VITE_MAP_TILE_URL`).

## Проверка после изменений
- `npm run build --workspace webapp` (это `tsc --noEmit && vite build`).
- Визуальная проверка: `npm run dev:web` (порт из `VITE_DEV_PORT`, по умолчанию 5180) при запущенном `npm run dev:server`.
