param(
    [switch]$SkipExtensionInstall,
    [switch]$SkipToolchainInstall,
    [switch]$KeepOtherExtensionVersions,
    [switch]$SkipCppToolsExtension,
    [string]$OfflineBundleDir = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$newScript = Join-Path $PSScriptRoot 'install-package.ps1'
if (-not (Test-Path $newScript)) {
    throw "Script not found: $newScript"
}

Write-Host '[DEPRECATED] install-bundle.ps1 renamed to install-package.ps1' -ForegroundColor Yellow

$args = @('-ExecutionPolicy', 'Bypass', '-File', $newScript)
if ($SkipExtensionInstall) { $args += '-SkipExtensionInstall' }
if ($SkipToolchainInstall) { $args += '-SkipToolchainInstall' }
if ($KeepOtherExtensionVersions) { $args += '-KeepOtherExtensionVersions' }
if ($SkipCppToolsExtension) { $args += '-SkipCppToolsExtension' }
if ($OfflineBundleDir) { $args += @('-OfflineBundleDir', $OfflineBundleDir) }

& powershell @args
exit $LASTEXITCODE
