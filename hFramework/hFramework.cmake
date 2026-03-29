get_filename_component(HFRAMEWORK_DIR ${CMAKE_CURRENT_LIST_FILE} PATH) # for cmake before 2.8.3

if(WIN32)
  set(TOOLS_ARCH_NAME win)
elseif(APPLE)
  set(TOOLS_ARCH_NAME macos)
else()
  set(TOOLS_ARCH_NAME amd64-linux)
endif()

set(HFRAMEWORK_BASE_DIR "${HFRAMEWORK_DIR}")
if ("${BOARD_TYPE}" STREQUAL robocore)
  set(HFRAMEWORK_DIR "${HFRAMEWORK_DIR}/robocore")
endif()

set(HFRAMEWORK_DIR_Q "\"${HFRAMEWORK_DIR}\"")

include("${HFRAMEWORK_BASE_DIR}/hFrameworkPort.cmake")

set(compiler_flags "-g")

macro(add_component_lib name)
  enable_module(${name})
endmacro()

macro(enable_module name)
  if (NOT ((${name} STREQUAL hModules) AND ("${BOARD_TYPE}" STREQUAL robocore)))
  if (USES_SDK)
    include_directories("${HFRAMEWORK_DIR}/include/${name}")
    set(module_libraries "${module_libraries} -l${name}")
  else()
    set(module_path "")

    if (${name} STREQUAL hSensors)
      if (DEFINED HSENSORS_PATH AND EXISTS "${HSENSORS_PATH}")
        set(module_path "${HSENSORS_PATH}")
      elseif (EXISTS "${HFRAMEWORK_PATH}/../hSensors")
        set(module_path "${HFRAMEWORK_PATH}/../hSensors")
      elseif (EXISTS "${HFRAMEWORK_PATH}/../hSensors-master")
        set(module_path "${HFRAMEWORK_PATH}/../hSensors-master")
      endif()
    elseif (${name} STREQUAL hModules)
      if (DEFINED HMODULES_PATH AND EXISTS "${HMODULES_PATH}")
        set(module_path "${HMODULES_PATH}")
      elseif (EXISTS "${HFRAMEWORK_PATH}/../hModules")
        set(module_path "${HFRAMEWORK_PATH}/../hModules")
      elseif (EXISTS "${HFRAMEWORK_PATH}/../modules-master")
        set(module_path "${HFRAMEWORK_PATH}/../modules-master")
      elseif (EXISTS "${HFRAMEWORK_PATH}/../hModules-master")
        set(module_path "${HFRAMEWORK_PATH}/../hModules-master")
      endif()
    endif()

    if ("${module_path}" STREQUAL "")
      if (EXISTS "${HFRAMEWORK_PATH}/../hcommon/hdev-findmodule")
        execute_process(
          COMMAND "${HFRAMEWORK_PATH}/../hcommon/hdev-findmodule" ${name}
          OUTPUT_VARIABLE module_path
          RESULT_VARIABLE err)
        if (${err})
          set(module_path "")
        else()
          string(STRIP "${module_path}" module_path)
        endif()
      else()
        message(WARNING "hdev-findmodule not found at ${HFRAMEWORK_PATH}/../hcommon/hdev-findmodule")
      endif()
    endif()

    if ("${module_path}" STREQUAL "")
      message(WARNING "module '${name}' path is empty, skipping")
    else()
      message("-- Using module from workspace: ${module_path}")
      include_directories("${module_path}/include/")
      set(ADDITIONAL_LINK_DIRS "${ADDITIONAL_LINK_DIRS} -L${module_path}/build/${PORT}_${BOARD_TYPE}_${BOARD_VERSION_DOT}")
      set(module_libraries "${module_libraries} -l${name}")
    endif()
  endif()
  endif()
endmacro()

macro(add_hexecutable name)
  if (NOT ${PORT} STREQUAL esp32)
    list(APPEND ADDITIONAL_LIBS "${module_libraries} -lhFramework")
  endif()
  update_flags()
  add_executable("${name}.elf" ${ARGN})

  add_hexecutable_port(${name})
  set_target_properties("${name}.elf" PROPERTIES
    LINKER_LANGUAGE CXX
    SUFFIX "")

  if(NOT DEFINED main_executable)
    set(main_executable ${name})
    add_custom_target("flash"
      DEPENDS "flash_${name}")

    printvars_target_done()
  endif()
endmacro()

### Support for printvars

get_property(include_spaces DIRECTORY PROPERTY INCLUDE_DIRECTORIES)
set(vars_info "")

foreach(v IN LISTS include_spaces)
  set(vars_info "${vars_info}::include=${v}")
endforeach(v)

function(printvars_target_done)
  add_custom_target(
    printvars
    COMMAND
    cmake -E echo 'VARS${vars_info}::sdk=${HFRAMEWORK_PATH}::main_executable=${main_executable}::none=')
endfunction()

### End printvars

include_directories("${HFRAMEWORK_DIR}/include")

if (USES_SDK OR "${BOARD_TYPE}" STREQUAL robocore)
  set(ADDITIONAL_LINK_DIRS "-L${HFRAMEWORK_DIR_Q}/libs/${PORT}_${BOARD_TYPE}_${BOARD_VERSION}")
else()
  string(REPLACE _ . BOARD_VERSION_DOT ${BOARD_VERSION})
  set(ADDITIONAL_LINK_DIRS "-L${HFRAMEWORK_DIR_Q}/build/${PORT}_${BOARD_TYPE}_${BOARD_VERSION_DOT}")
endif()

update_flags()

set(CMAKE_SHARED_LIBRARY_LINK_C_FLAGS "")
set(CMAKE_SHARED_LIBRARY_LINK_CXX_FLAGS "")
