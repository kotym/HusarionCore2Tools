param(
    [switch]$InstallCppToolsExtension,
    [string]$OfflineBundleDir = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$newScript = Join-Path $PSScriptRoot 'install-or-refresh-toolchain.ps1'
if (-not (Test-Path $newScript)) {
    throw "Script not found: $newScript"
}

Write-Host '[DEPRECATED] install-deps.ps1 renamed to install-or-refresh-toolchain.ps1' -ForegroundColor Yellow

$args = @('-ExecutionPolicy', 'Bypass', '-File', $newScript)
if ($InstallCppToolsExtension) { $args += '-InstallCppToolsExtension' }
if ($OfflineBundleDir) { $args += @('-OfflineBundleDir', $OfflineBundleDir) }

& powershell @args
exit $LASTEXITCODE
