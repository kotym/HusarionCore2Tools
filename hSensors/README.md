# hSensors

Note: in this bundle repository, hSensors is redistributed as part of a non-official, community-maintained package layout.

If you are using the VS Code extension bundle as an end user, start from the top-level `README.md` in repository root.
This file focuses on hSensors itself.

hSensors provides support for various sensors (mostly LEGO/Mindsensors-compatible) used with hFramework projects.

## Documentation

- API guide: `docs/comprehensive-api-guide.md`
- Sensor docs index: `docs/index.md`

## Building hSensors

This section describes how to build hSensors from source.

1. Ensure dependencies are available:

	- `cmake`
	- `ninja`
	- GNU Arm Embedded Toolchain (`arm-none-eabi-g++` in `PATH`)
	- `hFramework` available as sibling folder (`../hFramework`) or via `HFRAMEWORK_PATH`

2. Configure and build.

	Typical bundle layout (with sibling `hFramework`):

	```bash
	mkdir build
	cd build
	cmake -DBOARD_TYPE=core2 -GNinja ..
	ninja
	```

	If `hFramework` is in a custom location, add explicit path:

	```bash
	cmake -DBOARD_TYPE=core2 -DHFRAMEWORK_PATH=/path/to/hFramework -GNinja ..
	ninja
	```

	Substitute `core2` with `core2mini` if building for CORE2mini.

## Bundle Helper Scripts

For rollout to multiple machines in this bundle repository, use helper scripts from repository root.

1. Install package (extension + toolchain):

	```powershell
	powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1
	```

2. Install/update VS Code extension only (skip toolchain):

	```powershell
	powershell -ExecutionPolicy Bypass -File .\tools\install\install-package.ps1 -SkipToolchainInstall
	```

3. Refresh/check toolchain only:

	```powershell
	powershell -ExecutionPolicy Bypass -File .\tools\vscode-husarion-core2\scripts\install-or-refresh-toolchain.ps1
	```
