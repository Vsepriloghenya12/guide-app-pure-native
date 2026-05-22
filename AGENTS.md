\# Guide App instructions for Codex



\## Project overview



This is Ivan's guide app project.



Main stack:

\- Node.js / Express backend

\- React / Vite / TypeScript web frontend

\- React Native / Expo mobile app

\- PostgreSQL on Railway when DATABASE\_URL exists

\- File fallback storage when DATABASE\_URL is missing

\- Railway deployment

\- PWA support

\- Owner/CMS area

\- Public guide pages, listings, categories, favorites, map, nearby, contacts, help



\## Main rules



\- Make only the requested changes.

\- Do not add extra features.

\- Do not redesign the UI unless explicitly asked.

\- Preserve the current architecture.

\- Preserve existing routes, API response shapes, storage format, and Railway configuration.

\- Do not expose or print .env values.

\- Do not remove file fallback behavior.

\- Do not break PostgreSQL behavior.

\- Do not break mobile app behavior while changing web/backend.

\- Do not add new dependencies unless clearly necessary.

\- Keep code concise and avoid unnecessary comments.



\## Web frontend rules



Use React/Vite/TypeScript style already present in the project.



When editing webapp:

\- preserve existing visual style;

\- keep UI compact and functional;

\- avoid duplicate buttons;

\- avoid unnecessary card wrappers on mobile;

\- keep PWA behavior intact;

\- preserve favorites/login behavior unless the task is about auth.



Relevant skills:

\- vercel-react-best-practices

\- web-design-guidelines

\- vercel-composition-patterns



\## Mobile rules



When editing mobile:

\- use React Native / Expo-compatible code;

\- preserve navigation behavior;

\- respect safe areas;

\- avoid web-only APIs unless guarded;

\- run TypeScript checks when possible.



Relevant skill:

\- vercel-react-native-skills



\## Backend rules



When editing server:

\- preserve Express API contracts;

\- keep Railway build/start commands unless deployment is the task;

\- keep DATABASE\_URL PostgreSQL mode and file fallback mode both working;

\- never require external API keys for basic app startup;

\- keep uploads/storage behavior safe.



\## Verification



After changes, run the relevant available checks:



\- npm run build

\- cd mobile \&\& npx tsc --noEmit

\- backend smoke checks if server changes are made



If a check cannot be run, explain why.

