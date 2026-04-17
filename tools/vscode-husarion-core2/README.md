# Husarion CORE2 Development Tools

VS Code extension for Husarion CORE2 project creation, build, flash, and serial console workflows.

This extension is community-maintained and not an official Husarion release.

## Requirements

- Windows
- PowerShell 5.1+
- VS Code

The extension can install missing build tools (CMake, Ninja, GNU Arm Embedded Toolchain) using package managers when available.

## Installation

Install from the HusarionCore2Tools package by running:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1
```

Then restart VS Code.

## Commands

- `Husarion: Create CORE2 Project`
- `Husarion: Build Project (No Flash)`
- `Husarion: Rebuild Project (Clean All Build Dirs)`
- `Husarion: Build + Flash Project to CORE2`
- `Husarion: Flash Latest HEX (No Build)`
- `Husarion: Open CORE2 Serial Console`
- `Husarion: Install Required Toolchain and Components`
- `Husarion: Check for Updates`

Update prompt offers two install modes:

- `Install update (delete old install)` removes the previous bundle folder pointed by `HFRAMEWORK_PATH`.
- `Install update (keep old install)` keeps the previous bundle folder.

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

- If commands are missing in the Command Palette, restart VS Code.
- If build tools are missing, run `Husarion: Install Required Toolchain and Components`.
- If toolchain was just installed, restart VS Code so PATH updates are picked up.
- Updates are installed from a GitHub release ZIP and run through package `tools/install/install-package.ps1` in an update terminal.
- Updates install into the same parent directory as the current `HFRAMEWORK_PATH` installation.
- If build fails after moving installation folders (for example path rename), use `Husarion: Rebuild Project (Clean All Build Dirs)`.
