cmake_minimum_required(VERSION 3.5)
if(POLICY CMP0091)
  cmake_policy(SET CMP0091 NEW)
endif()
get_filename_component(CURRENT_DIR ${CMAKE_CURRENT_LIST_FILE} PATH) # for cmake before 2.8.3

project(flasher_hard C CXX ASM)

if(MSVC)
  set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif()

if(CROSS)
    set(CMAKE_C_COMPILER "i686-w64-mingw32.static-gcc")
    set(CMAKE_CXX_COMPILER "i686-w64-mingw32.static-g++")
endif()

set(CMAKE_SHARED_LIBRARY_LINK_C_FLAGS "")
set(CMAKE_SHARED_LIBRARY_LINK_CXX_FLAGS "")

# set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "bin/")

include_directories(${CURRENT_DIR})

if(WIN32)
	set(PROJECT_PORT_DIR ${CURRENT_DIR}/port/windows)
	set(CMAKE_C_FLAGS "-DPLATFORM_WIN32 -D_CRT_SECURE_NO_WARNINGS -std=c99 -Wall")
	set(CMAKE_CXX_FLAGS "-DPLATFORM_WIN32 -D_CRT_SECURE_NO_WARNINGS -std=c++11 -Wall")

	include_directories(${CURRENT_DIR}/port/windows/)
	link_directories(${CURRENT_DIR}/port/windows/)
elseif(UNIX)
	set(PROJECT_PORT_DIR ${CURRENT_DIR}/port/linux)
    set(CMAKE_C_FLAGS "-DPLATFORM_LINUX -std=c99 -Wall")
    set(CMAKE_CXX_FLAGS "-DPLATFORM_LINUX -std=c++11 -Wall")

	include_directories(${CURRENT_DIR}/port/linux/ /usr/include/libusb-1.0/)
endif()
include_directories(${CURRENT_DIR}/include)

set(COMMON_SOURCES src/main.cpp src/devices.cpp src/ihex.cpp src/xcpmaster.cpp
	src/HardFlasher.cpp src/utils.cpp src/TRoboCOREHeader.cpp
	src/console.cpp
	${PROJECT_PORT_DIR}/xcptransport.cpp ${PROJECT_PORT_DIR}/timeutil.cpp)

if(EMBED_BOOTLOADERS)
	set(COMMON_SOURCES ${COMMON_SOURCES} gen/bootloaders.cpp)
	include_directories(${CURRENT_DIR}/gen)
	add_definitions(-DEMBED_BOOTLOADERS)
endif()

