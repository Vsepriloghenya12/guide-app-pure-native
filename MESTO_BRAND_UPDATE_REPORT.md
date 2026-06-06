# Mesto brand update

Изменения в этой версии:

- Проект переименован в пользовательском интерфейсе в `Место`.
- Заменена картинка шапки на новый баннер `найди своё место в городе`.
- Заменены mobile/web/app launcher icons на новую иконку `Место`.
- Обновлены checked-in Android launcher resources, чтобы локальная Gradle-сборка брала новую иконку без Expo prebuild.
- Web hero больше не накладывает второй логотип поверх баннера, потому что новый баннер уже содержит логотип и текст.
- Схема deep link `danangguide` и package id оставлены без изменений, чтобы не сломать текущую авторизацию и установленный backend-flow.

Что намеренно не менялось:

- Android package: `com.realone14.guideappnativeconnected`.
- Deep link scheme: `danangguide`.
- Railway/backend URL.
- Логика карт, Telegram-авторизации и backend API.
