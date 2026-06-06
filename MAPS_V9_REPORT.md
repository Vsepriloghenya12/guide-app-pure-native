# MAPS_V9_REPORT

Дата: 2026-06-06

## Что изменено

Мобильная карта переведена с `@maplibre/maplibre-react-native` на связку:

- `react-native-webview`
- MapLibre GL JS внутри WebView
- OpenFreeMap vector styles

Основной стиль карты:

```text
https://tiles.openfreemap.org/styles/liberty
```

## Почему так

1. `tile.openstreetmap.org` нельзя использовать напрямую в production APK — OpenStreetMap блокирует такие запросы по tile usage policy.
2. Native MapLibre v11 даёт нормальную карту, но сильно нагружает локальную Windows/NDK сборку и регулярно падает по памяти на C++/codegen.
3. WebView + MapLibre GL JS даёт интерактивную карту без Google Maps API и без тяжёлой C++ сборки MapLibre Native.

## Что сохранено

- Карта остаётся интерактивной.
- Точки мест отображаются на карте.
- При нажатии на маркер открывается popup приложения с кнопкой `Открыть`.
- Маршруты отображаются линией и точками.
- Google Maps API не используется.
- Telegram auth flow из v8 сохранён.

## Что удалено

Из `mobile/package.json` удалено:

```text
@maplibre/maplibre-react-native
```

Добавлено:

```text
react-native-webview@13.16.1
```

## Переменная для смены стиля

Можно задать другой стиль через:

```env
EXPO_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/positron
```

Доступные бесплатные OpenFreeMap styles:

```text
https://tiles.openfreemap.org/styles/liberty
https://tiles.openfreemap.org/styles/bright
https://tiles.openfreemap.org/styles/positron
```

## Проверки

Проверено в контейнере:

```bash
npm run build
cd mobile && npx tsc --noEmit
cd mobile && npx expo config --type public --json
cd mobile && npm ls react-native-webview @maplibre/maplibre-react-native --depth=0
```

Android Gradle APK в контейнере не запускался, потому что нет Windows Android SDK/NDK. Но нативная C++ зависимость MapLibre удалена, поэтому сборка должна быть легче, чем v8.
