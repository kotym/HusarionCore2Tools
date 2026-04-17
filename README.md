# Husarion CORE2 Tools Bundle

Community-maintained Husarion CORE2 bundle for packaging and deployment. This is not an official Husarion repository.

## Repository Contents

This bundle imports three upstream Husarion repositories:

- `hFramework`: core framework and STM32 port sources ([upstream](https://github.com/husarion/hFramework))
- `hSensors`: optional sensor module ([upstream](https://github.com/husarion/hSensors))
- `hModules`: optional module collection ([upstream](https://github.com/husarion/modules))

Local tooling:

- `tools/install`: distribution builder and package installer.
- `tools/vscode-husarion-core2`: VS Code extension used by end users.

## API Documentation

Comprehensive class and workflow guides for the bundled components:

- `hFramework/docs/comprehensive-api-guide.md`
- `hModules/docs/comprehensive-api-guide.md`
- `hSensors/docs/comprehensive-api-guide.md`

## Prerequisites (Development Machine)

- Windows PowerShell 5.1+
- Node.js LTS (`npx` available) for VSIX packaging
- CMake, Ninja, and GNU Arm Embedded Toolchain for local compile checks

## Build Distribution Package

From repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\build-distribution-package.ps1 -Version vX.Y.Z
```

Output:

- `dist\HusarionCore2Tools-vX.Y.Z.zip`

The produced ZIP is end-user focused. It includes runtime/install assets and excludes development-only artifacts.

## Install and Use Package (End User)

1. Extract `HusarionCore2Tools-vX.Y.Z.zip`.
2. Run `install.bat` in the extracted root, or run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1
```

3. Restart VS Code.
4. Use Command Palette commands starting with `Husarion:`.

## Build VS Code Extension (Development)

From `tools\vscode-husarion-core2`:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-vsix.ps1
```

Output:

- `tools\vscode-husarion-core2\dist\<publisher>.<name>-<version>.vsix`

Install locally for test:

```powershell
code --install-extension .\tools\vscode-husarion-core2\dist\<publisher>.<name>-<version>.vsix --force
```

## Key Scripts

- Source release builder: `tools\install\build-distribution-package.ps1`
- Package installer: `tools\install\install-package.ps1`
- Toolchain refresh helper: `tools\vscode-husarion-core2\scripts\install-or-refresh-toolchain.ps1`
- Extension VSIX builder: `tools\vscode-husarion-core2\build-vsix.ps1`

## Troubleshooting

### PowerShell command errors about `ExecutionPolicy`

Always start with `powershell`:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1
```

### Toolchain install is slow on first run

`winget` first-run initialization can take noticeable time in clean environments.

### Extension commands not visible

1. Verify extension exists in `%USERPROFILE%\.vscode\extensions`.
2. Restart VS Code fully.
3. Re-run installer with `-SkipToolchainInstall` if needed.
