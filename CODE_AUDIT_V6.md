# Danang Guide v6 code audit

Checked from `danang-guide-fixed-telegram-map-v5.zip` and applied one corrective patch.

## Findings

1. Telegram auth code in v5 mobile app no longer called Google for Telegram; the mobile Telegram button built `/api/auth/telegram/native` directly. Server smoke test confirmed `/api/auth/telegram/start?format=json` returns provider `telegram` and URL `/api/auth/telegram/native`, while Google start returns a separate Google URL.
2. Production still requires the updated backend to be deployed. If Railway runs an older server, `/api/auth/telegram/native` may fall through to the web app and auth will appear broken.
3. Telegram Login Widget requires the bot domain/allowed URL configured in BotFather for the production domain.
4. v5 had an important map compatibility risk: `@maplibre/maplibre-react-native@11.3.2` is new-architecture-only, while `android/gradle.properties` has `newArchEnabled=false` for stable local Gradle APK builds. v6 fixes this by using `@maplibre/maplibre-react-native@10.4.2` and the compatible old-architecture MapLibre API.
5. The detail quality badge fallback text was a placeholder; v6 replaces it with a normal default string.
6. Two unused Telegram helper functions were removed from `mobile/App.tsx` to reduce confusion in future auth changes.

## Applied v6 changes

- Downgraded mobile MapLibre dependency from `^11.3.2` to `^10.4.2`.
- Reworked `GuideMap` from v11 API (`Map`, `GeoJSONSource`, generic `Layer`) to v10 API (`MapView`, `ShapeSource`, `LineLayer`, `CircleLayer`).
- Kept `newArchEnabled=false` for local APK builds.
- Preserved Telegram native auth route `/api/auth/telegram/native` and backend callback `/api/auth/telegram/callback`.
- Removed unused Telegram URL builders from mobile.
- Replaced placeholder quality badge text.

## Checks run

- `npm run build` — OK
- `cd mobile && npx tsc --noEmit` — OK
- `node --check server/src/index.js` — OK
- `node --check server/src/publicAuth.js` — OK
- `cd mobile && npx expo config --type public --json` — OK
- `npm ls @maplibre/maplibre-react-native @react-native-masked-view/masked-view expo-notifications` — OK
- Local backend smoke with env placeholders:
  - `/api/auth/session` — OK, providers include Telegram
  - `/api/auth/telegram/start?format=json&returnTo=danangguide:///auth` — OK, returns provider `telegram`
  - `/api/auth/telegram/native?returnTo=danangguide:///auth` — OK, renders Telegram widget page without Google URL

## Not run here

- Android Gradle APK build was not run in this Linux container because the local Windows Android SDK/NDK environment is not available here.

## Required production check after deploy

Open this URL after Railway deploy:

```text
https://guide-app-pure-native-production.up.railway.app/api/auth/telegram/start?format=json&returnTo=danangguide%3A%2F%2F%2Fauth
```

Expected response must contain:

```json
{
  "provider": "telegram",
  "url": "https://guide-app-pure-native-production.up.railway.app/api/auth/telegram/native?..."
}
```

If it contains `accounts.google.com`, the updated backend is not deployed or Railway is pointing to an old build.
