# Husarion CORE2 Development Tools (VS Code Extension)

This VS Code extension provides a streamlined development workflow for Husarion CORE2 embedded development (STM32F4 CPU).

**Note:** This extension is community-maintained and not an official Husarion release.

## Features

### Available Commands

1. **Create CORE2 Project** - Sets up a new embedded project with proper CMakeLists.txt configuration
2. **Build Project (No Flash)** - Compiles your project using CMake and Ninja
3. **Build + Flash Project to CORE2** - Builds and automatically flashes the HEX file to your board
4. **Flash Latest HEX (No Build)** - Programs the most recent HEX file without rebuilding
5. **Open CORE2 Serial Console** - Opens a serial terminal for debugging and monitor output
6. **Install Required Toolchain and Components** - Checks and installs essential development tools (CMake, Ninja, ARM compiler)

## How It Works

- **Project Creation:** Copies a template CMakeLists.txt and configures paths automatically
- **Build System:** Uses CMake + Ninja for fast, incremental builds
- **Flashing:** Integrates with the STM32F4 flasher utility for seamless programming
- **Toolchain Management:** Auto-detects or installs required compilers and build tools

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
| `husarionCore2.openProjectInNewWindow` | `false` | Open new projects in separate window |

## Quick Start

Extract the installation package and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-package.ps1
```

Then restart VS Code and start using the Husarion commands!

## Notes

- This extension runs exclusively on Windows with PowerShell 5.1+
- Requires: CMake, Ninja, and GNU ARM Embedded Toolchain (auto-installed if missing)
- Works with hFramework, hSensors, and hModules modules


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
