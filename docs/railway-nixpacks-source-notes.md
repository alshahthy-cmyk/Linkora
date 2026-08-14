# Railway Nixpacks Compatibility Notes

Railway deployment logs for this service showed the legacy Nixpacks builder selecting `pnpm-9_x`. The repository's frozen install succeeds with pnpm 10.17.1 and fails with pnpm 9 with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. The root `nixpacks.toml` overrides Nixpacks setup to use `pnpm-10_x`, and defines the server-specific install, build, and start commands.

Nixpacks automatically reads `nixpacks.toml` at the application root and merges the file configuration over its provider defaults. The Node provider supports selecting package-manager versions through the `packageManager` field/Corepack, but the explicit Nix package avoids depending on the detected default version in a legacy deployment. [1] [2]

[1]: https://nixpacks.com/docs/configuration/file "Nixpacks Configuration File Reference"
[2]: https://nixpacks.com/docs/providers/node "Nixpacks Node Provider"
