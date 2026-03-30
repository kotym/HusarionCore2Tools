param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\hFramework')).Path,
    [string]$BoardType = 'core2',
    [switch]$SkipModules
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)

    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host "==> $Description"
    & $Action
}

function Build-CMakeTarget {
    param(
        [Parameter(Mandatory = $true)][string]$SourceDir,
        [Parameter(Mandatory = $true)][string]$BuildDir,
        [Parameter(Mandatory = $true)][string]$BoardType,
        [string]$HframeworkPath
    )

    $cmakeArgs = @(
        '-S', $SourceDir,
        '-B', $BuildDir,
        '-GNinja',
        "-DBOARD_TYPE=$BoardType",
        '-DCMAKE_POLICY_VERSION_MINIMUM=3.5'
    )

    if ($HframeworkPath) {
        $cmakeArgs += "-DHFRAMEWORK_PATH=$HframeworkPath"
    }

    & cmake @cmakeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "CMake configure failed for $SourceDir"
    }

    & ninja -C $BuildDir
    if ($LASTEXITCODE -ne 0) {
        throw "Ninja build failed for $BuildDir"
    }
}

$Root = (Resolve-Path $Root).Path
$frameworkCmake = Join-Path $Root 'hFramework.cmake'

if (-not (Test-Path $frameworkCmake)) {
    throw "Invalid hFramework root: $Root"
}

$requiredCommands = @('cmake', 'ninja', 'arm-none-eabi-g++')
$missing = @()
foreach ($cmd in $requiredCommands) {
    if (-not (Test-CommandExists $cmd)) {
        $missing += $cmd
    }
}

if ($missing.Count -gt 0) {
    Write-Host ''
    Write-Host 'Missing required tools:' -ForegroundColor Red
    $missing | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    Write-Host ''
    Write-Host 'Install these tools and run this script again.' -ForegroundColor Yellow
    Write-Host 'Windows: install CMake, Ninja, and GNU Arm Embedded Toolchain (ensure PATH includes cmake, ninja, arm-none-eabi-g++).' -ForegroundColor Yellow
    exit 1
}

$buildRoot = Join-Path $Root 'build'
$frameworkBuildDir = Join-Path $buildRoot "stm32_${BoardType}_1.0.0"

Invoke-Step -Description "Building hFramework ($BoardType)" -Action {
    Build-CMakeTarget -SourceDir $Root -BuildDir $frameworkBuildDir -BoardType $BoardType
}

if (-not $SkipModules) {
    $parent = Split-Path -Parent $Root

    $moduleMap = @(
        @{ Name = 'hSensors'; Paths = @((Join-Path $parent 'hSensors'), (Join-Path $parent 'hSensors-master')) },
        @{ Name = 'hModules'; Paths = @((Join-Path $parent 'hModules'), (Join-Path $parent 'modules-master'), (Join-Path $parent 'hModules-master')) }
    )

    foreach ($module in $moduleMap) {
        $modulePath = $null
        foreach ($candidate in $module.Paths) {
            if (Test-Path (Join-Path $candidate 'CMakeLists.txt')) {
                $modulePath = $candidate
                break
            }
        }

        if ($modulePath) {
            $moduleBuildDir = Join-Path $modulePath "build\stm32_${BoardType}_1.0.0"
            Invoke-Step -Description "Building $($module.Name)" -Action {
                Build-CMakeTarget -SourceDir $modulePath -BuildDir $moduleBuildDir -BoardType $BoardType -HframeworkPath $Root
            }
        }
        else {
            Write-Host "==> Skipping $($module.Name) (module folder not found)" -ForegroundColor Yellow
        }
    }
}

$flasher = Join-Path $Root 'tools\win\core2-flasher.exe'
if (-not (Test-Path $flasher)) {
    Write-Host ''
    Write-Host 'Warning: core2-flasher.exe not found.' -ForegroundColor Yellow
    Write-Host "Expected path: $flasher" -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Bootstrap complete.' -ForegroundColor Green
Write-Host "hFramework build: $frameworkBuildDir"
Write-Host 'Next:'
Write-Host '  1. Install package with tools/install/install-package.ps1 -SkipToolchainInstall'
Write-Host '  2. Open project and run Husarion: Build Project (No Flash)'
