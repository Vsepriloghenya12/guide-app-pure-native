# Fix Telegram auth and mobile map V4

## What changed

- Mobile Telegram login now always requests `/api/auth/telegram/start` as JSON and validates that the returned provider is `telegram`.
- If the backend returns a Google URL for Telegram, the app blocks it and shows an error instead of opening Google.
- Default mobile map tiles are moved from `tile.openstreetmap.org` to CARTO basemap tiles to avoid the OpenStreetMap volunteer tile server 403 block.
- The old direct OpenStreetMap tile endpoint should not be used from the APK.

## Required deployment

Telegram fix requires deploying the updated `server/` to Railway. If the APK points to an older Railway deployment, Telegram may keep opening an old web app or a wrong Google link.

Railway Telegram variables:

```env
TELEGRAM_BOT_TOKEN=123456789:...
TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_BOT_ID=123456789
PUBLIC_APP_URL=https://guide-app-pure-native-production.up.railway.app
AUTH_SESSION_SECRET=long_random_value
```

`TELEGRAM_BOT_ID` is the numeric part before `:` in `TELEGRAM_BOT_TOKEN`.

## Mobile rebuild

After unpacking this archive, rebuild release APK and reinstall it after uninstalling the old app.
