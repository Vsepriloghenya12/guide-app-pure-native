# Logo and asset cleanup report

Updated from the new logo provided by the user:

- `webapp/public/icons/favicon-32.png`
- `webapp/public/icons/icon-192.png`
- `webapp/public/icons/icon-512.png`
- `mobile/assets/icon.png`
- `mobile/assets/splash.png`
- Android launcher icons in `mobile/android/app/src/main/res/mipmap-*`
- Android splash logos in `mobile/android/app/src/main/res/drawable-*`

Removed obsolete old images:

- `webapp/public/home-hero-background.png`
- `webapp/public/home-hero-logo-custom.png`
- `webapp/public/logo-placeholder.svg`

All references to the removed old images were redirected to the current logo icon path `/icons/icon-512.png` so the web/CMS build does not request deleted files.
