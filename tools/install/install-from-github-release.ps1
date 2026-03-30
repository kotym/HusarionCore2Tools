param(
    [Parameter(Mandatory = $true)][string]$RepoOwner,
    [Parameter(Mandatory = $true)][string]$RepoName,
    [Parameter(Mandatory = $true)][string]$Tag,
    [switch]$SkipToolchainInstall,
    [switch]$SkipCppToolsExtension,
    [switch]$KeepOtherExtensionVersions
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$zipUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/tags/$Tag.zip"
$tempRoot = Join-Path $env:TEMP ("husarion-core2-tools-install-" + [Guid]::NewGuid().ToString('N'))
$zipPath = Join-Path $tempRoot 'bundle.zip'
$extractRoot = Join-Path $tempRoot 'src'

try {
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null

    Write-Host "==> Downloading release source zip: $zipUrl"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

    Write-Host '==> Extracting bundle'
    Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

    $roots = Get-ChildItem -Path $extractRoot -Directory
    if ($roots.Count -eq 0) {
        throw 'Cannot locate extracted repository directory.'
    }

    $repoRoot = $roots[0].FullName
    $installScript = Join-Path $repoRoot 'tools\install\install-package.ps1'

    if (-not (Test-Path $installScript)) {
        throw "Bundle installer not found in downloaded release: $installScript"
    }

    Write-Host '==> Running bundle installer'
    $bundleArgs = @(
        '-ExecutionPolicy', 'Bypass',
        '-File', $installScript
    )

    if ($SkipToolchainInstall) {
        $bundleArgs += '-SkipToolchainInstall'
    }
    if ($SkipCppToolsExtension) {
        $bundleArgs += '-SkipCppToolsExtension'
    }
    if ($KeepOtherExtensionVersions) {
        $bundleArgs += '-KeepOtherExtensionVersions'
    }

    & powershell @bundleArgs

    if ($LASTEXITCODE -ne 0) {
        throw 'Bundle installer failed.'
    }
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item $tempRoot -Recurse -Force
    }
}

Write-Host ''
Write-Host 'Online installer completed successfully.' -ForegroundColor Green
