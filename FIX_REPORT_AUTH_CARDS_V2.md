# Fix report: auth, place cards, quality badge

Дата: 2026-06-05

## Исправлено

1. Карточка места больше не должна валить весь экран, если встроенная карта MapLibre внутри детальной страницы отдаёт JS-ошибку. Карта теперь обёрнута в локальный error boundary; сама карточка места должна открываться, даже если блок карты временно недоступен.

2. Знак качества теперь показывается в списках мест:
   - в карточках внутри категории;
   - в универсальных listing-карточках поиска/избранного.

3. Telegram-вход в мобильном приложении теперь строит прямую ссылку на Telegram OAuth через `TELEGRAM_BOT_ID`, если bot id доступен с backend `/api/auth/session`. Это не даёт кнопке Telegram открыть Google-ссылку, если backend/браузер вернул неверный URL.

4. Для APK-сборки на ПК сохранены настройки:
   - `newArchEnabled=false`;
   - ограничение Gradle worker'ов;
   - добавлена зависимость `@react-native-masked-view/masked-view`.

## Важно для Telegram

На Railway должны быть переменные:

```env
TELEGRAM_BOT_TOKEN=123456789:...
TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_BOT_ID=123456789
```

`TELEGRAM_BOT_ID` — это цифры до двоеточия в `TELEGRAM_BOT_TOKEN`.
