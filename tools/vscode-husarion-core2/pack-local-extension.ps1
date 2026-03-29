$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageJsonPath = Join-Path $scriptDir 'package.json'
$distRoot = Join-Path $scriptDir 'dist'

if (-not (Test-Path $packageJsonPath)) {
    throw "package.json not found at $packageJsonPath"
}

$pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$folderName = "$($pkg.publisher).$($pkg.name)-$($pkg.version)"
$outDir = Join-Path $distRoot $folderName

if (Test-Path $outDir) {
    Remove-Item $outDir -Recurse -Force
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$filesToCopy = @(
    'package.json',
    'extension.js',
    'README.md',
    'LICENSE'
)

foreach ($item in $filesToCopy) {
    $src = Join-Path $scriptDir $item
    if (Test-Path $src) {
        Copy-Item $src -Destination (Join-Path $outDir $item) -Force
    }
}

Write-Host "Packaged extension folder created: $outDir"
Write-Host "Copy this folder to: $env:USERPROFILE\.vscode\extensions"
Write-Host "Then restart VS Code."
