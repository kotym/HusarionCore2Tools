param(
    [switch]$KeepOtherVersions
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$newScript = Join-Path $PSScriptRoot 'install-package.ps1'
if (-not (Test-Path $newScript)) {
    throw "Script not found: $newScript"
}

Write-Host '[DEPRECATED] install-core2-extension.ps1 renamed to install-package.ps1' -ForegroundColor Yellow

$args = @('-ExecutionPolicy', 'Bypass', '-File', $newScript, '-SkipToolchainInstall')
if ($KeepOtherVersions) {
    $args += '-KeepOtherExtensionVersions'
}

& powershell @args
exit $LASTEXITCODE
