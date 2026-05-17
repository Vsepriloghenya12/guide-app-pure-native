# Deploy checklist

## Backend на Railway

1. Создать Railway service из этого репозитория.
2. Указать environment variables из `.env.example`.
3. Добавить PostgreSQL, если нужен persistent production storage.
4. Указать `UPLOADS_DIR=/data/uploads`, если подключён volume.
5. Deploy command уже задан в `railway.json`.

## Mobile app

1. В `mobile/.env` указать:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-api.up.railway.app
```

2. Установить зависимости:

```bash
cd mobile
npm install
```

3. Запустить локально:

```bash
npm run start
```

4. Нативная Android/iOS генерация:

```bash
npm run prebuild
npm run android
npm run ios
```

5. Для публикации использовать EAS Build после настройки аккаунтов Google Play / App Store Connect.
