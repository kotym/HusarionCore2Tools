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
- `Husarion: Build + Flash Project to CORE2`
- `Husarion: Flash Latest HEX (No Build)`
- `Husarion: Open CORE2 Serial Console`
- `Husarion: Install Required Toolchain and Components`

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

## Typical Workflow

1. Run `Husarion: Create CORE2 Project`.
2. Flash with `Husarion: Build + Flash Project to CORE2`.
3. Use `Husarion: Open CORE2 Serial Console` for runtime logs.

## Troubleshooting

- If commands are missing in the Command Palette, restart VS Code.
- If build tools are missing, run `Husarion: Install Required Toolchain and Components`.
- If toolchain was just installed, restart VS Code so PATH updates are picked up.
