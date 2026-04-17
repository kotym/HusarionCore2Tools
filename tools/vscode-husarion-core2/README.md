# Husarion CORE2 Development Tools

VS Code extension for Husarion CORE2 project creation, build, flash, and serial console workflows.

This extension is community-maintained and not an official Husarion release.

## Quick Start

1. Install from the HusarionCore2Tools package:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1
```

2. Restart VS Code.
3. Open Command Palette and run commands starting with `Husarion:`.

### Flashing driver setup
For flashing CORE2 install Zadig and replace FT231X drivers using this guide:
https://husarion.com/tutorials/deprecated/offline-development-tools/

## Requirements

- Windows
- PowerShell 5.1+
- VS Code

The extension can install missing build tools (CMake, Ninja, GNU Arm Embedded Toolchain) using package managers when available.

## Commands

| Command | Purpose |
|---------|---------|
| `Husarion: Create CORE2 Project` | Create a new project from template |
| `Husarion: Build Project (No Flash)` | Build firmware without flashing |
| `Husarion: Rebuild Project (Clean All Build Dirs)` | Full clean rebuild after path or cache issues |
| `Husarion: Build + Flash Project to CORE2` | Build and flash in one step |
| `Husarion: Flash Latest HEX (No Build)` | Flash previously generated HEX |
| `Husarion: Open CORE2 Serial Console` | Open serial monitor |
| `Husarion: Install Required Toolchain and Components` | Install/refresh dependencies |
| `Husarion: Check for Updates` | Manually check GitHub release updates |

## Updates

- Startup checks can be disabled via `husarionCore2.checkUpdatesOnStartup`.
- Prompt modes:
	- `Install update (delete old install)` removes previous bundle folder from `HFRAMEWORK_PATH`.
	- `Install update (keep old install)` leaves previous bundle folder.
- Updates are installed from release ZIP by running package `install.bat` in an update terminal.

## Configuration

The extension reads these VS Code settings:

| Setting | Default | Purpose |
|---------|---------|---------|
| `husarionCore2.hframeworkPath` | auto | Path to hFramework source |
| `husarionCore2.templatePath` | auto | Project template location |
| `husarionCore2.flasherPath` | auto | Flasher utility location |
| `husarionCore2.boardType` | `core2` | Target board type |
| `husarionCore2.hSensorsPath` | auto | Path to hSensors module |
| `husarionCore2.hModulesPath` | auto | Path to hModules module |
| `husarionCore2.openProjectInNewWindow` | `false` | Open new projects in a separate window |
| `husarionCore2.checkUpdatesOnStartup` | `true` | Check GitHub releases at startup and offer update installation |
| `husarionCore2.updateRepository` | `kotym/HusarionCore2Tools` | GitHub repository used for release checks |

To disable startup update checks, set `husarionCore2.checkUpdatesOnStartup` to `false` in VS Code settings.

## Typical Workflow

1. Run `Husarion: Create CORE2 Project`.
2. Flash with `Husarion: Build + Flash Project to CORE2`.
3. Use `Husarion: Open CORE2 Serial Console` for runtime logs.

## Troubleshooting

- **If you move or rename the installation folder, re-run `install.bat` to repair all paths.**
- If commands are missing in the Command Palette, restart VS Code.
- If build tools are missing, run `Husarion: Install Required Toolchain and Components`.
- If toolchain was just installed, restart VS Code so PATH updates are picked up.
- Updates install into the same parent directory as the current `HFRAMEWORK_PATH` installation.
- Extension cleanup in `%USERPROFILE%\.vscode\extensions` is handled by `install.bat` / `tools/install/install-package.ps1`.