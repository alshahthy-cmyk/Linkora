# Expo Build State

On 2026-08-14, the authenticated Expo account `@alshahthyameer` showed one project named `mobile`, linked to `alshahthy-cmyk/Linkora`. The project card reported **Android build failed 12 minutes ago**. The next diagnostic step is to open that existing project and inspect its failed Android build log before initiating another build.

Source: https://expo.dev/accounts/alshahthyameer

The project card exposes a direct link labelled `Android build failed 12 minutes ago`. The Expo page refreshed before that link could be opened, so the next step is to reload the page and use the refreshed build-link reference.

## Latest failed Android build

The newest failed build is `f901b563-d0f8-42ab-b55f-e0c94c271661`, created at 2026-08-14 03:46 AM. It ran the `preview` profile against the `production` environment, with Expo SDK 54.0.0, version `1.0.0 (1)`, commit `a5bdb0a` (`config: connect Android builds to Railway signal service`), and failed after 14 seconds of build time. The Expo page stated that this failed build did not consume EAS Build usage. The remaining detailed log is below the viewport and must be read next.

Source: https://expo.dev/accounts/alshahthyameer/projects/mobile/builds/f901b563-d0f8-42ab-b55f-e0c94c271661

## Confirmed failure cause

The detailed EAS log shows that the build detected `artifacts/mobile` as a pnpm workspace and ran `pnpm install --frozen-lockfile` across all 9 workspace packages. It immediately failed with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`: the `overrides` configuration in the repository package manifest does not match the value recorded in `pnpm-lock.yaml`. The fix is to regenerate and commit the workspace lockfile using the current manifest configuration, then verify it with the frozen install used by EAS.

The tool-installation log confirms that EAS installed Node `20.18.0` and **pnpm `10.17.1`**, matching the repository's pinned package-manager version. Therefore the failure is not caused by Expo choosing pnpm 9; the exact commit archived by the remote builder must be compared with the local lockfile and workspace policy.

## Local reproduction

The current remote `main` head, the local execution branch head, and the commit submitted to EAS are all `a5bdb0a57807ae05fa59d6e7a1357884b1252f6a`. A new Git worktree checked out at exactly that commit passed both `pnpm install --frozen-lockfile` and the same command with `CI=1`, `EAS_BUILD_PLATFORM=android`, and `EAS_BUILD_PROFILE=preview`. It also passed when invoked from `artifacts/mobile`. This demonstrates that the tracked lockfile and workspace policy are internally consistent under Node/pnpm available locally.

## Supporting references

Expo's monorepo guidance requires EAS configuration files to remain in the mobile app directory and expects EAS commands to run from that app directory. Its lifecycle documentation confirms that `eas-build-pre-install` runs before dependency installation, but it should not be used to silently regenerate a lockfile because that would weaken reproducibility. pnpm's settings documentation states that project settings such as `overrides` are sourced from `pnpm-workspace.yaml`, while `.npmrc` is limited to auth and registry settings. The next targeted intervention should therefore make EAS clearly recognize the workspace configuration rather than remove the repository's dependency controls.

- https://docs.expo.dev/build-reference/build-with-monorepos/
- https://docs.expo.dev/build-reference/npm-hooks/
- https://pnpm.io/pnpm-workspace_yaml

## Expo project settings check

The project settings page for `@alshahthyameer/mobile` is available and its navigation exposes a dedicated **GitHub** settings section. A direct guessed URL for that section returned a 404, so it must be opened from the in-page navigation rather than constructed manually. No project values were changed during this inspection.

## GitHub build form

The Expo Builds page confirms that `alshahthy-cmyk/Linkora` was connected to the project. The **Build from GitHub** form asks for a base directory, platform, Git ref, build profile, and environment. It also displays an iOS-credentials warning, which is not relevant to the planned Android-only APK. The next build must use the mobile directory `artifacts/mobile`, Git ref `70ea070b6ade98569ffc2a61eab8c60019cc908d`, platform Android, and the `preview` EAS profile.

The form source confirms that the base-directory field defaults to `/` and is named `baseDirectory`; the Git reference field is `gitRef`; and the build profile field is `buildProfile`. The form has a final submit button labelled Confirm. A container-scroll request timed out in the connected browser, so the fields will be addressed directly by their displayed positions or through the EAS command-line fallback rather than retrying the same scroll action.

## Build attempt: bcb81dd4

The user submitted the GitHub build with the full `70ea070b6ade98569ffc2a61eab8c60019cc908d` commit hash. Expo created Android build `bcb81dd4-677a-4c0e-9863-3771ef0a6c44` using the `preview` profile and `preview` environment, but the build errored after 58 seconds. The build details screen exposes its logs; those logs must be inspected before applying another source change.

## Confirmed cause of build bcb81dd4

The build installed dependencies successfully, including the new pre-install hook. It then failed while resolving build configuration with `EAS project not configured`. The mobile `app.json` already specifies the Expo owner (`alshahthyameer`), but it lacks the immutable EAS project identifier under `expo.extra.eas.projectId`. The required correction is to initialize or retrieve the existing EAS project identifier for `@alshahthyameer/mobile`, add it to `app.json`, verify that Expo resolves the configuration, and then rebuild.

The existing project's Expo **Details** panel confirms that its immutable EAS project identifier is `601926ee-67ef-4158-8a3f-f3333dc1a298`. This value will be placed exactly at `expo.extra.eas.projectId`; no new Expo project will be created.

## Current feature-expansion build

في 14 أغسطس 2026، ظهرت في صفحة Expo عملية بناء Android جديدة من الملف `preview` ومن Git commit `8050cc1` المرتبط بتوسعة الرسائل والوسائط وWebRTC. كانت العملية قيد التنفيذ عند آخر فحص ويجب متابعة نتيجتها قبل تسليم رابط التثبيت. اجتاز خادم الإشارة المنشور بعد التحديث اختبار تمرير الرسائل وإشارة WebRTC عبر `wss://workspaceapi-server-production-5881.up.railway.app/api/signal`.

