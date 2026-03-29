# Husarion CORE2 Tools (Local VS Code Extension)

This extension package in this repository is community-maintained and not an official Husarion release.

This extension provides CORE2 workflow commands that replace the core workflow of the broken Husarion extension:

1. `Husarion: Create CORE2 Project`
2. `Husarion: Build Project (No Flash)`
3. `Husarion: Build + Flash Project to CORE2`
4. `Husarion: Flash Latest HEX (No Build)`
5. `Husarion: Open CORE2 Serial Console`
6. `Husarion: Install Required Toolchain and Components`

## Commands

### Create CORE2 Project
- Copies template files from `project_template` (by default from your hFramework path).
- Creates a new folder `<selected-parent>/<project-name>`.
- Patches `CMakeLists.txt` to:
  - set `HFRAMEWORK_PATH` to configured path,
  - rename executable target from `myproject` to your project name.

### Build Project (No Flash)
- Builds enabled modules (`hSensors`, `hModules`) first when found.
- Runs configure + build in project root and waits for completion:
  - `cmake -S <project> -B <project>/build -GNinja -DBOARD_TYPE=core2 -DCMAKE_POLICY_VERSION_MINIMUM=3.5`
  - `ninja -C <project>/build <target>.hex`

### Build + Flash Project to CORE2
- Runs the build flow above.
- Calls `core2-flasher.exe <file.hex>`.

### Flash Latest HEX (No Build)
- Finds newest `.hex` file in `build`.
- Calls `core2-flasher.exe <file.hex>`.

### Open CORE2 Serial Console
- Calls `core2-flasher.exe --console`.

### Install Required Toolchain and Components
- Runs bundled installer helper script from extension package.
- Checks for `cmake`, `ninja`, and `arm-none-eabi-g++`.
- If missing, it first tries offline installer script (if provided), then `winget`, then `choco`.
- Optionally installs VS Code C/C++ extension (`ms-vscode.cpptools`).

## Settings

- `husarionCore2.hframeworkPath` (default: empty, auto-detect)
- `husarionCore2.templatePath` (optional override)
- `husarionCore2.flasherPath` (optional override)
- `husarionCore2.boardType` (default: `core2`)
- `husarionCore2.hSensorsPath` (optional override)
- `husarionCore2.hModulesPath` (optional override)
- `husarionCore2.openProjectInNewWindow` (default: `false`)

## Quick local test in VS Code

1. Open this folder as extension source.
2. Press `F5` to run Extension Development Host.
3. In the new VS Code window, run commands from Command Palette.

## Notes

- This extension is intentionally minimal and local-first.
- It assumes PowerShell on Windows for the flasher command invocation.

## Install as normal extension (folder format)

This repository includes a helper script that creates a copy-ready extension folder named:

- `local.husarion-core2-tools-<version>`

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\pack-local-extension.ps1
```

Then copy the generated folder from `dist` into:

- `%USERPROFILE%\.vscode\extensions`

Restart VS Code after copying.

## Build VSIX package

To create a distributable `.vsix` package:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-vsix.ps1
```

The resulting file is created in `dist` as:

- `<publisher>.<name>-<version>.vsix`

Install on target machine:

```powershell
code --install-extension .\dist\<publisher>.<name>-<version>.vsix --force
```

After installation, run command palette action:

- `Husarion: Install Required Toolchain and Components`
