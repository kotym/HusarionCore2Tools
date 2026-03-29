$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [string]$BoardType = 'core2',
    [switch]$SkipModules,
    [switch]$SkipExtensionInstall
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$frameworkRoot = Join-Path $repoRoot 'hFramework'
$bootstrapScript = Join-Path $PSScriptRoot 'bootstrap-hframework.ps1'
$installExtensionScript = Join-Path $PSScriptRoot 'install-core2-extension.ps1'

Write-Host "==> Using repo root: $repoRoot"
Write-Host "==> Using hFramework root: $frameworkRoot"

& powershell -ExecutionPolicy Bypass -File $bootstrapScript -Root $frameworkRoot -BoardType $BoardType -SkipModules:$SkipModules
if ($LASTEXITCODE -ne 0) {
    throw 'Bootstrap step failed.'
}

if (-not $SkipExtensionInstall) {
    & powershell -ExecutionPolicy Bypass -File $installExtensionScript
    if ($LASTEXITCODE -ne 0) {
        throw 'Extension install step failed.'
    }
}

Write-Host ''
Write-Host 'In-house installation completed successfully.' -ForegroundColor Green
