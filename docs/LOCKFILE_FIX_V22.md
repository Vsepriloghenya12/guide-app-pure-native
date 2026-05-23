# Lockfile fix v22

Railway build was failing during `npm ci` because the repository contained a stale `package-lock.json` that did not match the current root/workspace `package.json` files.

Symptoms included:

- `npm error Missing: ... from lock file`
- `npm error Invalid: lock file's esbuild@... does not satisfy esbuild@...`
- `process "npm ci" did not complete successfully`

Fix applied:

- Generated a fresh root `package-lock.json` for the `server` workspace.
- Generated a separate `mobile/package-lock.json` for Android/iOS builds.
- Kept `mobile` outside root workspaces so React Native/Expo dependencies do not install on Railway.

Use this version as the GitHub/Railway source. Do not copy old `package-lock.json` files from previous folders.
