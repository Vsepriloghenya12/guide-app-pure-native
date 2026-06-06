---
name: express-postgres-backend
description: Use for Express API routes, response contracts, storage services, PostgreSQL DATABASE_URL mode, file fallback mode, uploads, backend smoke tests, and server-side data normalization.
---

# Express PostgreSQL Backend

Use this skill for backend/API changes.

## Project Rules

- Preserve existing API routes and response shapes.
- Keep startup working with and without `DATABASE_URL`.
- Keep file fallback storage safe.
- Do not require third-party API keys for basic startup.
- Do not expose secrets from `.env`.
- Keep uploads/storage paths safe and Railway-compatible.
- The backend exposes API routes and also serves `webapp/dist` for the public web/CMS when the build exists. Preserve API routes and web static serving together.

## Checks

After backend changes:

```bash
npm run build
npm run start --workspace server
```

Smoke endpoints:

```text
/api/bootstrap
/api/support-content
/api/auth/session
```

## Database Guidance

- When adding fields, preserve fallback JSON storage and PostgreSQL schema behavior.
- Prefer backward-compatible defaults.
- Keep migrations/idempotent schema setup safe on repeated startup.
