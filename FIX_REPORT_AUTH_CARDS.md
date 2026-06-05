# Fix report: native APK auth + place cards

Changed:

- `mobile/src/api/client.ts`
  - Added a production API URL fallback so local Gradle APK builds do not lose `EXPO_PUBLIC_API_BASE_URL` when `.env` is missing.
  - Also reads `apiBaseUrl` from `app.config.js` `extra`.

- `mobile/app.config.js`
  - Added `extra.apiBaseUrl` and `extra.mapTileUrl`.

- `mobile/App.tsx`
  - Place card images in category lists now open the place detail screen instead of intercepting the tap and opening fullscreen image preview.

- `mobile/src/components/ui.tsx`
  - Same fix for reusable listing cards.

- `mobile/package.json` and `mobile/package-lock.json`
  - Added `@react-native-masked-view/masked-view` to prevent `RNCMaskedViewModule could not be found`.

- `mobile/android/gradle.properties`
  - Disabled React Native New Architecture for a more stable local Gradle APK build.
  - Limited Gradle/Kotlin workers to reduce memory failures on Windows.

Checked:

- `cd mobile && npm install --ignore-scripts`
- `cd mobile && npx tsc --noEmit`
