# Husarion CORE2 Tools Bundle

This repository is a clean distribution bundle containing:

- `hFramework`
- `hSensors`
- `hModules`

It is prepared for in-house distribution and GitHub release packaging.

## Included tooling

Inside `hFramework/tools`:

- `install/install-inhouse.ps1` - one-command bootstrap for framework/modules + extension install
- `install/bootstrap-hframework.ps1` - build/bootstrap helper
- `install/install-core2-extension.ps1` - local extension install helper
- `vscode-husarion-core2/build-vsix.ps1` - VSIX packaging helper
- `vscode-husarion-core2/scripts/install-deps.ps1` - dependency installer helper

## Quick start

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\hFramework\tools\install\install-inhouse.ps1
```

## Notes

- Build outputs, cache files, VSIX artifacts, and temporary files are excluded by the top-level `.gitignore`.
- This repo is intended to be the canonical clean source bundle for release creation.
