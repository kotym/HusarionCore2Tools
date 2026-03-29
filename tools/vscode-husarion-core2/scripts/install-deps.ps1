$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [switch]$InstallCppToolsExtension,
    [string]$OfflineBundleDir = ''
)

function Test-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Show-Status {
    param([string]$Message)
    Write-Host "==> $Message"
}

function Test-WingetPackageInstalled {
    param([Parameter(Mandatory = $true)][string]$Id)

    $output = & winget list --id $Id --exact 2>$null | Out-String
    return $output -match [Regex]::Escape($Id)
}

function Try-InstallWithWinget {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )

    if (Test-WingetPackageInstalled -Id $Id) {
        Show-Status "$DisplayName already installed via winget"
        return
    }

    Show-Status "Installing $DisplayName with winget"
    try {
        & winget install --id $Id --exact --silent --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) {
            Write-Host "winget install failed for $DisplayName (id: $Id)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "winget install failed for $DisplayName (id: $Id): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Try-InstallWithChoco {
    param(
        [Parameter(Mandatory = $true)][string]$Package,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )

    Show-Status "Installing $DisplayName with Chocolatey"
    try {
        & choco install $Package -y
        if ($LASTEXITCODE -ne 0) {
            Write-Host "choco install failed for $DisplayName (package: $Package)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "choco install failed for $DisplayName (package: $Package): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

$requiredCommands = @('cmake', 'ninja', 'arm-none-eabi-g++')
$missing = @()

Show-Status 'Checking required toolchain commands'
foreach ($cmd in $requiredCommands) {
    if (-not (Test-CommandExists $cmd)) {
        $missing += $cmd
    }
}

if ($missing.Count -eq 0) {
    Write-Host 'All required toolchain commands are already available.' -ForegroundColor Green
}
else {
    Write-Host ''
    Write-Host 'Missing commands:' -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
    Write-Host ''

    $usedInstaller = $false

    if ($OfflineBundleDir -and (Test-Path $OfflineBundleDir)) {
        $offlineScript = Join-Path $OfflineBundleDir 'install-toolchain.ps1'
        if (Test-Path $offlineScript) {
            Show-Status "Running offline toolchain installer script: $offlineScript"
            & powershell -ExecutionPolicy Bypass -File $offlineScript
            $usedInstaller = $true
        }
    }

    if (-not $usedInstaller -and (Test-CommandExists 'winget')) {
        Try-InstallWithWinget -Id 'Kitware.CMake' -DisplayName 'CMake'
        Try-InstallWithWinget -Id 'Ninja-build.Ninja' -DisplayName 'Ninja'
        Try-InstallWithWinget -Id 'Arm.GnuArmEmbeddedToolchain' -DisplayName 'GNU Arm Embedded Toolchain'
        $usedInstaller = $true
    }

    if (-not $usedInstaller -and (Test-CommandExists 'choco')) {
        Try-InstallWithChoco -Package 'cmake' -DisplayName 'CMake'
        Try-InstallWithChoco -Package 'ninja' -DisplayName 'Ninja'
        Try-InstallWithChoco -Package 'gcc-arm-embedded' -DisplayName 'GNU Arm Embedded Toolchain'
        $usedInstaller = $true
    }

    $stillMissing = @()
    foreach ($cmd in $requiredCommands) {
        if (-not (Test-CommandExists $cmd)) {
            $stillMissing += $cmd
        }
    }

    if ($stillMissing.Count -gt 0) {
        Write-Host ''
        Write-Host 'Some commands are still missing after automatic install attempts:' -ForegroundColor Yellow
        $stillMissing | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
        Write-Host ''
        Write-Host 'Manual fallback:' -ForegroundColor Yellow
        Write-Host '  1. Install CMake, Ninja, and GNU Arm Embedded Toolchain' -ForegroundColor Yellow
        Write-Host '  2. Ensure commands are available in PATH: cmake, ninja, arm-none-eabi-g++' -ForegroundColor Yellow
        Write-Host '  3. Restart VS Code / terminal and run this command again' -ForegroundColor Yellow
        exit 1
    }

    Write-Host 'Toolchain installation check passed.' -ForegroundColor Green
}

if ($InstallCppToolsExtension) {
    if (Test-CommandExists 'code') {
        Show-Status 'Installing VS Code C/C++ extension (ms-vscode.cpptools)'
        & code --install-extension ms-vscode.cpptools --force
    }
    else {
        Write-Host 'code CLI not found. Install C/C++ extension manually: ms-vscode.cpptools' -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Dependency setup completed.' -ForegroundColor Green
