# Native auth return fix — 2026-05-22

Что исправлено:

- Google/Telegram callback для native теперь не делает только прямой 302 на `danangguide://auth`, а показывает промежуточную страницу, которая автоматически открывает приложение и даёт кнопку «Открыть приложение» как fallback.
- Это решает Android-сценарии, где Chrome/Telegram browser блокирует автоматический переход из HTTPS callback в custom scheme.
- Мобильное приложение теперь устойчивее разбирает deep link `danangguide://auth`, `danangguide:///auth`, query и hash параметры.
- После получения `sessionToken` приложение сразу сохраняет токен, проверяет `/api/auth/session` через Bearer token и обновляет профиль.

Важно:

- После этой правки нужен redeploy Railway, потому что часть исправления находится в backend auth callback.
- Затем нужно пересобрать APK через EAS, потому что часть исправления находится в mobile.
- На Railway должны быть настроены `PUBLIC_APP_URL`, `AUTH_SESSION_SECRET`, Google OAuth переменные и Telegram bot переменные.
