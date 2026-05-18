# Android crash fix v13

Исправлено падение Android-приложения при открытии карточки места и вкладки карты.

Причина: установленный APK мог собираться без реального `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. В Android standalone build `react-native-maps` с Google provider может падать или открываться нестабильно, если ключ не был вшит на этапе сборки.

Что изменено:

- встроенная карта больше не рендерится без реального Google Maps Android API key;
- вместо падения показывается безопасный блок с кнопкой открытия внешнего Google Maps;
- карта места и карта маршрута используют одинаковую безопасную обертку;
- отключены `showsUserLocation` и Android map toolbar внутри общей карты, чтобы карта не запрашивала системные функции до явного разрешения;
- добавлен error boundary, чтобы JS-ошибка экрана не закрывала всё приложение;
- увеличена версия приложения до `1.0.3`.

Для полноценной встроенной карты в APK добавь переменные в EAS preview environment:

- `EXPO_PUBLIC_API_BASE_URL` = Railway URL backend
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` = Google Maps Android API key

После этого пересобери APK:

```bash
cd mobile
eas build -p android --profile preview --clear-cache
```

Если ключ не добавлен, приложение всё равно должно работать, но карта будет открываться внешней кнопкой Google Maps, а не встроенным MapView.
