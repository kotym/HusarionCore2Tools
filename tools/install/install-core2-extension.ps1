$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [switch]$KeepOtherVersions
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$extRoot = Join-Path $repoRoot 'tools\vscode-husarion-core2'
$packScript = Join-Path $extRoot 'pack-local-extension.ps1'
$packageJsonPath = Join-Path $extRoot 'package.json'

if (-not (Test-Path $packScript)) {
    throw "Pack script not found: $packScript"
}

if (-not (Test-Path $packageJsonPath)) {
    throw "package.json not found: $packageJsonPath"
}

$pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$folderName = "$($pkg.publisher).$($pkg.name)-$($pkg.version)"
$distFolder = Join-Path $extRoot "dist\$folderName"
$extensionsRoot = Join-Path $env:USERPROFILE '.vscode\extensions'
$targetFolder = Join-Path $extensionsRoot $folderName

Write-Host "==> Packing extension"
& powershell -ExecutionPolicy Bypass -File $packScript
if ($LASTEXITCODE -ne 0) {
    throw 'Extension pack step failed.'
}

if (-not (Test-Path $distFolder)) {
    throw "Packed extension folder not found: $distFolder"
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

Write-Host "==> Installing extension to $targetFolder"
Copy-Item -Path $distFolder -Destination $targetFolder -Recurse -Force

Write-Host ''
Write-Host 'Extension installation complete.' -ForegroundColor Green
Write-Host 'Next:'
Write-Host '  1. Restart VS Code (or run: Developer: Reload Window)'
Write-Host '  2. Run: Husarion: Create CORE2 Project'
