# Cleanup report

Сделана безопасная чистка копии проекта. Исходный архив не изменялся.

## Удалено

- `_chatgpt_project_pack/` — полная дублирующая копия проекта внутри архива. Основные файлы совпадали с корневыми файлами проекта.
- `mobile/android/.kotlin/` — пустой/генерируемый Android cache.
- Старый backend на TypeScript от другого проекта про futures/Bybit scanner:
  - `server/src/app.ts`
  - `server/src/config.ts`
  - `server/src/index.ts`
  - `server/src/types.ts`
  - `server/src/api/`
  - `server/src/services/`
  - `server/src/utils/`
  - `server/tsconfig.json`

Текущий backend Danang Guide запускается через `server/src/index.js` и использует `server/src/db.js` + `server/src/publicAuth.js`; удалённые TypeScript-файлы не входят в runtime-запуск и не используются npm-скриптами.

## Обновлено

- `.env.example` — удалены переменные от старого трейдинг-проекта, оставлены переменные Danang Guide.
- `README.md` — приведён к текущей структуре `server + webapp + mobile`.

## Не трогалось

- `mobile/App.tsx`
- `mobile/android/app/`
- `webapp/src/`
- `server/src/index.js`
- `server/src/db.js`
- `server/src/publicAuth.js`
- `shared/default-guide-content.json`
- `storage/content-store.json`
- `.agents/skills/`
- все изображения и assets
- исторические документы в `docs/`

## Проверка после чистки

- `node --check server/src/index.js server/src/db.js server/src/publicAuth.js` — OK.
- `npm install --ignore-scripts` в корне — OK.
- `npm run build` в корне — OK: webapp + server собираются.
- `npm install --ignore-scripts` в `mobile` — OK.
- `npx tsc --noEmit` в `mobile` — OK.

## Замечания

- При `npm run build` Vite предупреждает, что основной JS chunk webapp больше 500 kB. Это не ошибка сборки.
- При установке зависимостей mobile npm показывает устаревшие транзитивные пакеты и 13 moderate vulnerabilities. Это не результат чистки; связано с текущим Expo/React Native dependency tree. Автоматический `npm audit fix --force` не применялся, чтобы не сломать совместимость.
