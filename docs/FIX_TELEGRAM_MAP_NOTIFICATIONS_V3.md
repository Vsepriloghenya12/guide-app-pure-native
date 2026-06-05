# Fix V3: Telegram, map, notifications

Изменения:

1. Telegram-login больше не использует общий JSON-ответ сервера для открытия ссылки. Для Telegram приложение сначала собирает прямую ссылку `https://oauth.telegram.org/auth` по `telegramBotId`, а если bot id не пришёл с сервера — открывает строго `/api/auth/telegram/start`. Google-ссылки для Telegram теперь блокируются.

2. Карта переведена с MapLibre Native на простой встроенный OpenStreetMap-превью-слой на обычных `Image` tiles. Это убирает зависимость от нативного MapLibre-модуля и делает карту работоспособной в локальном APK, собранном через Gradle на ПК.

3. Ошибка Firebase при включении уведомлений заменена на понятное сообщение. Для Android push в локальной APK-сборке нужен Firebase/FCM и файл `google-services.json`; без него Expo push token получить нельзя.

4. Удалена зависимость `@maplibre/maplibre-react-native` из mobile/package.json и package-lock.json.

5. В AndroidManifest добавлено разрешение `POST_NOTIFICATIONS`.

Что проверить после сборки:
- карточка места открывается;
- карта в карточке и разделе «Карта» показывает OpenStreetMap tiles;
- кнопка Telegram не открывает accounts.google.com;
- при включении уведомлений нет сырой Firebase-ошибки.
