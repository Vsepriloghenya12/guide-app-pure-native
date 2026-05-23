---
name: telegram-auth
description: Use for Telegram Login Widget, Telegram bot auth, native deep links, auth returnTo/sessionToken flow, Railway auth variables, and preserving Telegram WebApp/auth validation.
---

# Telegram Auth

Use this skill for Telegram and native auth work.

## Project Rules

- Do not weaken Telegram validation except explicit dev-only behavior.
- Keep native return scheme compatible with `danangguide://auth`.
- Keep auth provider absence non-fatal: unavailable providers should be reported as disabled, not crash startup.
- Never print real bot tokens, client secrets, private keys, or auth session secrets.

## Railway Variables

Telegram login generally needs:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_BOT_ID` when native login requires a numeric bot id
- `AUTH_SESSION_SECRET`
- `PUBLIC_APP_URL`

Google/Apple provider keys are separate and optional.

## Mobile Flow

The installed app opens provider URLs from `EXPO_PUBLIC_API_BASE_URL`, then expects a deep link back with:

```text
danangguide://auth?auth=success&provider=telegram&sessionToken=...
```

If login fails only in installed APK, check that the EAS build included `EXPO_PUBLIC_API_BASE_URL`.
