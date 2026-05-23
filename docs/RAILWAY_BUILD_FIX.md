# Railway build fix

This version separates the mobile Expo app from the Railway npm workspaces.

Railway builds only:

- `webapp` — owner/CMS web interface
- `server` — API/backend

The mobile app remains in `mobile/`, but it is installed and built separately for APK via Expo/EAS.

Why this was needed:

- The web owner interface uses React 18.
- Expo SDK 54 mobile uses React 19.
- When `mobile` was included in the root npm workspaces, npm could hoist React 19 type packages into the root install.
- Then TypeScript in `webapp` failed on `Route` / `Outlet` with TS2786.

Use on Railway:

- Build command: `npm run build`
- Start command: `npm run start`
- Root directory: project root

Use for mobile locally:

```bash
cd mobile
npm install
npm run start
```

Build APK:

```bash
cd mobile
eas build -p android --profile preview --clear-cache
```
