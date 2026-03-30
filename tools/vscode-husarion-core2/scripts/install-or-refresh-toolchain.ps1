param(
    [switch]$InstallCppToolsExtension,
    [string]$OfflineBundleDir = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($machinePath -or $userPath) {
        $env:Path = "$machinePath;$userPath"
    }
}

function Test-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)

    $wingetLinksDir = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links' } else { '' }

    if ($null -ne (Get-Command $Name -ErrorAction SilentlyContinue)) {
        return $true
    }

    try {
        $whereOutput = & where.exe $Name 2>$null
        if ($LASTEXITCODE -eq 0 -and $whereOutput) {
            return $true
        }
    }
    catch {
    }

    $wingetCmake = if ($wingetLinksDir) { Join-Path $wingetLinksDir 'cmake.exe' } else { '' }
    $wingetNinja = if ($wingetLinksDir) { Join-Path $wingetLinksDir 'ninja.exe' } else { '' }
    $wingetArmGpp = if ($wingetLinksDir) { Join-Path $wingetLinksDir 'arm-none-eabi-g++.exe' } else { '' }

    $commonPaths = @(
        $wingetCmake,
        'C:\Program Files\CMake\bin\cmake.exe',
        'C:\ProgramData\chocolatey\bin\cmake.exe',
        $wingetNinja,
        'C:\ProgramData\chocolatey\bin\ninja.exe',
        'C:\Program Files\ninja\ninja.exe',
        $wingetArmGpp,
        'C:\Program Files (x86)\GNU Arm Embedded Toolchain\*\bin\arm-none-eabi-g++.exe',
        'C:\Program Files\GNU Arm Embedded Toolchain\*\bin\arm-none-eabi-g++.exe',
        'C:\Program Files (x86)\Arm GNU Toolchain arm-none-eabi\*\bin\arm-none-eabi-g++.exe',
        'C:\Program Files\Arm GNU Toolchain arm-none-eabi\*\bin\arm-none-eabi-g++.exe'
    )

    switch ($Name) {
        'cmake' {
            return (Test-Path $commonPaths[0]) -or (Test-Path $commonPaths[1]) -or (Test-Path $commonPaths[2])
        }
        'ninja' {
            return (Test-Path $commonPaths[3]) -or (Test-Path $commonPaths[4]) -or (Test-Path $commonPaths[5])
        }
        'arm-none-eabi-g++' {
            foreach ($p in $commonPaths[6..10]) {
                if (Get-ChildItem -Path $p -ErrorAction SilentlyContinue | Select-Object -First 1) {
                    return $true
                }
            }
            return $false
        }
        default {
            return $false
        }
    }
}

function Show-Status {
    param([string]$Message)
    Write-Host "==> $Message"
}

function Test-WingetPackageInstalled {
    param([Parameter(Mandatory = $true)][string]$Id)

    Write-Host "  (Checking with winget...)" -ForegroundColor Gray
    try {
        $output = & winget list --id $Id --exact --source winget --disable-interactivity 2>&1 | Out-String
        return $output -match [Regex]::Escape($Id)
    }
    catch {
        return $false
    }
}


