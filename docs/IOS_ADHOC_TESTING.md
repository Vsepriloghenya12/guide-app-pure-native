# iOS Ad Hoc testing через EAS

Эта версия проекта настроена для iOS internal/ad hoc сборки.

## Что обязательно нужно

- Активный Apple Developer Program аккаунт.
- Доступ к Expo/EAS аккаунту `realone12` или к проекту `danang-guide-native`.
- iPhone тестировщика должен быть добавлен через `eas device:create` до сборки.

## Порядок

1. Открой терминал в `mobile`.
2. Установи зависимости: `npm install`.
3. Войди в Expo: `eas login`.
4. Зарегистрируй iPhone: `eas device:create`.
5. Отправь ссылку/QR человеку с iPhone.
6. Человек открывает ссылку с iPhone и устанавливает профиль регистрации устройства.
7. Проверь список устройств: `eas device:list`.
8. Запусти сборку: `eas build -p ios --profile preview --clear-cache`.
9. Когда EAS спросит про Apple ID/credentials, войди в Apple Developer аккаунт и разреши EAS управлять credentials.
10. После сборки открой ссылку на iPhone и установи приложение.

## Важное ограничение

Ad hoc build установится только на те iPhone, которые были зарегистрированы до сборки и попали в provisioning profile.
Если после сборки добавился новый iPhone, нужно либо собрать iOS заново, либо сделать `eas build:resign`.
