param(
    [string]$Version,
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-JsonNoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Object
    )

    $json = $Object | ConvertTo-Json -Depth 20
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($machinePath -or $userPath) {
        $env:Path = "$machinePath;$userPath"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $OutDir) {
    $OutDir = Join-Path $repoRoot 'dist'
}

$bundleName = if ($Version) { "HusarionCore2Tools-$Version" } else { 'HusarionCore2Tools' }
$stageRoot = Join-Path $OutDir ("_stage_" + $bundleName)
$bundleRoot = Join-Path $stageRoot $bundleName
$zipPath = Join-Path $OutDir ("$bundleName.zip")

$cleanVersion = if ($Version) {
    if ($Version -match '^v(.+)$') { $matches[1] } else { $Version }
}
else {
    ''
}

$extRoot = Join-Path $repoRoot 'tools\vscode-husarion-core2'
$packageJsonPath = Join-Path $extRoot 'package.json'
$distRoot = Join-Path $extRoot 'dist'
$originalVersion = ''

try {
    Refresh-ProcessPath

    if (-not (Test-Path $packageJsonPath)) {
        throw "Extension package.json not found: $packageJsonPath"
    }

    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
        throw 'npx is required to build a valid VSIX. Install Node.js LTS, then rerun build-distribution-package.ps1.'
    }

    if ($cleanVersion) {
        $pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        $originalVersion = $pkg.version

        Write-Host "==> Updating extension version to: $cleanVersion"
        $pkg.version = $cleanVersion
        Write-JsonNoBom -Path $packageJsonPath -Object $pkg

        if (Test-Path $distRoot) {
            Get-ChildItem -Path $distRoot -Directory -Filter "$($pkg.publisher).$($pkg.name)-*" -ErrorAction SilentlyContinue |
                ForEach-Object { Remove-Item $_.FullName -Recurse -Force }
            Get-ChildItem -Path $distRoot -File -Filter "$($pkg.publisher).$($pkg.name)-*.vsix" -ErrorAction SilentlyContinue |
                ForEach-Object { Remove-Item $_.FullName -Force }
        }

        Write-Host '==> Building VSIX with correct version'
        $vsixScript = Join-Path $extRoot 'build-vsix.ps1'
        if (-not (Test-Path $vsixScript)) {
            throw "VSIX build script not found: $vsixScript"
        }

        & powershell -ExecutionPolicy Bypass -File $vsixScript
        if ($LASTEXITCODE -ne 0) {
            throw 'VSIX packaging failed.'
        }

        $expectedVsix = Join-Path $distRoot ("$($pkg.publisher).$($pkg.name)-$cleanVersion.vsix")
        if (-not (Test-Path $expectedVsix)) {
            throw "Expected VSIX not found after build: $expectedVsix"
        }
    }

    if (Test-Path $stageRoot) {
        Remove-Item $stageRoot -Recurse -Force
    }

    New-Item -ItemType Directory -Path $bundleRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

    $entriesToCopy = @(
        'README.md',
        'THIRD_PARTY_NOTICES.md',
        'tools',
        'hFramework',
        'hSensors',
        'hModules'
    )

    foreach ($entry in $entriesToCopy) {
        $src = Join-Path $repoRoot $entry
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination (Join-Path $bundleRoot $entry) -Recurse -Force
        }
    }

    $installDir = Join-Path $bundleRoot 'tools\install'
    Get-ChildItem -Path $installDir -File -Filter '*.ps1' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notin @('install-package.ps1') } |
        ForEach-Object { Remove-Item $_.FullName -Force }

    $dirsToRemoveByName = @('.git', '.github', '.vs', '.vscode', 'node_modules', 'build', 'docs', 'tests', 'examples', 'py-connector', 'devtools', 'project_arduino')
    foreach ($dirName in $dirsToRemoveByName) {
        Get-ChildItem -Path $bundleRoot -Directory -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ieq $dirName } |
            ForEach-Object { Remove-Item $_.FullName -Recurse -Force }
    }

    Get-ChildItem -Path $bundleRoot -Directory -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ieq 'dist' -and $_.FullName -notmatch 'vscode-husarion-core2[\\\/]dist' } |
        ForEach-Object { Remove-Item $_.FullName -Recurse -Force }

    # Keep only VSIX in extension dist inside package (no duplicate pre-packed folder).
    $bundleExtDist = Join-Path $bundleRoot 'tools\vscode-husarion-core2\dist'
    if (Test-Path $bundleExtDist) {
        Get-ChildItem -Path $bundleExtDist -Directory -ErrorAction SilentlyContinue |
            ForEach-Object { Remove-Item $_.FullName -Recurse -Force }
    }

    $filesToRemoveByName = @('.gitignore', '.gitattributes', '.editorconfig')
    foreach ($fileName in $filesToRemoveByName) {
        Get-ChildItem -Path $bundleRoot -File -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ieq $fileName } |
            ForEach-Object { Remove-Item $_.FullName -Force }
    }

    $artifactPatterns = @('*.hex', '*.bin', '*.elf', '*.a', '*.obj', '*.o', '*.pdb')
    foreach ($pattern in $artifactPatterns) {
        Get-ChildItem -Path $bundleRoot -File -Recurse -Filter $pattern -ErrorAction SilentlyContinue |
            ForEach-Object { Remove-Item $_.FullName -Force }
    }

    $batContent = @'
@echo off
REM Husarion CORE2 Tools Installation Batch Script
REM This script runs the PowerShell installer with proper execution policy

powershell -ExecutionPolicy Bypass -File "tools\install\install-package.ps1"
if errorlevel 1 (
    echo.
    echo Installation failed. Please check the errors above.
    pause
    exit /b 1
)

echo.
echo Installation completed successfully!
echo Please restart VS Code to activate the extension.
pause
'@

    $batPath = Join-Path $bundleRoot 'install.bat'
    Set-Content -Path $batPath -Value $batContent -Encoding ASCII -Force
    Write-Host 'Created install.bat for easy double-click installation'

    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }

    Push-Location $stageRoot
    try {
        Compress-Archive -Path $bundleName -DestinationPath $zipPath -Force
    }
    finally {
        Pop-Location
    }

    Remove-Item $stageRoot -Recurse -Force

    Write-Host "Distribution package created: $zipPath" -ForegroundColor Green
    Write-Host 'Installer inside package:'
    Write-Host '  tools/install/install-package.ps1'
    Write-Host '  (or simply double-click install.bat)'
}
finally {
    if ($originalVersion -and (Test-Path $packageJsonPath)) {
        Write-Host '==> Restoring original extension version in source'
        $restorePkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        $restorePkg.version = $originalVersion
        Write-JsonNoBom -Path $packageJsonPath -Object $restorePkg
    }
}