function Try-InstallWithWinget {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )

    Write-Host "  Checking if $DisplayName is already installed..." -ForegroundColor Cyan
    if (Test-WingetPackageInstalled -Id $Id) {
        Write-Host "  [OK] $DisplayName already installed" -ForegroundColor Green
        return
    }

    Write-Host "  Installing $DisplayName with winget (this may take a minute on first run)..." -ForegroundColor Cyan
    Write-Host "  (winget output follows)" -ForegroundColor Gray
    try {
        $outputLines = @()
        $spinnerFrames = @('|', '/', '-', '\\')
        $spinnerIndex = 0
        $spinnerActive = $false
        & winget install --id $Id --exact --source winget --disable-interactivity --accept-package-agreements --accept-source-agreements 2>&1 |
            ForEach-Object {
                $line = "$($_)"
                $outputLines += $line
                $trimmed = $line.Trim()

                # Winget prints spinner/progress redraw frames as standalone characters.
                # Keep those updates on one line to avoid flooding the terminal output.
                if ($trimmed -match '^[\|/\\-]+$') {
                    $frame = $spinnerFrames[$spinnerIndex % $spinnerFrames.Count]
                    Write-Host "`r    [winget] $frame Installing $DisplayName..." -NoNewline -ForegroundColor DarkGray
                    $spinnerIndex++
                    $spinnerActive = $true
                }
                elseif ($trimmed -match '([0-9]+(?:\.[0-9]+)?\s*(?:KB|MB|GB)\s*/\s*[0-9]+(?:\.[0-9]+)?\s*(?:KB|MB|GB)|[0-9]{1,3}%)') {
                    $frame = $spinnerFrames[$spinnerIndex % $spinnerFrames.Count]
                    $progressText = $Matches[1]
                    Write-Host "`r    [winget] $frame Installing $DisplayName... $progressText" -NoNewline -ForegroundColor DarkGray
                    $spinnerIndex++
                    $spinnerActive = $true
                }
                else {
                    if ($spinnerActive) {
                        Write-Host ""
                        $spinnerActive = $false
                    }

                    if ($trimmed) {
                        Write-Host "    [winget] $trimmed" -ForegroundColor DarkGray
                    }
                }
            }

        if ($spinnerActive) {
            Write-Host ""
        }

        if ($LASTEXITCODE -eq 0 -or ($outputLines -join "`n") -match 'Successfully installed') {
            Write-Host "  [OK] $DisplayName installed successfully" -ForegroundColor Green
        }
        else {
            Write-Host "  [WARN] winget install failed for $DisplayName (id: $Id)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "  [WARN] winget install failed for $DisplayName (id: $Id): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Try-InstallWithChoco {
    param(
        [Parameter(Mandatory = $true)][string]$Package,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )

    Write-Host "  Installing $DisplayName with Chocolatey..." -ForegroundColor Cyan
    try {
        $output = & choco install $Package -y 2>&1
        if ($LASTEXITCODE -eq 0 -or $output -match 'successfully installed') {
            Write-Host "  [OK] $DisplayName installed successfully" -ForegroundColor Green
        }
        else {
            Write-Host "  [WARN] choco install failed for $DisplayName (package: $Package)" -ForegroundColor Yellow
            Write-Host "    Run output: $output" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "  [WARN] choco install failed for $DisplayName (package: $Package): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Install-MissingWithChoco {
    param([Parameter(Mandatory = $true)][string[]]$Commands)

    if (-not (Test-CommandExists 'choco')) {
        return
    }

    Write-Host 'Attempting installation via Chocolatey for still-missing tools...' -ForegroundColor Cyan
    foreach ($cmd in $Commands) {
        switch ($cmd) {
            'cmake' { Try-InstallWithChoco -Package 'cmake' -DisplayName 'CMake' }
            'ninja' { Try-InstallWithChoco -Package 'ninja' -DisplayName 'Ninja' }
            'arm-none-eabi-g++' { Try-InstallWithChoco -Package 'gcc-arm-embedded' -DisplayName 'GNU Arm Embedded Toolchain' }
        }
    }
}

$requiredCommands = @('cmake', 'ninja', 'arm-none-eabi-g++')
$missing = @()

Refresh-ProcessPath

Show-Status 'Checking required toolchain commands'
foreach ($cmd in $requiredCommands) {
    Write-Host "  Checking for: $cmd" -ForegroundColor Cyan
    if (Test-CommandExists $cmd) {
        Write-Host "    [OK] Found" -ForegroundColor Green
    }
    else {
        Write-Host "    [WARN] Missing" -ForegroundColor Yellow
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
        Write-Host 'Attempting installation via winget...' -ForegroundColor Cyan
        Try-InstallWithWinget -Id 'Kitware.CMake' -DisplayName 'CMake'
        Try-InstallWithWinget -Id 'Ninja-build.Ninja' -DisplayName 'Ninja'
        Try-InstallWithWinget -Id 'Arm.GnuArmEmbeddedToolchain' -DisplayName 'GNU Arm Embedded Toolchain'
        $usedInstaller = $true
    }

    if (-not $usedInstaller -and (Test-CommandExists 'choco')) {
        Write-Host 'Attempting installation via Chocolatey...' -ForegroundColor Cyan
        Try-InstallWithChoco -Package 'cmake' -DisplayName 'CMake'
        Try-InstallWithChoco -Package 'ninja' -DisplayName 'Ninja'
        Try-InstallWithChoco -Package 'gcc-arm-embedded' -DisplayName 'GNU Arm Embedded Toolchain'
        $usedInstaller = $true
    }

    Refresh-ProcessPath

    Write-Host ''
    Show-Status 'Verifying installation...'
    $stillMissing = @()
    foreach ($cmd in $requiredCommands) {
        Write-Host "  Checking for: $cmd" -ForegroundColor Cyan
        if (Test-CommandExists $cmd) {
            Write-Host "    [OK] Found" -ForegroundColor Green
        }
        else {
            Write-Host "    [WARN] Still missing" -ForegroundColor Yellow
            $stillMissing += $cmd
        }
    }

    if ($stillMissing.Count -gt 0) {
        Install-MissingWithChoco -Commands $stillMissing

        Refresh-ProcessPath

        Write-Host ''
        Show-Status 'Verifying installation after Chocolatey fallback...'
        $recheckMissing = @()
        foreach ($cmd in $requiredCommands) {
            Write-Host "  Checking for: $cmd" -ForegroundColor Cyan
            if (Test-CommandExists $cmd) {
                Write-Host "    [OK] Found" -ForegroundColor Green
            }
            else {
                Write-Host "    [WARN] Still missing" -ForegroundColor Yellow
                $recheckMissing += $cmd
            }
        }
        $stillMissing = $recheckMissing
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
