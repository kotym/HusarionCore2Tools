# Husarion CORE2 Tools Bundle

This is an independent community-maintained distribution bundle and is NOT an official Husarion repository.

This repository is a clean distribution bundle containing:

- `hFramework`
- `hSensors`
- `hModules`

It is prepared for in-house distribution and GitHub release packaging.

## Included tooling

Primary scripts:

1. Source repo (release builder):
   - `tools/install/build-distribution-package.ps1`
2. Inside released package (full install):
   - `tools/install/install-package.ps1`
3. Inside released package and used by extension command (toolchain refresh):
   - `tools/vscode-husarion-core2/scripts/install-or-refresh-toolchain.ps1`

Compatibility wrappers are still present for old names, but these three are the supported interface.

## Quick start

Build distributable package from source repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\build-distribution-package.ps1 -Version vX.Y.Z
```

Then users extract the generated zip and **either click `install.bat`** or run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1
```

## Notes

- Build outputs, cache files, VSIX artifacts, and temporary files are excluded by the top-level `.gitignore`.
- This repo is intended to be the canonical clean source bundle for release creation.

## GitHub release recommendations

Upload one artifact created by `build-distribution-package.ps1`:

- `HusarionCore2Tools-vX.Y.Z.zip`

The package is intentionally stripped for use (not development):

- removed: `.github`, `.git*`, docs/tests/examples/devtools/build caches
- kept: required framework/module sources, Windows flasher, extension runtime, and install scripts

## Troubleshooting

### Error: "Cannot bind parameter 'Scope'. Cannot convert value Bypass..."

**Cause:** The command is missing the `powershell` prefix.

**Wrong:**
```powershell
ExecutionPolicy Bypass -File install-package.ps1
```

**Correct:**
```powershell
powershell -ExecutionPolicy Bypass -File install-package.ps1
```

The `-ExecutionPolicy Bypass` flag is an argument for `powershell.exe` itself. Without the `powershell` prefix, PowerShell tries to interpret `ExecutionPolicy` as a command, which fails.

### "Checking required toolchain commands" takes a long time

**Cause:** On first run, `winget` initializes its package index and catalog in the background, which can take 30-60 seconds or longer depending on network speed and disk performance.

**Solution:** This is normal. The script displays progress for each check and installation. Wait for it to complete. Subsequent runs will be much faster.

### Extension not appearing in VS Code command palette

**Cause:** The extension folder may not have been installed correctly, or VS Code needs to rediscover extensions.

**Solution:**

1. Verify the extension folder exists at:
   ```
   %USERPROFILE%\.vscode\extensions\local.husarion-core2-tools-0.1.0
   ```

2. Check that it contains these files:
   - `package.json`
   - `extension.js`
   - `README.md`
   - `scripts/` folder

3. Restart VS Code completely (File → Exit, then reopen)

4. Open Command Palette (Ctrl+Shift+P) and search for: `Husarion`

   You should see commands like:
   - `Husarion: Create CORE2 Project`
   - `Husarion: Build Project (No Flash)`
   - etc.

5. If still not found, try:
   ```powershell
   # Reinstall extension only (skip toolchain)
   powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1 -SkipToolchainInstall -KeepOtherExtensionVersions
   ```

### Toolchain installation fails (winget not found, choco not found)

**Cause:** Neither `winget` nor Chocolatey package managers are installed on your system.

**Solution:** Install packages manually:

1. **CMake:** https://cmake.org/download/
2. **Ninja:** https://github.com/ninja-build/ninja/releases (download binary and add to PATH)
3. **GNU Arm Embedded Toolchain:** https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads

After installation, add all three to your system PATH and restart your terminal/VS Code:

```powershell
# Verify installation (should return version)
cmake --version
ninja --version
arm-none-eabi-g++ --version
```
