# Danang Guide v7 re-audit

Rechecked `danang-guide-fixed-telegram-map-v6-audited.zip` using the project agents/skills under `.agents/skills`:

- `telegram-auth`
- `oauth-native-auth`
- `expo-eas-build`
- `railway-deployment`
- `express-postgres-backend`
- `vercel-react-native-skills`

## Important findings

1. Telegram mobile code is correct in this archive: the Telegram button builds `/api/auth/telegram/native?returnTo=danangguide:///auth` directly and does not call Google auth start.
2. Backend Telegram routes are correct in this archive: `/api/auth/telegram/start?format=json` returns provider `telegram` and a URL under `/api/auth/telegram/native`.
3. If a phone still opens `accounts.google.com` after installing this archive, the installed APK or Railway backend is old. The current mobile code and current backend smoke test do not generate a Google URL for Telegram.
4. v6 had stale OpenStreetMap tile URLs in `mobile/eas.json`, `mobile/.env.example`, root `.env.example`, and web map helpers. v7 replaces them with Carto raster tiles and adds a safety fallback in mobile code so `tile.openstreetmap.org` is ignored even if accidentally passed in an environment variable.
5. The local skills had an outdated Railway/backend note saying the webapp was removed/API-only. That was wrong for this repo. v7 corrected the local skill docs so future agents do not remove the active `webapp` or static serving.

## Applied v7 corrections

- `mobile/App.tsx`: added `DEFAULT_MAP_TILE_URL` and blocks `tile.openstreetmap.org` from being used in the APK map style.
- `mobile/eas.json`: changed `EXPO_PUBLIC_MAP_TILE_URL` from OpenStreetMap volunteer tiles to Carto raster tiles.
- `mobile/.env.example`: changed mobile map tile URL to Carto.
- `.env.example`: changed web `VITE_MAP_TILE_URL` to Carto.
- `webapp/src/components/map/MapLibrePlaceMap.tsx`: changed default web map tile URL to Carto.
- `webapp/src/utils/appMap.ts`: changed generated tile URLs to Carto.
- `mobile/app.config.js`: added `extra.apiBaseUrl` and `extra.mapTileUrl` so Expo config contains the expected production defaults.
- `.agents/skills/railway-deployment/SKILL.md`: corrected the webapp/static-serving rule.
- `.agents/skills/express-postgres-backend/SKILL.md`: corrected the API-only/static-serving rule.

## Checks run

- `npm ci --ignore-scripts` — OK
- `npm run build` — OK
- `cd mobile && npm ci --ignore-scripts` — OK
- `cd mobile && npx tsc --noEmit` — OK
- `cd mobile && npx expo config --type public --json` — OK
- `cd mobile && npm ls @maplibre/maplibre-react-native @react-native-masked-view/masked-view expo-notifications react-native react expo @react-native-async-storage/async-storage --depth=0` — OK
- `node --check server/src/index.js` — OK
- `node --check server/src/publicAuth.js` — OK
- local backend smoke with placeholder env — OK:
  - `/api/health`
  - `/api/auth/session`
  - `/api/auth/telegram/start?format=json&returnTo=danangguide:///auth`
  - `/api/auth/telegram/native?returnTo=danangguide:///auth` rendered Telegram widget page and did not contain `accounts.google`.

## Checks not run here

- Android Gradle APK build was not run in this Linux container because the Gradle wrapper would need to download Gradle and the container has no Android SDK/NDK environment.
- `npx expo-doctor` ran partially: 16/18 checks passed, and the remaining two require Expo API/network access (`exp.host`), which is unavailable in this container.

## Required production checks after Railway deploy

After deploying the v7 server to Railway, open:

```text
https://guide-app-pure-native-production.up.railway.app/api/auth/telegram/start?format=json&returnTo=danangguide%3A%2F%2F%2Fauth
```

Expected:

```json
{
  "provider": "telegram",
  "url": "https://guide-app-pure-native-production.up.railway.app/api/auth/telegram/native?..."
}
```

If this endpoint returns `accounts.google.com`, Railway is still running old code.

Telegram Login Widget also requires the production domain/allowed URL configured in BotFather. Set the bot web login domain to:

```text
guide-app-pure-native-production.up.railway.app
```
