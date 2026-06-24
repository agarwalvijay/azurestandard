# Release kit — Azure Standard (Unofficial)

Everything needed to publish to Google Play. The signed bundle to upload is
**`AzureStandard-release.aab`** (copied here; also at the repo root).

## Contents
```
release/
├── AzureStandard-release.aab          # << upload this to Play
├── AzureStandard-release.apk          # for sideload/testing only
├── graphics/
│   ├── play-icon-512.png              # Store icon (512×512)
│   └── feature-graphic-1024x500.png   # Feature graphic (required)
├── screenshots/
│   ├── 01-splash-framed.png           # phone screenshots (1080×2400)
│   ├── 02-store-framed.png
│   ├── 03-scan-framed.png
│   ├── 01-splash.png                  # full-bleed splash (alt, unframed)
│   └── raw/                           # raw device captures (unframed)
└── listing/
    └── store-listing.md               # title / short / full description
```

## Build facts
- **applicationId:** com.atsumilabs.azurestandard
- **versionCode:** 1 · **versionName:** 1.0  (bump versionCode for every future upload)
- **minSdk 22 → targetSdk 35**, signed with `azure-release.keystore` (your **upload key** — back it up)
- No ad SDK. Permissions: INTERNET, CAMERA (scanner), AD_ID (declared, unused), POST_NOTIFICATIONS

## Upload steps (Play Console)
1. Create app → **default language en-US**, app (not game), Free.
2. **Internal testing** track → Create release → upload `AzureStandard-release.aab`.
   On first upload, accept **Play App Signing**.
3. Add testers by email (up to 100) → share the opt-in link. *(Recommended first step — low trademark exposure, usable today.)*
4. Main store listing → paste `listing/store-listing.md`, upload `graphics/` + `screenshots/`.
5. Complete the required forms (below), then roll out to Internal testing. Promote to Production only after the trademark question is settled.

## Data safety form answers
- **Does the app collect or share user data?** Yes (minimal).
  - **Device IDs / push token** — Collected, *not* shared. Purpose: App functionality (push notifications). Not used for tracking. Can't be deleted by user in-app but stops on uninstall / disabling notifications.
  - **Camera** — Used in-app for the website's barcode scanner; **not collected/stored/transmitted** by the app (so it isn't a data type you "collect").
  - **Advertising ID** — Permission declared but **not accessed**; if Console insists you list it, mark "not collected/used" and explain in notes. (Cleanest alternative: remove the AD_ID permission — ask the dev.)
- **Encryption in transit:** Yes (HTTPS).
- **No analytics, no data sold.**

## Content rating
- Questionnaire → category Shopping; answer "No" to all sensitive-content questions → expect **Everyone**.

## ⚠️ Before going Production (read)
Public listing under the "Azure Standard" name carries trademark/impersonation risk even with the logo removed. Safest paths: keep it on **Internal testing**, or get **written permission** from Azure Standard. See the app's Terms (https://azurestandard.atsumilabs.com/terms) for the rights-holder contact line.
