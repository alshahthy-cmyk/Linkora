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
