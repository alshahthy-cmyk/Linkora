# Google Play publishing requirements for Linkora

Last reviewed: 2026-08-14.

## Confirmed facts

- New Android apps on Google Play must be uploaded as an Android App Bundle (`.aab`), not an installable APK. Google Play generates device-specific APKs from the AAB.
- The Linkora artifact provided by the user is an APK, confirmed by the public Expo artifact URL ending in `.apk`; it is suitable for direct test installation but must not be uploaded as the first Google Play release.
- Linkora's `eas.json` has a `preview` profile that explicitly sets `android.buildType` to `apk`, while its `production` profile has no APK override. Expo documents that the default production output is an `.aab`.
- Linkora already defines the permanent Android application identifier `com.alshahthyameer.linkora` and its EAS project ID in `artifacts/mobile/app.json`.
- A new Google Play application requires a Play Developer account, an app record in Play Console, Play App Signing acceptance, store listing information, content declarations, and an AAB release.
- Personal developer accounts created after 2023-11-13 must complete a closed test with at least 12 opted-in testers continuously for 14 days before requesting production access. Internal testing is recommended for early checks.
- From 2026-08-31, new apps and updates must target Android 16 / API level 36 or higher; this needs explicit verification in the production AAB before submission.
- The first AAB can be uploaded manually in Play Console. A Google service-account key is only required when using Expo EAS Submit to upload on the user's behalf.

## Official sources

1. Google Play Console Help, "Create and set up your app": https://support.google.com/googleplay/android-developer/answer/9859152?hl=en
2. Google Play Console Help, "App testing requirements for new personal developer accounts": https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
3. Android Developers, "About Android App Bundles": https://developer.android.com/guide/app-bundle
4. Android Developers, "Meet Google Play's target API level requirement": https://developer.android.com/google/play/requirements/target-sdk
5. Expo, "Build APKs for Android Emulators and devices": https://docs.expo.dev/build-reference/apk/
6. Expo, "Create a production build for Android": https://docs.expo.dev/tutorial/eas/android-production-build/
7. Expo, "Submit to the Google Play Store with EAS Submit": https://docs.expo.dev/submit/android/
