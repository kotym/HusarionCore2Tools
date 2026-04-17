param(
    [switch]$SkipExtensionInstall,
    [switch]$SkipToolchainInstall,
    [switch]$KeepOtherExtensionVersions,
    [switch]$SkipCppToolsExtension,
    [string]$OfflineBundleDir = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$extRoot = Join-Path $repoRoot 'tools\vscode-husarion-core2'
$packageJsonPath = Join-Path $extRoot 'package.json'
$depsScript = Join-Path $extRoot 'scripts\install-or-refresh-toolchain.ps1'

function Get-UserProfilePath {
    $profilePath = [Environment]::GetFolderPath('UserProfile')
    if (-not $profilePath) {
        $profilePath = $env:USERPROFILE
    }
    if (-not $profilePath) {
        throw 'Could not resolve user profile path.'
    }
    return $profilePath
}

function Set-DefaultHusarionSettings {
    $vscodeUserDir = Join-Path $env:APPDATA 'Code\User'
    $settingsPath = Join-Path $vscodeUserDir 'settings.json'

    New-Item -ItemType Directory -Path $vscodeUserDir -Force | Out-Null

    $hfPath = Join-Path $repoRoot 'hFramework'
    $hsPath = Join-Path $repoRoot 'hSensors'
    $hmPath = Join-Path $repoRoot 'hModules'

    if (Test-Path $hfPath) {
        [Environment]::SetEnvironmentVariable('HFRAMEWORK_PATH', $hfPath, 'User')
        Write-Host '==> Set user environment variable HFRAMEWORK_PATH'
    }

    $settings = @{}
    if (Test-Path $settingsPath) {
        $raw = Get-Content $settingsPath -Raw
        if ($raw -and $raw.Trim()) {
            try {
                $parsed = $raw | ConvertFrom-Json
                foreach ($p in $parsed.PSObject.Properties) {
                    $settings[$p.Name] = $p.Value
                }
            }
            catch {
                Write-Host "[WARN] Could not parse VS Code settings.json, skipping settings update (HFRAMEWORK_PATH env var was set)." -ForegroundColor Yellow
                return
            }
        }
    }

    if (Test-Path $hfPath) {
        $settings['husarionCore2.hframeworkPath'] = $hfPath
    }
    if (Test-Path $hsPath) {
        $settings['husarionCore2.hSensorsPath'] = $hsPath
    }
    if (Test-Path $hmPath) {
        $settings['husarionCore2.hModulesPath'] = $hmPath
    }

    $settingsJson = $settings | ConvertTo-Json -Depth 10
    Set-Content -Path $settingsPath -Value $settingsJson -Encoding UTF8
    Write-Host "==> Updated VS Code defaults in $settingsPath"
}

function Get-CodeCliPath {
    $candidates = @(
        'code',
        (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code Insiders\bin\code-insiders')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -eq 'code') {
            if (Get-Command code -ErrorAction SilentlyContinue) {
                return 'code'
            }
        }
        elseif (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

function Install-LocalExtension {
    param([switch]$KeepOtherVersions)

    if (-not (Test-Path $packageJsonPath)) {
        throw "package.json not found: $packageJsonPath"
    }

    $pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $folderName = "$($pkg.publisher).$($pkg.name)-$($pkg.version)"
    $extensionId = "$($pkg.publisher).$($pkg.name)"
    $extensionsRoot = Join-Path (Join-Path (Get-UserProfilePath) '.vscode') 'extensions'
    $targetFolder = Join-Path $extensionsRoot $folderName
    $sourceFiles = @('package.json', 'extension.js', 'README.md', 'scripts')
    $vsixName = "$($pkg.publisher).$($pkg.name)-$($pkg.version).vsix"
    $vsixPath = Join-Path $extRoot "dist\$vsixName"

    Write-Host '==> Installing extension'

    # First, prefer VSIX install via VS Code extension manager.
    $codeCli = Get-CodeCliPath
    if ($codeCli -and (Test-Path $vsixPath)) {
        Write-Host "  Installing VSIX via VS Code extension manager: $vsixPath"
        $vsixExitCode = 1
        try {
            & $codeCli --install-extension $vsixPath --force
            if (Test-Path variable:LASTEXITCODE) {
                $vsixExitCode = $LASTEXITCODE
            }
        }
        catch {
            Write-Host "  [WARN] VSIX installation command failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }

        if ($vsixExitCode -eq 0) {
            try {
                $installed = (& $codeCli --list-extensions 2>$null) | Where-Object { $_ -eq $extensionId }
                if ($installed) {
                    Write-Host ''
                    Write-Host 'Extension installation complete (VSIX).' -ForegroundColor Green
                    Write-Host 'Toolchain installation...'
                    return
                }
                Write-Host '  [WARN] VSIX command succeeded but extension was not listed yet. Falling back to folder install.' -ForegroundColor Yellow
            }
            catch {
                Write-Host '  [WARN] Could not verify VSIX install via code --list-extensions. Falling back to folder install.' -ForegroundColor Yellow
            }
        }

        Write-Host '  [WARN] VSIX installation failed. Falling back to folder install.' -ForegroundColor Yellow
    }

    # Fallback: folder install directly from extension source files in package.
    Write-Host "  Using source extension files from: $extRoot"
    foreach ($name in $sourceFiles) {
        $pathToCheck = Join-Path $extRoot $name
        if (-not (Test-Path $pathToCheck)) {
            throw "Required extension file/folder missing: $pathToCheck"
        }
    }

    New-Item -ItemType Directory -Path $extensionsRoot -Force | Out-Null

    if (-not $KeepOtherVersions) {
        $pattern = "$($pkg.publisher).$($pkg.name)-*"
        Get-ChildItem -Path $extensionsRoot -Directory -Filter $pattern -ErrorAction SilentlyContinue |
            ForEach-Object {
                Write-Host "==> Removing old extension: $($_.FullName)"
                Remove-Item $_.FullName -Recurse -Force
            }
    }

    if (Test-Path $targetFolder) {
        Remove-Item $targetFolder -Recurse -Force
    }

    Write-Host "==> Installing to $targetFolder"
    New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null
    foreach ($name in $sourceFiles) {
        Copy-Item -Path (Join-Path $extRoot $name) -Destination (Join-Path $targetFolder $name) -Recurse -Force
    }

    Write-Host ''
    Write-Host 'Extension installation complete (folder fallback).' -ForegroundColor Green
}


Write-Host "==> Using repo root: $repoRoot"

if (-not $SkipExtensionInstall) {
    Install-LocalExtension -KeepOtherVersions:$KeepOtherExtensionVersions
    Set-DefaultHusarionSettings
}

if (-not $SkipToolchainInstall) {
    if (-not (Test-Path $depsScript)) {
        throw "Dependency installer script not found: $depsScript"
    }

    Write-Host '==> Installing/checking required toolchain'
    $depsArgs = @('-ExecutionPolicy', 'Bypass', '-File', $depsScript)
    if (-not $SkipCppToolsExtension) {
        $depsArgs += '-InstallCppToolsExtension'
    }
    if ($OfflineBundleDir) {
        $depsArgs += @('-OfflineBundleDir', $OfflineBundleDir)
    }

    & powershell @depsArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Toolchain/dependency installation did not complete successfully.' -ForegroundColor Yellow
        Write-Host 'You can retry later using: Husarion: Install Required Toolchain and Components' -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Package installation completed successfully.' -ForegroundColor Green
Write-Host 'Next:'
Write-Host '  1. Restart VS Code (or run: Developer: Reload Window)'
Write-Host '  2. Run: Husarion: Create CORE2 Project'
