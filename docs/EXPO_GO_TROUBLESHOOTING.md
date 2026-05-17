# Expo Go troubleshooting

This build targets Expo SDK 54 so it can run with the store version of Expo Go during the SDK 55 transition period.

Run:

```bash
npm install
npm run mobile:start -- --clear
```

If LAN fails, use tunnel:

```bash
cd mobile
npx expo start --tunnel --clear
```
