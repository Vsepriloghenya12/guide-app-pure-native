# v16 Place detail fix

Исправлено падение карточки места с ошибкой `Cannot read property favoriteText of undefined`.

Причина: экран карточки места обращался к импортированному объекту `uiStyles.favoriteText`. В production-сборке он мог приходить как `undefined`, из-за чего ErrorBoundary показывал экран «Не удалось открыть экран».

Что изменено:
- стили избранного в карточке места перенесены в локальные `styles.detailFavoriteText`;
- списки тегов/плашек в карточке места перенесены на локальный `styles.detailPillsRow`;
- импорт `uiStyles` из `src/components/ui` удалён из `App.tsx`;
- версия mobile повышена до `1.0.5` / `0.3.4-place-detail-fix`.

После замены проекта нужно пересобрать APK через EAS.
