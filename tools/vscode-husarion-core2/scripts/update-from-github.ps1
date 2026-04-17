param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubRepo,
    [string]$TargetVersion = '',
    [string]$ExtensionId = 'local.husarion-core2-tools',
    [string]$AssetNamePattern = 'HusarionCore2Tools-*.zip',
    [string]$CurrentHframeworkPath = '',
    [switch]$DeleteOldInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-GitHubRelease {
    param(
        [Parameter(Mandatory = $true)][string]$Repository,
        [string]$RequestedVersion = ''
    )

    $headers = @{
        'User-Agent' = 'HusarionCore2Tools-Updater'
        'Accept' = 'application/vnd.github+json'
    }

    if ($RequestedVersion) {
        $uri = "https://api.github.com/repos/$Repository/releases/tags/$RequestedVersion"
    }
    else {
        $uri = "https://api.github.com/repos/$Repository/releases/latest"
    }

    return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
}

function Select-ReleaseZipAsset {
    param(
        [Parameter(Mandatory = $true)]$Release,
        [Parameter(Mandatory = $true)][string]$Pattern
    )

    $assets = @($Release.assets)
    if (-not $assets -or $assets.Count -eq 0) {
        throw "Release '$($Release.tag_name)' has no downloadable assets."
    }

    $candidate = $assets |
        Where-Object { $_.name -like '*.zip' -and $_.name -like $Pattern } |
        Select-Object -First 1

    if (-not $candidate) {
        $candidate = $assets |
            Where-Object { $_.name -like '*.zip' } |
            Select-Object -First 1
    }

    if (-not $candidate) {
        throw "Release '$($Release.tag_name)' does not contain a ZIP asset."
    }

    return $candidate
}

function Resolve-InstallRootFromHframeworkPath {
    param([string]$PathValue)

    if (-not $PathValue) {
        return $null
    }

    $expanded = [Environment]::ExpandEnvironmentVariables($PathValue)
    if (-not $expanded) {
        return $null
    }

    $resolvedPath = $expanded
    if (Test-Path $expanded) {
        try {
            $resolvedPath = (Resolve-Path $expanded).Path
        }
        catch {
            $resolvedPath = $expanded
        }
    }

    if ([System.IO.Path]::GetFileName($resolvedPath) -ieq 'hFramework') {
        return Split-Path -Parent $resolvedPath
    }

    return $resolvedPath
}

function Get-CurrentInstallRoot {
    param([string]$ExplicitHframeworkPath)

    $candidates = @()
    if ($ExplicitHframeworkPath) {
        $candidates += $ExplicitHframeworkPath
    }

    foreach ($scope in @('Process', 'User', 'Machine')) {
        $value = [Environment]::GetEnvironmentVariable('HFRAMEWORK_PATH', $scope)
        if ($value) {
            $candidates += $value
        }
    }

    foreach ($candidate in $candidates) {
        $installRoot = Resolve-InstallRootFromHframeworkPath -PathValue $candidate
        if (-not $installRoot) {
            continue
        }

        $hfPath = Join-Path $installRoot 'hFramework'
        $installScript = Join-Path $installRoot 'tools\install\install-package.ps1'
        if ((Test-Path $hfPath) -and (Test-Path $installScript)) {
            return $installRoot
        }
    }

    throw "Cannot resolve current installation root from HFRAMEWORK_PATH. Current value: '$ExplicitHframeworkPath'"
}

$workRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("HusarionCore2Update_" + [Guid]::NewGuid().ToString('N'))
$extractRoot = Join-Path $workRoot 'unzipped'
$currentInstallRoot = $null
$newInstallRoot = $null

try {
    New-Item -ItemType Directory -Path $workRoot -Force | Out-Null

    $currentInstallRoot = Get-CurrentInstallRoot -ExplicitHframeworkPath $CurrentHframeworkPath
    $installParentDir = Split-Path -Parent $currentInstallRoot
    if (-not $installParentDir) {
        throw "Cannot determine install parent directory from current root: $currentInstallRoot"
    }
    if (-not (Test-Path $installParentDir)) {
        throw "Install parent directory does not exist: $installParentDir"
    }

    Write-Host "==> Current install root: $currentInstallRoot"
    Write-Host "==> New package will be placed under: $installParentDir"

    Write-Host "==> Fetching release metadata from GitHub repository: $GitHubRepo"
    $release = Get-GitHubRelease -Repository $GitHubRepo -RequestedVersion $TargetVersion
    if (-not $release -or -not $release.tag_name) {
        throw 'GitHub response does not contain release tag information.'
    }

    $zipAsset = Select-ReleaseZipAsset -Release $release -Pattern $AssetNamePattern

    $zipPath = Join-Path $workRoot $zipAsset.name
    Write-Host "==> Downloading: $($zipAsset.browser_download_url)"
    Invoke-WebRequest -Uri $zipAsset.browser_download_url -OutFile $zipPath -UseBasicParsing

    Write-Host "==> Extracting package to: $extractRoot"
    Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

    $installBat = Get-ChildItem -Path $extractRoot -Filter 'install.bat' -File -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $installBat) {
        throw 'install.bat was not found in the downloaded package.'
    }

    $extractedRoot = $installBat.Directory.FullName
    $newFolderName = Split-Path -Leaf $extractedRoot
    if (-not $newFolderName) {
        throw "Cannot determine extracted package root from path: $extractedRoot"
    }

    $newInstallRoot = Join-Path $installParentDir $newFolderName
    if (Test-Path $newInstallRoot) {
        Write-Host "==> Removing existing folder for target version: $newInstallRoot"
        Remove-Item -Path $newInstallRoot -Recurse -Force
    }

    Write-Host "==> Moving extracted package to: $newInstallRoot"
    Move-Item -Path $extractedRoot -Destination $newInstallRoot

    $installScript = Join-Path $newInstallRoot 'tools\install\install-package.ps1'
    if (-not (Test-Path $installScript)) {
        throw "Installer script not found in new package: $installScript"
    }

    Write-Host "==> Running package installer from: $installScript"
    & powershell -ExecutionPolicy Bypass -File $installScript -SkipToolchainInstall
    if ((Test-Path variable:LASTEXITCODE) -and $LASTEXITCODE -ne 0) {
        throw "Installer exited with code $LASTEXITCODE."
    }

    Write-Host '==> Extension version cleanup is handled by install-package.ps1 during installation.'

    if ($DeleteOldInstall) {
        if ($currentInstallRoot -and (Test-Path $currentInstallRoot) -and ($currentInstallRoot -ine $newInstallRoot)) {
            Write-Host "==> Removing previous install root: $currentInstallRoot"
            Remove-Item -Path $currentInstallRoot -Recurse -Force
        }
    }
    else {
        Write-Host "==> Keeping previous install root: $currentInstallRoot"
    }

    Write-Host ''
    Write-Host "Update completed successfully to release $($release.tag_name)." -ForegroundColor Green
    Write-Host 'Restart VS Code (or run Developer: Reload Window) to activate the new extension version.'
}
catch {
    Write-Host "[ERROR] Update failed: $($_.Exception.Message)" -ForegroundColor Red
    throw
}
finally {
    if (Test-Path $workRoot) {
        try {
            Remove-Item -Path $workRoot -Recurse -Force -ErrorAction Stop
        }
        catch {
            Write-Host "[WARN] Could not remove temporary folder '$workRoot': $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}
