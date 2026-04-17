param(
    [switch]$SkipExtensionInstall,
    [switch]$SkipToolchainInstall,
    [switch]$KeepOtherExtensionVersions,
    [switch]$NoFolderFallback,
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

function Normalize-VscodeExtensionsPath {
    param([string]$PathValue)

    if (-not $PathValue) {
        return ''
    }

    $expanded = [Environment]::ExpandEnvironmentVariables($PathValue.Trim().Trim('"'))
    if (-not $expanded) {
        return ''
    }

    # Repair common malformed value: C:\Users\name.vscode\extensions
    if ($expanded -match '^(?<base>[A-Za-z]:\\Users\\[^\\]+)\.vscode\\extensions$') {
        return "$($matches.base)\\.vscode\\extensions"
    }

    return $expanded
}

function Get-ExtensionsRoot {
    $fromEnv = Normalize-VscodeExtensionsPath $env:VSCODE_EXTENSIONS
    if ($fromEnv) {
        return $fromEnv
    }

    return Join-Path (Join-Path (Get-UserProfilePath) '.vscode') 'extensions'
}

function Repair-VscodeExtensionsEnv {
    $currentUserValue = [Environment]::GetEnvironmentVariable('VSCODE_EXTENSIONS', 'User')
    if (-not $currentUserValue) {
        return
    }

    $fixed = Normalize-VscodeExtensionsPath $currentUserValue
    if (-not $fixed) {
        return
    }

    if ($fixed -ne $currentUserValue) {
        [Environment]::SetEnvironmentVariable('VSCODE_EXTENSIONS', $fixed, 'User')
        $env:VSCODE_EXTENSIONS = $fixed
        Write-Host "==> Repaired user VSCODE_EXTENSIONS path: $fixed"
    }
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
        (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code'),
        (Join-Path $env:ProgramFiles 'Microsoft VS Code\bin\code.cmd'),
        (Join-Path $env:ProgramFiles 'Microsoft VS Code\bin\code'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code Insiders\bin\code-insiders'),
        (Join-Path $env:ProgramFiles 'Microsoft VS Code Insiders\bin\code-insiders.cmd'),
        (Join-Path $env:ProgramFiles 'Microsoft VS Code Insiders\bin\code-insiders')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    $cmd = Get-Command code -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        $source = $cmd.Source
        if ($source -match 'code(\-insiders)?\.cmd$') {
            return $source
        }

        # If PowerShell resolves `code` to Code.exe, prefer adjacent bin\code.cmd.
        if ($source -match 'Code(\s+-\s+Insiders)?\.exe$') {
            $exeDir = Split-Path -Parent $source
            $cmdCandidate = Join-Path $exeDir 'bin\code.cmd'
            if (Test-Path $cmdCandidate) {
                return $cmdCandidate
            }
        }

        return $source
    }

    return $null
}

function Invoke-CodeCli {
    param(
        [Parameter(Mandatory = $true)][string]$CodeCli,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $varsToClear = @('VSCODE_IPC_HOOK_CLI', 'VSCODE_IPC_HOOK_EXTHOST', 'VSCODE_CWD')
    $saved = @{}

    foreach ($name in $varsToClear) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }

    try {
        return @(& $CodeCli @Arguments 2>&1)
    }
    finally {
        foreach ($name in $varsToClear) {
            [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process')
        }
    }
}

function Remove-OtherExtensionFolders {
    param(
        [Parameter(Mandatory = $true)][string]$ExtensionsRoot,
        [Parameter(Mandatory = $true)][string]$ExtensionId,
        [Parameter(Mandatory = $true)][string]$KeepFolderName,
        [switch]$KeepOtherVersions
    )

    if ($KeepOtherVersions) {
        return
    }

    $pattern = "$ExtensionId-*"
    Get-ChildItem -Path $ExtensionsRoot -Directory -Filter $pattern -ErrorAction SilentlyContinue |
        ForEach-Object {
            if ($_.Name -ieq $KeepFolderName) {
                return
            }

            Write-Host "==> Removing old extension: $($_.FullName)"
            Remove-Item $_.FullName -Recurse -Force
        }
}

function Install-LocalExtension {
    param([switch]$KeepOtherVersions)

    if (-not (Test-Path $packageJsonPath)) {
        throw "package.json not found: $packageJsonPath"
    }

    $pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $folderName = "$($pkg.publisher).$($pkg.name)-$($pkg.version)"
    $extensionId = "$($pkg.publisher).$($pkg.name)"
    $extensionsRoot = Get-ExtensionsRoot
    $targetFolder = Join-Path $extensionsRoot $folderName
    $sourceFiles = @('package.json', 'extension.js', 'README.md', 'scripts')
    $vsixName = "$($pkg.publisher).$($pkg.name)-$($pkg.version).vsix"
    $vsixPath = Join-Path $extRoot "dist\$vsixName"

    Write-Host '==> Installing extension'

    # First, prefer VSIX install via VS Code extension manager.
    $codeCli = Get-CodeCliPath
    if ($codeCli -and (Test-Path $vsixPath)) {
        Write-Host "  Using VS Code CLI: $codeCli"
        Write-Host "  Extensions directory: $extensionsRoot"
        Write-Host "  Installing VSIX via VS Code extension manager: $vsixPath"
        $vsixExitCode = 1
        $vsixOutput = @()
        try {
            $vsixOutput = Invoke-CodeCli -CodeCli $codeCli -Arguments @('--install-extension', $vsixPath, '--force', '--extensions-dir', $extensionsRoot)
            foreach ($line in $vsixOutput) {
                Write-Host "  $line"
            }
            if (Test-Path variable:LASTEXITCODE) {
                $vsixExitCode = $LASTEXITCODE
            }
        }
        catch {
            Write-Host "  [WARN] VSIX installation command failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }

        if ($vsixExitCode -eq 0) {
            try {
                $installed = (Invoke-CodeCli -CodeCli $codeCli -Arguments @('--list-extensions', '--extensions-dir', $extensionsRoot)) | Where-Object { $_ -eq $extensionId }
                if ($installed) {
                    Remove-OtherExtensionFolders -ExtensionsRoot $extensionsRoot -ExtensionId $extensionId -KeepFolderName $folderName -KeepOtherVersions:$KeepOtherVersions
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

        $vsixDetails = ''
        if ($vsixOutput -and $vsixOutput.Count -gt 0) {
            $vsixDetails = ($vsixOutput | Out-String).Trim()
        }

        Write-Host "  VSIX installer exit code: $vsixExitCode"

        if ($NoFolderFallback) {
            if ($vsixDetails) {
                throw "VSIX installation failed and folder fallback is disabled. CLI output:`n$vsixDetails"
            }
            throw 'VSIX installation failed and folder fallback is disabled.'
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

    Remove-OtherExtensionFolders -ExtensionsRoot $extensionsRoot -ExtensionId $extensionId -KeepFolderName $folderName -KeepOtherVersions:$KeepOtherVersions

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
Repair-VscodeExtensionsEnv

if (-not $NoFolderFallback -and $env:HUSARION_UPDATE_MODE -eq '1') {
    $NoFolderFallback = $true
    Write-Host '==> Update mode detected: folder fallback disabled for safe self-update.'
}

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
