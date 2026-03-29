cmake_minimum_required(VERSION 3.10)
project(ARoboCoreProject NONE)

include(${HFRAMEWORK_PATH}/hFramework.cmake)
#enable_module(hCloudClient)

add_hexecutable(myproject main.cpp)
