# Copilot Instructions For HusarionCore2Tools

## Project Identity
- This repository is a community-maintained distribution bundle and is **not** an official Husarion repository.
- Treat upstream projects as imported components inside this bundle:
  - `hFramework`
  - `hSensors`
  - `hModules`
- Keep this bundle usable for in-house deployment and release packaging.

## Repository Layout
- Top-level orchestration and release tooling lives in:
  - `tools/install`
  - `tools/vscode-husarion-core2`
- Framework and modules stay in their own top-level folders:
  - `hFramework`
  - `hSensors`
  - `hModules`
- Do not re-introduce extension/install tooling under `hFramework/tools` except board/runtime assets that belong to framework internals (e.g., `hFramework/tools/win`).

## Primary Workflows
- Bootstrap and build in-house environment:
  - `tools/install/install-inhouse.ps1`
- Build framework/modules only:
  - `tools/install/bootstrap-hframework.ps1`
- Package extension as VSIX:
  - `tools/vscode-husarion-core2/build-vsix.ps1`
- Install extension locally:
  - `tools/install/install-core2-extension.ps1`

## Path Resolution Rules
- Install scripts in `tools/install` must assume repository root at `..\..` from script location.
- Default hFramework root should be `repoRoot\hFramework`.
- Module autodetection should prefer coherent names first:
  - `hSensors`
  - `hModules`
- Legacy names can still be accepted as fallback for compatibility:
  - `hSensors-master`
  - `modules-master`
  - `hModules-master`

## Portability Rules
- Never hardcode machine-specific absolute paths.
- Never depend on dead/private download links.
- For toolchain setup scripts, use this order:
  1. Offline bundle hook (if provided)
  2. `winget`
  3. `choco`
  4. Explicit manual fallback message
- Required commands expected in PATH:
  - `cmake`
  - `ninja`
  - `arm-none-eabi-g++`

## Editing Rules
- Prefer minimal, targeted edits.
- Keep existing coding style and line endings.
- Avoid touching unrelated files.
- Do not add generated outputs to source folders.

## Git Hygiene
- Keep repository clean for release packaging.
- Ensure `.gitignore` excludes:
  - build/cache/intermediate files
  - binary outputs (`.hex`, `.bin`, `.elf`, `.a`, `.obj`, etc.)
  - VSIX output and temporary folders
- Do not commit nested `.git` directories or `.gitmodules` from imported trees.

## Documentation Rules
- Always keep top-level `README.md` accurate with current folder structure.
- When paths change, update all script examples and helper references.
- Clearly state non-official/community-maintained status where appropriate.

## Validation Checklist Before Finishing
1. `get_errors` returns no issues in changed files.
2. PowerShell scripts parse without syntax errors.
3. Helper script paths are valid after any folder move.
4. README paths reflect real locations.
