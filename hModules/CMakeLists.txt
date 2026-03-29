cmake_minimum_required(VERSION 3.10)
project(hModules NONE)

if(NOT HFRAMEWORK_PATH)
  get_filename_component(CURRENT_DIR ${CMAKE_CURRENT_LIST_FILE} PATH)
  if(EXISTS "${CURRENT_DIR}/../hFramework/hFramework.cmake")
    set(HFRAMEWORK_PATH "${CURRENT_DIR}/../hFramework")
  elseif(EXISTS "${CURRENT_DIR}/../hFramework-master/hFramework.cmake")
    set(HFRAMEWORK_PATH "${CURRENT_DIR}/../hFramework-master")
  endif()
endif()

include(${HFRAMEWORK_PATH}/hFramework.cmake)

include_directories("include")

add_library(hModules
  src/DistanceSensor.cpp
  src/MPU9250/mpudmp.cpp
  src/MPU9250/mpudmp_6axis.cpp
  # src/MPU9250/mpudmp_9axis.cpp
  src/MPU9250.cpp)
