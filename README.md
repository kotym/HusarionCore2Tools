# Husarion CORE2 Tools Bundle

Community-maintained Husarion CORE2 bundle for packaging and deployment.
This is not an official Husarion repository.

## Quick Start (Install and Use)

1. Extract `HusarionCore2Tools-vX.Y.Z.zip`.
2. Run `install.bat` in the extracted folder.
3. Restart VS Code.
4. Open Command Palette and run commands starting with `Husarion:`.

**Important:** If you move or rename the installation folder after initial setup, you must re-run `install.bat` (or the install command below) to repair all internal paths and ensure the extension works correctly.

Alternative installer command (from extracted folder):
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1
```

### Flashing driver setup
For flashing CORE2 install Zadig and replace FT231X drivers using this guide:
https://husarion.com/tutorials/deprecated/offline-development-tools/

## Main Commands

- `Husarion: Create CORE2 Project`
- `Husarion: Build Project (No Flash)`
- `Husarion: Rebuild Project (Clean All Build Dirs)`
- `Husarion: Build + Flash Project to CORE2`
- `Husarion: Flash Latest HEX (No Build)`
- `Husarion: Open CORE2 Serial Console`
- `Husarion: Install Required Toolchain and Components`
- `Husarion: Check for Updates`

## Updates

- The extension checks GitHub releases on startup and can offer guided in-editor update installation.
- To disable startup checks, set `husarionCore2.checkUpdatesOnStartup` to `false` in VS Code settings.
- Update prompt modes:
	- `Install update (delete old install)` removes the previous bundle folder pointed by `HFRAMEWORK_PATH`.
	- `Install update (keep old install)` keeps the previous bundle folder.
- Automatic update downloads a new release ZIP, extracts it, and runs `install.bat` from the new bundle path.

## Troubleshooting

### Extension commands are missing

1. Verify extension exists in `%USERPROFILE%\.vscode\extensions`.
2. Restart VS Code fully.
3. Re-run installer with `-SkipToolchainInstall` if needed.

### Build fails after installation path move/rename

If you move or rename the installation folder, re-run `install.bat` (or the install command above) to repair all paths. Then, if build still fails, use `Husarion: Rebuild Project (Clean All Build Dirs)`.

### PowerShell errors about `ExecutionPolicy`

Always run scripts through `powershell`:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1
```

## Repository Contents

This bundle imports three upstream Husarion repositories:

- `hFramework`: core framework and STM32 port sources ([upstream](https://github.com/husarion/hFramework))
- `hSensors`: optional sensor module ([upstream](https://github.com/husarion/hSensors))
- `hModules`: optional module collection ([upstream](https://github.com/husarion/modules))

Local tooling:

- `tools/install`: distribution builder and package installer
- `tools/vscode-husarion-core2`: VS Code extension used by end users

## API Documentation

Comprehensive class and workflow guides for bundled components:

- `hFramework/docs/comprehensive-api-guide.md`
- `hModules/docs/comprehensive-api-guide.md`
- `hSensors/docs/comprehensive-api-guide.md`

## Development

### Prerequisites (Development Machine)

- Windows PowerShell 5.1+
- Node.js LTS (`npx` available) for VSIX packaging
- CMake, Ninja, and GNU Arm Embedded Toolchain for local compile checks

### Build Distribution Package

Run from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\build-distribution-package.ps1 -Version vX.Y.Z
```

Output:

- `dist\HusarionCore2Tools-vX.Y.Z.zip`

The produced ZIP is end-user focused. It includes runtime/install assets and excludes development-only artifacts.

### Build VS Code Extension (VSIX)

Run from `tools\vscode-husarion-core2`:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-vsix.ps1
```

Output:

- `tools\vscode-husarion-core2\dist\<publisher>.<name>-<version>.vsix`

Install VSIX locally for test:

```powershell
code --install-extension .\tools\vscode-husarion-core2\dist\<publisher>.<name>-<version>.vsix --force
```

### Key Scripts

- Source release builder: `tools\install\build-distribution-package.ps1`
- Package installer: `tools\install\install-package.ps1`
- Toolchain refresh helper: `tools\vscode-husarion-core2\scripts\install-or-refresh-toolchain.ps1`
- GitHub update installer: `tools\vscode-husarion-core2\scripts\update-from-github.ps1`
- Extension VSIX builder: `tools\vscode-husarion-core2\build-vsix.ps1`
