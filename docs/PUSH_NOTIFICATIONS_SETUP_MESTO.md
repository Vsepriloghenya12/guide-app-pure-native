# Настройка push-уведомлений Android для «Место»

В приложении используется `expo-notifications` и Expo Push Token. Для Android APK нужны две части:

1. Firebase config внутри APK: `mobile/android/app/google-services.json`.
2. FCM v1 credentials в Expo/EAS project, чтобы Expo Push Service мог отправлять уведомления в Android.

## Package name

В Firebase Android app укажи ровно:

```text
com.realone14.guideappnativeconnected
```

## Шаги Firebase

1. Открой Firebase Console.
2. Создай проект или выбери существующий.
3. Добавь Android-приложение.
4. В поле Android package name введи `com.realone14.guideappnativeconnected`.
5. Скачай `google-services.json`.
6. Положи файл сюда:

```text
mobile/android/app/google-services.json
```

## Шаги Expo/EAS для отправки через Expo Push API

1. В Firebase Console открой Project settings → Service accounts.
2. Нажми Generate new private key.
3. Сохрани JSON service account key.
4. Установи EAS CLI, если его нет:

```bash
npm install -g eas-cli
```

5. Войди в Expo:

```bash
eas login
```

6. В папке `mobile` загрузи FCM key:

```bash
cd mobile
eas credentials
```

Выбери Android → Push Notifications → FCM V1 service account key → upload.

## Сборка после добавления Firebase

```bat
cd D:\guide-app-pure-native\mobile
npm install
cd android
gradlew --stop
rmdir /s /q app\.cxx
rmdir /s /q app\build
rmdir /s /q build
rmdir /s /q .gradle
set NODE_ENV=production
set NODE_OPTIONS=--max-old-space-size=4096
gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a -PnewArchEnabled=false --no-daemon --max-workers=1 -x lintVitalAnalyzeRelease
```

После `BUILD SUCCESSFUL` найди APK:

```bat
dir /s /b *release*.apk
```

## Проверка

1. Установи новый release APK.
2. Войди в профиль.
3. Нажми «Уведомления об акциях».
4. Если всё настроено, приложение получит Expo Push Token и сохранит его на сервере.
5. В CMS владельца создай опубликованную акцию и отправь push.

## Частые ошибки

- `Default FirebaseApp is not initialized` — нет `google-services.json` в APK или не применился google-services Gradle plugin.
- `FCM credentials` / `Failed to authenticate with FCM` — не загружен service account key в EAS credentials.
- Push включается, но не приходит — проверь, что акция опубликована, пользователь авторизован, токен сохранён и устройство имеет интернет.
