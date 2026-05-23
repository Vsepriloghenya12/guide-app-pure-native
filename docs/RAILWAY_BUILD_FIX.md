# Railway build fix

This version keeps the mobile Expo app separate from the Railway npm workspace.

Railway builds only:

- `server` — API/backend

The mobile app remains in `mobile/`, but it is installed and built separately for APK via Expo/EAS.

Why this was needed:

- Expo SDK 54 mobile uses React 19 and native dependencies.
- Railway should not install or build the mobile app.
- The root workspace should stay focused on the backend API.

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
