---
name: deploy-railway
description: Чек-лист и порядок деплоя backend + webapp на Railway. Использовать, когда нужно задеплоить, проверить готовность к деплою или разобраться с переменными окружения Railway.
---

# Деплой на Railway

На Railway выкладывается КОРЕНЬ репозитория. Railway использует `server`, `webapp`, `package.json`, `package-lock.json`, `railway.json`. Папка `mobile` в деплое не участвует.

Конфиг `railway.json`: builder RAILPACK, build `npm run build` (webapp → vite build, server → build-info), start `npm run start` (= `node server/src/index.js`).

## Чек-лист перед деплоем

1. Локальная проверка Railway-сборки: `npm run build` из корня — должна пройти без ошибок.
2. Smoke локально: `npm run dev:server`, проверить `/api/health` и `/api/bootstrap`.
3. Убедиться, что секреты НЕ попали в git (реальные значения только в Railway Variables).

## Переменные Railway (см. .env.example)

Обязательные: `NODE_ENV=production`, `PORT=8080`, `PUBLIC_APP_URL`, `OWNER_PASSWORD`, `OWNER_SESSION_SECRET`, `AUTH_SESSION_SECRET`.
Хранилище: `DATABASE_URL` (PostgreSQL-плагин Railway; без него сервер уходит в файловый fallback — на Railway это означает потерю данных при редеплое).
Загрузки: `UPLOADS_DIR=/data/uploads` + примонтированный Railway Volume на `/data`.
Cookies/native: `NATIVE_APP_MODE=true`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=None`, `NATIVE_ANDROID_PACKAGE=com.realone14.guideappnativeconnected`.
Auth (опционально, сервер стартует и без них): `GOOGLE_CLIENT_ID/SECRET`, `TELEGRAM_BOT_TOKEN/USERNAME/ID`, `APPLE_CLIENT_ID/TEAM_ID/KEY_ID/PRIVATE_KEY`.

## После деплоя

Проверить на проде: `/api/health`, `/api/bootstrap`, открытие webapp (корень URL), вход владельца `/owner-login`, а если менялся auth — `/api/auth/session` и вход из мобильного приложения.
