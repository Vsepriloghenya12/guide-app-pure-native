# Fix Notifications V8

## Что исправлено

В Android APK без настроенного Firebase/FCM `expo-notifications` может падать при получении push token и показывать пользователю сырой текст `Network request failed` или ошибку Firebase.

В v8 добавлен явный флаг:

```env
EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=false
```

По умолчанию приложение больше не пытается получать Expo push token в локальной APK-сборке без FCM. Вместо сырой ошибки показывается понятное сообщение о том, что Firebase/FCM нужно настроить перед включением push-уведомлений.

## Как включить настоящие push-уведомления

1. Создать Firebase project.
2. Добавить Android app с package name:

```text
com.realone14.guideappnativeconnected
```

3. Скачать `google-services.json`.
4. Добавить его в mobile-проект и прописать в Expo Android config.
5. Настроить FCM V1 credentials для Expo/EAS или перейти на прямую отправку через FCM.
6. Перед сборкой выставить:

```env
EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=true
```

Без этих шагов настоящие Android push-уведомления работать не будут.
