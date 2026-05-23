---
name: expo-eas-build
description: Use for Expo and EAS Android/iOS builds, APK generation, app.config.js, eas.json, build profiles, public Expo environment variables, native package IDs, prebuild failures, and installed-app debugging.
---

# Expo EAS Build

Use this skill for mobile build and installed APK issues.

## Project Rules

- The Expo project lives in `mobile`; run EAS commands from `mobile`.
- Do not create or use root `app.json` or root `eas.json`.
- Keep native dependencies inside `mobile/package.json`.
- Public build-time values belong in `mobile/eas.json` `build.*.env` or EAS environment variables.
- `EXPO_PUBLIC_*` values are baked into APK/IPA at build time; rebuild after changing them.
- Do not add Expo/native dependencies unless needed and verified with `expo-doctor`.

## Standard Commands

```bash
cd mobile
npx expo-doctor
npx tsc --noEmit
npx expo prebuild --platform android --clean --no-install
npx eas build -p android --profile preview --clear-cache
```

## Auth/Backend Build Values

Installed app login requires:

- `EXPO_PUBLIC_API_BASE_URL` pointing at the Railway API
- matching `extra.eas.projectId`
- matching EAS project slug
- Android `package` consistent with the EAS project and OAuth provider settings

If installed app behaves like offline mode, first check whether `EXPO_PUBLIC_API_BASE_URL` was present during the EAS build.
