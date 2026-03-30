# hFramework

Note: in this bundle repository, hFramework is redistributed as part of a non-official, community-maintained package layout.

hFramework is a library for creating software for mechatronic devices (e.g. robots). It has the following ports:

- STM32 port for hardware created by Husarion - [CORE2 boards](https://husarion.com)
- Linux port for Raspberry Pi and Tinkerboard (experimental)
- ESP32 port (experimental)

## Using hFramework

hFramework documentation is available at http://docs.husarion.com. The easiest way to experience hFramework is to use [Husarion WebIDE](https://cloud.husarion.com) or install Husarion plugin to Visual Studio Code.

## Building hFramework

This section describes how to build hFramework yourself,

1. First install the dependencies. For example, on Ubuntu:

  ```
  sudo apt-get install cmake ninja-build gcc-arm-none-eabi
  ```

  On Windows, install `cmake`, `ninja`, and GNU Arm Embedded Toolchain so commands `cmake`, `ninja`, and `arm-none-eabi-g++` are available in `PATH`.

  A complete tutorial how to ude hFramework library can be found here: https://husarion.com/tutorials/other-tutorials/hframework-library-development/

2. Configure and build the project.

    ```
    mkdir build
    cd build && cmake -DBOARD_TYPE=core2 -GNinja ..
    ninja
    ```
    Substitute `core2` with `core2mini` if building for CORE2mini.

  ## In-house installation helpers

  For rollout to multiple machines in this bundle repo, use helper scripts from top-level `tools/install`.

  1. Full setup (build framework + modules and install VS Code extension):

    ```powershell
    powershell -ExecutionPolicy Bypass -File ..\tools\install\install-inhouse.ps1
    ```

  2. Build-only bootstrap (no extension install):

    ```powershell
    powershell -ExecutionPolicy Bypass -File ..\tools\install\bootstrap-hframework.ps1 -BoardType core2
    ```

  3. Install/update VS Code extension only:

    ```powershell
    powershell -ExecutionPolicy Bypass -File ..\tools\install\install-package.ps1 -SkipToolchainInstall
    ```
