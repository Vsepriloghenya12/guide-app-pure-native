# Mesto v12 build fix

Исправлена локальная Android-сборка после перехода карты на WebView.

## Изменения

- `mobile/android/gradle.properties`: `newArchEnabled=false`, потому что `react-native-webview` не требует New Architecture, а включённая New Architecture заставляла Gradle собирать C++ codegen `RNCWebViewSpec`.
- `reactNativeArchitectures=arm64-v8a`, чтобы не собирать x86/x86_64/armeabi-v7a для обычного телефона. В логе падение происходило именно на `x86`.
- Увеличены JVM настройки Gradle: `-Xmx4096m`, `MaxMetaspaceSize=1024m`.
- Добавлено `org.gradle.daemon=false` для одноразовых сборок на слабом ПК.

## Команда сборки

```bat
cd D:\guide-app-pure-native\mobile\android
gradlew --stop
rmdir /s /q app\.cxx
rmdir /s /q app\build
rmdir /s /q build
rmdir /s /q .gradle
set NODE_ENV=production
set NODE_OPTIONS=--max-old-space-size=4096
gradlew :app:assembleRelease --no-daemon --max-workers=1 -x lintVitalAnalyzeRelease
```

После успешной сборки:

```bat
dir /s /b *release*.apk
```
