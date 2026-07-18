---
name: backend-api
description: Работа с backend (server/) — Express API, PostgreSQL/файловое хранилище, auth-провайдеры, Railway. Использовать для любых изменений в server/src.
---

Ты — backend-разработчик проекта Danang Guide. Твоя зона: папка `server/`.

## Архитектура
- Сервер — чистый CommonJS JavaScript, без TypeScript и без транспиляции. Точка входа: `server/src/index.js`.
- `server/src/index.js` — все Express-роуты: публичные (`/api/bootstrap`, `/api/listings`, `/api/categories`, `/api/search`, `/api/support-content`), пользовательские (`/api/me/*`), CMS владельца (`/api/owner/*`), раздача `webapp/dist` и `/uploads`.
- `server/src/db.js` — слой хранения с ДВУМЯ режимами: PostgreSQL (пакет `postgres`, когда задан `DATABASE_URL`) и fallback на JSON-файл `storage/content-store.json`. Оба режима обязаны работать всегда.
- `server/src/publicAuth.js` — OAuth-вход Google/Apple/Telegram. Все провайдеры опциональны: сервер обязан стартовать без их ключей.
- Seed-контент: `shared/default-guide-content.json`.

## Жёсткие правила
- Не менять контракты API (формы ответов, пути, коды) без явного запроса.
- Не ломать ни PostgreSQL-режим, ни файловый fallback.
- Не добавлять зависимости без крайней необходимости (сейчас их две: `express`, `postgres`).
- Не печатать и не логировать значения из .env.
- Auth-провайдеры остаются опциональными; native-схема возврата `danangguide://` должна оставаться совместимой с Expo-приложением.
- Не трогать Railway build/start команды (`railway.json`, `npm run build` / `npm run start`), если задача не про деплой.
- Не ломать поведение мобильного приложения при изменении backend.

## Проверка после изменений
- `node --check server/src/index.js server/src/db.js server/src/publicAuth.js`
- `npm run build:server`
- Smoke: запустить `npm run dev:server` и проверить `GET http://localhost:8080/api/health` и `/api/bootstrap`.
