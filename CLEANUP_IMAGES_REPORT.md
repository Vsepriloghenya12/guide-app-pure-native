# Image cleanup report

Safe image cleanup for v8.

Removed only unused/stale web public images that were not referenced by active code or required runtime configs:

- `webapp/public/12.png` — old unused Danang logo/banner.
- Unused generated web icon variants: `apple-touch-icon.png`, `icons/apple-touch-icon-180.png`, `icons/favicon-16.png`, `icons/icon-72.png`, `icons/icon-96.png`, `icons/icon-128.png`, `icons/icon-144.png`, `icons/icon-152.png`, `icons/icon-167.png`, `icons/icon-180.png`, `icons/icon-256.png`, `icons/icon-384.png`, `icons/maskable-192.png`, `icons/maskable-512.png`.

Kept images needed for runtime/build:

- Mobile app bundled assets in `mobile/assets/**`.
- Android generated launcher/splash resources in `mobile/android/app/src/main/res/**`.
- Web hero/category images in `webapp/public/home-*`.
- Web runtime icons still referenced by `webapp/index.html`: `icons/favicon-32.png`, `icons/icon-192.png`, `icons/icon-512.png`.

Also fixed old missing web image fallbacks that caused useless 404 requests:

- Removed stale fallback references to `/home-hero-logo.png`, `/logo.png`, `/logo.svg`, `/boot-logo/*`.
- Replaced missing `/home-icons/custom/leisure.png`, `/home-icons/attractions.png`, `/home-icons/leisure.png` with existing active images.