if(WIN32)
    set(TARGET_NAME core2-flasher)

  if(NOT VCPKG_ROOT AND DEFINED ENV{VCPKG_ROOT})
    set(VCPKG_ROOT "$ENV{VCPKG_ROOT}")
  endif()

  if(NOT VCPKG_TARGET_TRIPLET AND DEFINED ENV{VCPKG_TARGET_TRIPLET})
    set(VCPKG_TARGET_TRIPLET "$ENV{VCPKG_TARGET_TRIPLET}")
  endif()

  if(NOT VCPKG_TARGET_TRIPLET)
    set(VCPKG_TARGET_TRIPLET "x64-windows")
  endif()

  if(VCPKG_ROOT)
    set(VCPKG_WINDOWS_LIB_DIR "${VCPKG_ROOT}/installed/${VCPKG_TARGET_TRIPLET}/lib")
    unset(FTDI_LIB CACHE)
    unset(LIBUSB_LIB CACHE)
  endif()

  if(VCPKG_WINDOWS_LIB_DIR)
    if(EXISTS "${VCPKG_WINDOWS_LIB_DIR}/ftdi1.lib")
      set(FTDI_LIB "${VCPKG_WINDOWS_LIB_DIR}/ftdi1.lib")
    endif()
    if(EXISTS "${VCPKG_WINDOWS_LIB_DIR}/libusb-1.0.lib")
      set(LIBUSB_LIB "${VCPKG_WINDOWS_LIB_DIR}/libusb-1.0.lib")
    endif()
  endif()

  # Try to locate optional native libraries. If not found, build with a stub FTDI
  if(NOT FTDI_LIB)
    find_library(FTDI_LIB NAMES ftdi1 ftd2xx PATHS ${PROJECT_PORT_DIR} ${VCPKG_WINDOWS_LIB_DIR} PATH_SUFFIXES lib lib64)
  endif()
  if(NOT LIBUSB_LIB)
    find_library(LIBUSB_LIB NAMES "usb-1.0" usb PATHS /usr/lib /usr/lib64 ${PROJECT_PORT_DIR} ${VCPKG_WINDOWS_LIB_DIR} PATH_SUFFIXES lib lib64)
  endif()

  # If the found libraries are MinGW-style .a archives in the port directory, ignore them for MSVC
  if(FTDI_LIB AND FTDI_LIB MATCHES "\\.a$")
    set(FTDI_LIB "")
  endif()
  if(LIBUSB_LIB AND LIBUSB_LIB MATCHES "\\.a$")
    set(LIBUSB_LIB "")
  endif()

  if(FTDI_LIB AND LIBUSB_LIB)
    add_executable(${TARGET_NAME} ${COMMON_SOURCES} src/myFTDI.cpp)
    target_link_libraries(${TARGET_NAME} ${FTDI_LIB} ${LIBUSB_LIB} ws2_32)
    message(STATUS "Found FTDI and libusb: linking native drivers")
  else()
    add_executable(${TARGET_NAME} ${COMMON_SOURCES} src/myFTDI_stub.cpp)
    add_definitions(-DNO_FTDI)
    message(WARNING "FTDI or libusb not found: building with stub FTDI implementation (NO_FTDI)")
  endif()

  add_definitions(-DWIN32)
elseif(UNIX)
	set(TARGET_NAME core2-flasher)
	add_definitions(-DUNIX)

	include_directories(third-party/libusb/libusb)

    if(MAC)
      set(OS_SOURCES
        third-party/libusb/libusb/os/darwin_usb.c)
    else()
      set(OS_SOURCES
        third-party/libusb/libusb/os/linux_netlink.c
        third-party/libusb/libusb/os/linux_usbfs.c)
    endif()

	add_executable(${TARGET_NAME}
		${COMMON_SOURCES}
		port/linux/ftdi.c port/linux/ftdi_stream.c

        ${OS_SOURCES}
        third-party/libusb/libusb/os/poll_posix.c
        third-party/libusb/libusb/os/threads_posix.c
        third-party/libusb/libusb/core.c
        third-party/libusb/libusb/descriptor.c
        third-party/libusb/libusb/hotplug.c
        third-party/libusb/libusb/io.c
        third-party/libusb/libusb/strerror.c
        third-party/libusb/libusb/sync.c)

    if(MAC)
      set (CMAKE_EXE_LINKER_FLAGS "-framework CoreFoundation -framework IOKit")
    else()
      target_link_libraries(${TARGET_NAME}
        pthread rt)
    endif()
endif()

option(X86 "32 bit executable" OFF)

if(X86)
  if(MULTILIB_HACK STREQUAL "")
	set_target_properties(${TARGET_NAME} PROPERTIES
	  COMPILE_FLAGS "-m32" LINK_FLAGS "-m32")
  else()
	# gcc-multilib conficts with cross-compilers on old Debians
	set_target_properties(${TARGET_NAME} PROPERTIES
	  COMPILE_FLAGS "-m32"
	  LINK_FLAGS "-m32 -B /usr/lib/gcc/${MULTILIB_HACK} -L /usr/lib/gcc/${MULTILIB_HACK}")
  endif()
endif()

if(DEBUG)
  set_target_properties(${TARGET_NAME} PROPERTIES COMPILE_FLAGS "-g" LINK_FLAGS "-g")
endif()
