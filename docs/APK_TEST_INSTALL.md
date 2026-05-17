# APK test install guide

This project is ready for an Android test APK through Expo EAS Build.

## What this build does

- `preview` profile creates an installable Android APK.
- `production` profile creates an Android App Bundle for Google Play.
- The app can open with local seed data if the backend URL is not configured.

## Local steps

1. Install Node.js LTS.
2. Open terminal in the project root.
3. Run `npm install`.
4. Go to mobile: `cd mobile`.
5. Log in to Expo: `npx eas login`.
6. If this is the first EAS build for this app, run `npx eas init`.
7. Build test APK: `npx eas build -p android --profile preview`.
8. When the build completes, Expo gives a link. Open it on Android and install the APK.

## Backend URL

For a real backend, create `mobile/.env` and set:

`EXPO_PUBLIC_API_BASE_URL=https://your-railway-backend-url`

Then restart Expo or rebuild the APK.
