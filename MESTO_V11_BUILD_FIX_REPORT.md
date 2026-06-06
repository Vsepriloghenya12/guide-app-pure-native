# Mesto v11 build fix

Исправлен пакет после v10: в mobile уже использовался `react-native-webview`, но если локально не выполнить установку зависимостей, Android bundle падает с ошибкой `Unable to resolve module react-native-webview`.

Что проверено/исправлено:

- `mobile/package.json` содержит `react-native-webview`.
- `mobile/package-lock.json` содержит `react-native-webview` и `escape-string-regexp` с публичного npm registry, без внутренних OpenAI registry-ссылок.
- Для сборки из новой папки нужно выполнить `npm install` в `mobile` перед `gradlew`.

Команды:

```bat
cd D:\guide-app-mesto-v11\mobile
npm install
cd android
gradlew --stop
gradlew :app:assembleRelease --no-daemon --max-workers=1 -x lintVitalAnalyzeRelease
```

Если сборка выполняется в старой папке `D:\guide-app-pure-native`, нужно либо распаковать этот архив поверх старой папки с заменой файлов и выполнить `npm install` в `mobile`, либо лучше распаковать в новую папку.
