---
name: railway-deployment
description: Use for Railway deploy, environment variables, build/start commands, logs, health checks, and diagnosing backend deployment issues for this project. Applies when working with Railway config, production API URLs, DATABASE_URL, uploads, cookies, auth secrets, or deployment failures.
---

# Railway Deployment

Use this skill for Railway backend/API work.

## Project Rules

- Railway deploys the repository root and starts the Express backend.
- Keep `railway.json` build/start commands compatible with the root scripts.
- The webapp/CMS is active in this repository. Railway builds `webapp` and `server`; the Express server serves `webapp/dist` when it exists. Do not remove `webapp`, Vite, or static serving unless explicitly requested.
- Preserve file fallback when `DATABASE_URL` is missing.
- Preserve PostgreSQL behavior when `DATABASE_URL` exists.
- Never print real `.env` values or secrets.

## Checks

Run relevant checks after changes:

```bash
npm run build
npm run start --workspace server
```

Smoke useful endpoints:

```text
/api/bootstrap
/api/support-content
/api/auth/session
```

## Environment Guidance

Required production backend variables usually include:

- `NODE_ENV=production`
- `PUBLIC_APP_URL`
- `AUTH_SESSION_SECRET`
- `OWNER_SESSION_SECRET`
- provider keys only when that provider is enabled
- `DATABASE_URL` only when PostgreSQL is attached
- `UPLOADS_DIR` when persistent uploads are needed

External provider keys must be optional for basic API startup.
