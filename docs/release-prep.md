# Store release preparation

Capacitor 8 wraps the built web app (`dist/`) for iOS and Android. The native projects live in `ios/` and
`android/` and are committed. The release requirements R1 to R6 stay in `docs/monetization.md`.

## Commands

```bash
npm run cap:sync      # build the web app and copy it into both native projects
npm run cap:ios       # sync, then open Xcode
npm run cap:android   # sync, then open Android Studio
```

Android builds need JDK 21 and the SDK at `~/Library/Android/sdk`:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21 ANDROID_HOME=$HOME/Library/Android/sdk
cd android && ./gradlew assembleDebug bundleRelease
```

Run `npm run cap:sync` after every web change; the native shells hold a copy of `dist/`.

## Identity

| Field | Value | Where |
|---|---|---|
| App id | `com.tacticallyidle.app` | `capacitor.config.ts`, Xcode, `android/app/build.gradle`. Permanent once a listing exists. |
| iOS version | `MARKETING_VERSION` 1.0, `CURRENT_PROJECT_VERSION` 1 | Xcode target. Build number rises on every upload. |
| Android version | `versionName` 1.0, `versionCode` 1 | `android/app/build.gradle`. Code rises on every upload. |
| Minimums | iOS 15.0, Android minSdk 24, target 36 | Xcode, `android/variables.gradle` |

Icons and splash come from `resources/` (full-bleed mark from `public/brand/icon-maskable.svg`, solid `#0e1624`
splash). Regenerate with `npx @capacitor/assets@3 generate --iconBackgroundColor '#0e1624' --splashBackgroundColor '#0e1624'`,
then `git checkout public/` because the tool also rewrites PWA files there.

## State on 2026-10-25

Observed in this session:
- iOS Debug build for the simulator succeeds, and the game ran on the iPhone 17 Pro simulator (first-run content screen).
- Android `assembleDebug` and `bundleRelease` succeed (the bundle contains the font files). The release bundle is unsigned.

Not done or not observed:
- Nothing has run on a real iPhone or Android phone, or in an Android emulator.
- Save survival across an app restart, safe-area, keyboard and text-zoom checks on device.
- Signing, store accounts, listings, ads, billing.

## Needs the owner

1. Apple Developer Program and Google Play Console accounts, and the final app id and display name.
2. Android upload key: generate once, keep in 1Password (see `~/Developer/Guides/Secrets-1Password.md`), add a release
   `signingConfig` that reads it from the environment. Never commit the keystore. Enrol in Play App Signing.
3. iOS signing team in Xcode (automatic signing is enough to start).
4. A privacy policy URL (R1) and the age-rating questionnaires (target ESRB M, PEGI 16; adult-only audience on Play).
5. Store listing text, screenshots at store sizes, and the App Privacy and Data safety answers (R2).

## Open risks found while wrapping

- **Fonts are self-hosted** in `public/fonts/` (latin and latin-ext subsets, `fonts.css`). `harness.html` and `locations.html` still link Google Fonts (Barlow); they are dev pages, but they ship in `dist/` until removed from the build inputs.
- **Ads and billing plugins are not installed.** AdMob, UMP and RevenueCat arrive with `patrol-boosts` and `real-purchases`.
  Each adds native config (Info.plist keys, ATT purpose string, `AndroidManifest.xml` app ids) and changes the privacy answers.
- **Build size.** One JS chunk is about 1 MB minified. Fine for a bundled app, not a blocker.
- **Orientation is locked to portrait** on iOS (`Info.plist`, plus `UIRequiresFullScreen` so iPad accepts a portrait-only list) and Android (`screenOrientation` in `AndroidManifest.xml`). iPad is therefore a letterboxed portrait app.

## Release path

1. Fix the open risks above and the owner items.
2. On a real iPhone and an Android phone: install the debug build, play a call, kill the app, confirm the save loads; check
   safe areas, keyboard and 200% text.
3. iOS: Archive in Xcode, upload to App Store Connect, run TestFlight internal testing.
4. Android: signed `bundleRelease`, upload to the Play internal testing track.
5. Submit for review after R1 to R6 pass.
