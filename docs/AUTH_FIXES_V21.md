# V21 auth fixes

- Telegram native login now prefers Telegram OAuth redirect and supports `TELEGRAM_BOT_ID` on Railway.
- If `TELEGRAM_BOT_TOKEN` does not start with the numeric bot id, set `TELEGRAM_BOT_ID` manually. It is the number before `:` in the real bot token.
- Google/native auth now caches the user profile from the native session token immediately after returning to `danangguide://auth`, so the profile icon should not ask for login again after successful sign-in.
- Backend bearer-token session support remains active through `/api/auth/session`.

Railway variables for Telegram:

```text
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_BOT_ID=123456789
TELEGRAM_BOT_USERNAME=your_bot_username
PUBLIC_APP_URL=https://your-app.up.railway.app
AUTH_SESSION_SECRET=stable-long-secret
```

For Telegram web OAuth/widget also set the domain in BotFather:

```text
/setdomain
https://your-app.up.railway.app
```

`AUTH_SESSION_SECRET` must stay stable between deploys. If it changes, existing mobile login tokens become invalid.
