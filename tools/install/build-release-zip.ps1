param(
    [string]$Version,
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $OutDir) {
    $OutDir = Join-Path $repoRoot 'dist'
}

$bundleName = if ($Version) { "HusarionCore2Tools-$Version" } else { 'HusarionCore2Tools' }
$stageRoot = Join-Path $OutDir ("_stage_" + $bundleName)
$bundleRoot = Join-Path $stageRoot $bundleName
$zipPath = Join-Path $OutDir ("$bundleName.zip")

if (Test-Path $stageRoot) {
    Remove-Item $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $bundleRoot -Force | Out-Null
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$entriesToCopy = @(
    'README.md',
    '.github',
    'tools',
    'hFramework',
    'hSensors',
    'hModules'
)

foreach ($entry in $entriesToCopy) {
    $newScript = Join-Path $PSScriptRoot 'build-distribution-package.ps1'
    if (-not (Test-Path $newScript)) {
        throw "Script not found: $newScript"
    }

    Write-Host '[DEPRECATED] build-release-zip.ps1 renamed to build-distribution-package.ps1' -ForegroundColor Yellow

    $args = @('-ExecutionPolicy', 'Bypass', '-File', $newScript)
    if ($Version) { $args += @('-Version', $Version) }
    if ($OutDir) { $args += @('-OutDir', $OutDir) }

    & powershell @args
    exit $LASTEXITCODE
$filesToRemove = @('*.hex', '*.bin', '*.elf', '*.a', '*.obj', '*.o')
