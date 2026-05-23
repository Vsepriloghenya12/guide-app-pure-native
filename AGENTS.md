\# Guide App instructions for Codex



\## Project overview



This is Ivan's guide app project.



Main stack:

\- Node.js / Express backend/API

\- React Native / Expo mobile app

\- PostgreSQL on Railway when DATABASE\_URL exists

\- File fallback storage when DATABASE\_URL is missing

\- Railway deployment for backend/API

\- Public guide data, listings, categories, favorites, map, nearby, contacts, help consumed by mobile



\## Main rules



\- Make only the requested changes.

\- Do not add extra features.

\- Do not redesign the UI unless explicitly asked.

\- Preserve the current architecture.

\- Preserve existing routes, API response shapes, storage format, and Railway configuration.

\- Do not expose or print .env values.

\- Do not remove file fallback behavior.

\- Do not break PostgreSQL behavior.

\- Do not break mobile app behavior while changing backend.

\- Do not add new dependencies unless clearly necessary.

\- Keep code concise and avoid unnecessary comments.



\## Mobile rules



When editing mobile:

\- use React Native / Expo-compatible code;

\- preserve navigation behavior;

\- respect safe areas;

\- avoid web-only APIs unless guarded;

\- run TypeScript checks when possible.



Relevant skill:

\- vercel-react-native-skills

\- expo-eas-build



\## Backend rules



When editing server:

\- preserve Express API contracts;

\- keep Railway build/start commands unless deployment is the task;

\- keep DATABASE\_URL PostgreSQL mode and file fallback mode both working;

\- never require external API keys for basic app startup;

\- keep uploads/storage behavior safe.

\- keep auth providers optional; basic API startup must work without external provider keys.

\- keep native auth return scheme compatible with the Expo app.



Relevant skills:

\- railway-deployment

\- express-postgres-backend

\- telegram-auth



\## Verification



After changes, run the relevant available checks:



\- npm run build

\- cd mobile \&\& npx tsc --noEmit

\- cd mobile \&\& npx expo-doctor

\- backend smoke checks if server changes are made



If a check cannot be run, explain why.

