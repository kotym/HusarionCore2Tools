Third-Party Notices

This repository is a community-maintained bundle that includes third-party and upstream components.
This file is an engineering notice and not legal advice.

Included upstream components

- **hFramework** ([github.com/husarion/hFramework](https://github.com/husarion/hFramework)): see hFramework/LICENSE.md (MIT)
- **hSensors** ([github.com/husarion/hSensors](https://github.com/husarion/hSensors)): see hSensors/LICENSE.md (mixed/restricted status in file headers)
- **hModules** ([github.com/husarion/modules](https://github.com/husarion/modules)): see hModules/LICENSE.md (mixed status in file headers)

Notable third-party content under hFramework/third-party

- CMSIS / DSP (ARM): BSD-like license text in source headers and hFramework/third-party/cmsis/DSP_Lib/license.txt
- STM32 Standard Peripheral and related files (STMicroelectronics): file-level copyright/license notices in headers/sources
- FreeRTOS: file-level license headers (GPLv2 with exception notice in included files)
- FatFS/usblib/eeprom and others: see file-level notices in corresponding directories

Distribution guidance

- Preserve all original license headers and notice files when redistributing sources/binaries.
- Review file-level headers for exact license terms where a directory contains mixed notices.
- If legal certainty is required for a release, perform a formal legal review before external distribution.
