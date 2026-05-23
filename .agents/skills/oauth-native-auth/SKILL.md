---
name: oauth-native-auth
description: Use for Google/Apple OAuth, mobile browser auth redirects, signed OAuth state, native deep links, Android intent fallbacks, bearer session tokens, and keeping web cookie auth compatible with Expo/React Native auth.
---

# OAuth Native Auth

Use this skill when user auth crosses web, backend, and Expo mobile.

## Project Rules

- Preserve web cookie login and mobile bearer-token login together.
- Do not print OAuth client secrets, bot tokens, private keys, or auth session secrets.
- Keep provider absence non-fatal: disabled providers should be reported in `/api/auth/session`.
- Keep native return URLs compatible with `danangguide://auth`.
- Prefer signed OAuth `state` that contains `provider`, `returnTo`, and `iat`; do not rely only on browser cookies for installed-app OAuth callbacks.
- For Android installed apps, use an `intent://` fallback from browser callback pages when opening the app by custom scheme is unreliable.
- Preserve existing API response shapes.

## Checks

After auth changes:

```bash
npm run build
cd mobile && npx tsc --noEmit
```

Smoke endpoints:

```text
/api/auth/session
/api/auth/google/start?returnTo=danangguide%3A%2F%2Fauth&mode=native
/api/auth/telegram/start?returnTo=danangguide%3A%2F%2Fauth&mode=native&prefer=oauth
```

Expected native success return:

```text
danangguide://auth?auth=success&provider=<provider>&sessionToken=<signed-token>
```
