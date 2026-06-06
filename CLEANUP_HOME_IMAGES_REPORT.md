# Cleaned mobile home images

Removed hard dependencies on old local mobile home images that were no longer needed visually but were still imported by Metro:

- `mobile/assets/home/icons/icon-512.png`
- `mobile/assets/home/icons/icon-512.png`
- `mobile/assets/home/home-header-mesto.png`
- `mobile/assets/home/welcome-background.png`
- `mobile/assets/home/welcome-logo.png`

Code changes:

- `mobile/src/assets.ts` no longer exports those files.
- `mobile/App.tsx` no longer imports them.
- Home hero now uses a styled native `View` instead of a local `ImageBackground`.
- Welcome screen now uses a styled native `View` and text logo instead of local image assets.
- Tips use a native placeholder icon instead of `home-hero-background.png`.
- Banner fallback uses a styled native `View` when no CMS image is set.

Kept assets that are still directly required:

- category icons under `mobile/assets/home/home-icons/custom/`
- `mobile/assets/home/place-verification-badge.png`
- `mobile/assets/icon.png`
- `mobile/assets/splash.png`

Validation performed:

- Grep check confirms no references remain to the removed image filenames.
- Static require check confirms every remaining local `require(...)` target under `mobile` exists.
