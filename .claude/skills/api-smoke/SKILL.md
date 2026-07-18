---
name: api-smoke
description: Быстрый smoke-тест backend API локально — запуск сервера и проверка ключевых эндпоинтов. Использовать после правок server/ или перед деплоем.
---

# Smoke-тест API

1. Запусти сервер в фоне: `npm run dev:server` (порт 8080, без DATABASE_URL работает файловый fallback на `storage/content-store.json` — это нормально для локали).
2. Дождись старта и проверь эндпоинты (curl или fetch):

| Эндпоинт | Ожидание |
|---|---|
| `GET /api/health` | `{ ok: true, ... }` |
| `GET /api/bootstrap` | JSON с `categories`, `places`, `collections`, `home` |
| `GET /api/support-content` | JSON с контентом помощи |
| `GET /api/listings?category=restaurants` | список мест |
| `GET /api/search?q=spa` | результаты поиска |
| `GET /api/auth/session` | `{ authenticated: false, providers: {...} }` без auth-ключей |
| `GET /` | HTML webapp (только если `webapp/dist` собран) |

3. Если менялась CMS-часть: `POST /api/owner/login` с dev-паролем `guide2026` (только NODE_ENV != production), затем `GET /api/owner/bootstrap` с полученной cookie.
4. Останови сервер после проверки.

Ошибки 500 или пустые categories/places при наличии `shared/default-guide-content.json` — признак поломки нормализации в `server/src/db.js`.
