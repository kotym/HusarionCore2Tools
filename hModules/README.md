# hModules

Note: in this bundle repository, hModules is redistributed as part of a non-official, community-maintained package layout.

If you are using the VS Code extension bundle as an end user, start from the top-level `README.md` in repository root.
This file focuses on hModules itself.

hModules provides optional hardware-oriented components for hFramework projects (for example distance sensor and MPU9250-related modules).

## Documentation

- API guide: `docs/comprehensive-api-guide.md`
- Module docs index: `docs/index.md`

## Building hModules

This section describes how to build hModules from source.

1. Ensure dependencies are available:

   - `cmake`
   - `ninja`
   - GNU Arm Embedded Toolchain (`arm-none-eabi-g++` in `PATH`)
   - `hFramework` available as sibling folder (`../hFramework`) or via `HFRAMEWORK_PATH`

2. Configure and build.

   Typical bundle layout (with sibling `hFramework`):

   ```bash
   mkdir build
   cd build
   cmake -DBOARD_TYPE=core2 -GNinja ..
   ninja
   ```

   If `hFramework` is in a custom location, add explicit path:

   ```bash
   cmake -DBOARD_TYPE=core2 -DHFRAMEWORK_PATH=/path/to/hFramework -GNinja ..
   ninja
   ```

   Substitute `core2` with `core2mini` if building for CORE2mini.

## Bundle Helper Scripts

For rollout to multiple machines in this bundle repository, use helper scripts from repository root.

1. Install package (extension + toolchain):

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1
   ```

2. Install/update VS Code extension only (skip toolchain):

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1 -SkipToolchainInstall
   ```

3. Refresh/check toolchain only:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\tools\vscode-husarion-core2\scripts\install-or-refresh-toolchain.ps1
   ```
