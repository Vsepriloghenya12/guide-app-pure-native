# Push-уведомления без Expo/EAS login

Эта версия использует прямую схему Firebase Cloud Messaging:

1. Android APK получает FCM device token через `expo-notifications` и `Notifications.getDevicePushTokenAsync()`.
2. Мобильное приложение отправляет токен на backend: `POST /api/me/push-token`.
3. Backend отправляет уведомления через Firebase Admin SDK напрямую в FCM.
4. Expo Push Service и `eas login` не используются.

## Что нужно добавить локально

Скачайте `google-services.json` из Firebase Console и положите сюда:

```text
mobile/android/app/google-services.json
```

После этого пересоберите APK.

## Что нужно добавить на Railway

В Firebase Console откройте:

```text
Project settings → Service accounts → Generate new private key
```

Скопируйте весь JSON и добавьте в Railway как переменную:

```text
FIREBASE_SERVICE_ACCOUNT_JSON={...полный JSON...}
```

Не коммитьте service account JSON в GitHub.

## Проверка

1. Установить новую release APK.
2. Войти в профиль.
3. Включить уведомления.
4. Убедиться, что `/api/me/notification-settings` показывает `has_push_token: true`.
5. В owner CMS отправить push по опубликованной акции.
