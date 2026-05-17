# Expo Go entry fix

Исправлена ошибка `Unable to resolve module ../../App from node_modules/expo/AppEntry.js`.

Причина: в workspace/monorepo Expo AppEntry может резолвиться из корневого `node_modules`, поэтому он ищет `App` в корне проекта, а не в папке `mobile`.

Исправление:
- добавлен `mobile/index.js`;
- в `mobile/package.json` поле `main` изменено с `expo/AppEntry.js` на `index.js`.
