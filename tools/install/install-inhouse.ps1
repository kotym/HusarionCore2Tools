param(
    [string]$BoardType = 'core2',
    [switch]$SkipModules,
    [switch]$SkipExtensionInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$frameworkRoot = Join-Path $repoRoot 'hFramework'
$bootstrapScript = Join-Path $PSScriptRoot 'bootstrap-hframework.ps1'
$installPackageScript = Join-Path $PSScriptRoot 'install-package.ps1'

Write-Host "==> Using repo root: $repoRoot"
Write-Host "==> Using hFramework root: $frameworkRoot"

$bootstrapArgs = @(
    '-ExecutionPolicy', 'Bypass',
    '-File', $bootstrapScript,
    '-Root', $frameworkRoot,
    '-BoardType', $BoardType
)
if ($SkipModules) {
    $bootstrapArgs += '-SkipModules'
}

& powershell @bootstrapArgs
if ($LASTEXITCODE -ne 0) {
    throw 'Bootstrap step failed.'
}

if (-not $SkipExtensionInstall) {
    & powershell -ExecutionPolicy Bypass -File $installPackageScript -SkipToolchainInstall
    if ($LASTEXITCODE -ne 0) {
        throw 'Extension install step failed.'
    }
}

Write-Host ''
Write-Host 'In-house installation completed successfully.' -ForegroundColor Green
