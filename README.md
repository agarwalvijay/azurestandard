# Azure Standard — mobile app (unofficial)

A cross-platform (iOS + Android) native shell around **azurestandard.com** so you
can order from your phone. Built with [Capacitor](https://capacitorjs.com/).
It boots a branded splash, sets up **push notifications**, then hands the WebView
to the live, mobile-friendly store — so login, cart, and checkout all work
against the real site. No ads, no analytics.

> ⚠️ **Unofficial / personal use.** "Azure Standard", its logo, and the eagle mark
> are trademarks of Azure Standard. This wrapper uses their public site and brand
> assets for your own convenience. Publishing it to the App Store / Play Store
> under their marks would require their permission. All branding is kept in
> swappable files (`app/resources/`, `app/www/assets/`) so it's easy to rebrand.

## What's in here

```
azure/
├── app/                      # Capacitor app (the phone app)
│   ├── www/                  # local splash shell + bootstrap (push → redirect)
│   ├── resources/            # icon.png / splash.png sources (from Azure's logo)
│   ├── google-services.json  # your Firebase Android config (package com.atsumilabs.azurestandard)
│   └── capacitor.config.json
└── backend/                  # Node + Firebase Admin push server
    ├── server.js
    └── .env.example
```

- **Firebase project:** `azure-standard` (project #147990115601)
- **App ID / Android package:** `com.atsumilabs.azurestandard`

---

## 1. Build & run the app

**Prereqs:** Node 18+, Xcode (for iOS), Android Studio (for Android), CocoaPods (`sudo gem install cocoapods`).

```bash
cd app
npm install

# generate app icons + splash from the Azure logo in resources/
npx capacitor-assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'

# add the native platforms (creates app/ios and app/android)
npx cap add ios
npx cap add android

npx cap sync
```

### Android wiring
1. Copy the Firebase config into place:
   ```bash
   cp google-services.json android/app/google-services.json
   ```
   (Already matches package `com.atsumilabs.azurestandard`.)
2. Run: `npx cap run android` (or `npx cap open android` and run from Android Studio).

### iOS wiring
1. In the [Firebase console](https://console.firebase.google.com/project/azure-standard), add an **iOS app**
   with bundle id `com.atsumilabs.azurestandard`, download **GoogleService-Info.plist**, and drop it into
   `app/ios/App/App/` (and add it to the Xcode target).
2. In Xcode → **Signing & Capabilities**, add **Push Notifications** and **Background Modes → Remote notifications**.
3. Add `NSCameraUsageDescription` to `Info.plist` (the site's barcode scanner uses the camera).
4. Run: `npx cap run ios` (or open in Xcode).

---

## 2. Push notifications

### Backend
```bash
cd backend
npm install
cp .env.example .env
# In Firebase console → Project settings → Service accounts → Generate new private key
# save it as backend/service-account.json (GOOGLE_APPLICATION_CREDENTIALS points to it)
npm start          # → http://localhost:8080
```

For **iOS** push to actually deliver, upload an **APNs Auth Key** (.p8) in
Firebase console → Project settings → Cloud Messaging → Apple app configuration.

### Connect the app to the backend
Edit `app/www/app.js` → `CONFIG.BACKEND_URL`. For a phone testing against your Mac,
use your machine's LAN IP (e.g. `http://192.168.1.50:8080`), not `localhost`.
Deploy the backend (Railway / Render / Fly / Cloud Run) and use that URL for real builds.

### Send a test notification
```bash
curl -X POST http://localhost:8080/send \
  -H "Content-Type: application/json" \
  -H "x-admin-key: <your ADMIN_KEY>" \
  -d '{"title":"Drop deadline soon","body":"Your Azure Standard drop closes Friday.","url":"https://www.azurestandard.com/"}'
```
Tapping the notification opens the `url` in the app. Endpoints: `POST /register`,
`POST /send`, `GET /tokens`, `GET /health`.

---

## 3. Ads

No ad SDK ships. AdMob was removed; only the Android **Advertising ID**
declaration (`com.google.android.gms.permission.AD_ID`) is kept in the manifest
to leave the door open for ads later. Re-add `@capacitor-community/admob` if you
decide to monetize.

---

## How it works

1. App opens the **local** `www/index.html` splash (brand eagle + spinner).
2. `app.js` runs *our* code: requests notification permission, registers the FCM
   token with the backend.
3. It then redirects the WebView to `https://www.azurestandard.com/`. The native
   push token persists, so notifications keep working while you shop.

## Roadmap
- [ ] Deep links from notifications to specific products / the cart
- [ ] Drop-deadline reminders (schedule from the backend)
- [ ] Biometric unlock, offline "saved cart" cache
