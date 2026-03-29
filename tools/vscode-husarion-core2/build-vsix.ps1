$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageJsonPath = Join-Path $scriptDir 'package.json'
$distDir = Join-Path $scriptDir 'dist'

if (-not (Test-Path $packageJsonPath)) {
    throw "package.json not found: $packageJsonPath"
}

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw 'npx is not available. Install Node.js first.'
}

$pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$vsixName = "$($pkg.publisher).$($pkg.name)-$($pkg.version).vsix"
$outPath = Join-Path $distDir $vsixName

New-Item -ItemType Directory -Path $distDir -Force | Out-Null
if (Test-Path $outPath) {
    Remove-Item $outPath -Force
}

Push-Location $scriptDir
try {
    & npx --yes @vscode/vsce package --out $outPath
    if ($LASTEXITCODE -ne 0) {
        throw 'VSIX packaging failed.'
    }
}
finally {
    Pop-Location
}

Write-Host "VSIX created: $outPath" -ForegroundColor Green
Write-Host "Install command: code --install-extension \"$outPath\" --force"