رقم عملية البناء هو `7f1ddbb2-d58e-4a34-a9f3-6c34f4133b3f`، ورابط المتابعة هو https://expo.dev/accounts/alshahthyameer/projects/mobile/builds/7f1ddbb2-d58e-4a34-a9f3-6c34f4133b3f. عند أحدث فحص، نجحت خطوات تثبيت الحزم وتهيئة Expo والحزم الأصلية وBundling JavaScript، وكانت Gradle تترجم مكونات Android الأصلية، بما فيها مكونات WebRTC الجديدة. لم يظهر خطأ وقتها.

استمر Gradle إلى ما بعد 8 دقائق و52 ثانية. ظهر أن `react-native-webrtc` و`react-native-incall-manager` اجتازا مراحل المعالجة وإعداد فحص الإصدار، ولم تظهر أخطاء منهما. أحدث السجل يتضمن تحذيرات Kotlin بشأن رموز قديمة داخل Expo SDK 54 فقط؛ وهي تحذيرات غير مانعة ولم يعلن البناء فشلاً. بقيت الحالة `Build in progress` في وقت التسجيل.

عند 13 دقيقة و42 ثانية، اكتملت بنجاح خطوة Gradle (12 دقيقة و27 ثانية) وخطوة Gradle build profile. أنشأ Expo ملف Android في المسار `artifacts/mobile/android/app/build/outputs/apk/release/app-release.apk` بحجم 136 MB، ثم بدأ رفعه. ظلت الحالة `Build in progress` فقط لأن رفع الأرشيف لم يكتمل بعد؛ ولا يوجد خطأ في السجل.

## APK الموسع الناجح

اكتمل بنجاح البناء `7f1ddbb2-d58e-4a34-a9f3-6c34f4133b3f` في 14 أغسطس 2026. البناء مرتبط بالالتزام `8050cc1` بعنوان `feat: expand messaging media and WebRTC calls`، ويستخدم ملف `preview` وبيئة `production`. الناتج APK بحجم 136 MB، وتظهر له حالة `Finished` وزر `Download` في صفحة Expo. تبقى صلاحية التنزيل 29 يوماً من وقت البناء.
