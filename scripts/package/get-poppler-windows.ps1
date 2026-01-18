# PowerShell script to download Windows poppler binaries
# This downloads pre-built Windows binaries from the poppler-windows releases

param(
    [string]$OutputDir = ".\packages\pdf-poppler-binaries-win32\lib\win",
    [string]$Version = "24.08.0"
)

$ErrorActionPreference = "Stop"

# Create output directory
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$downloadUrl = "https://github.com/oschwartz10612/poppler-windows/releases/download/v$Version-0/Release-$Version-0.zip"
$zipPath = "$env:TEMP\poppler-windows.zip"
$extractPath = "$env:TEMP\poppler-extract"

Write-Host "Downloading poppler $Version for Windows..."
Write-Host "URL: $downloadUrl"

# Download the zip file
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
} catch {
    Write-Error "Failed to download poppler binaries: $_"
    exit 1
}

Write-Host "Extracting..."

# Clean up extract path if it exists
if (Test-Path $extractPath) {
    Remove-Item -Recurse -Force $extractPath
}

# Extract the zip
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

# Find the extracted folder (it's usually poppler-XX.XX.X)
$extractedFolder = Get-ChildItem -Path $extractPath -Directory | Select-Object -First 1

if (!$extractedFolder) {
    Write-Error "Could not find extracted poppler folder"
    exit 1
}

# Determine version from folder name
$versionMatch = $extractedFolder.Name -match 'poppler-(\d+\.\d+\.\d+)'
if ($versionMatch) {
    $detectedVersion = $Matches[1]
    # Convert 24.08.0 to 24.08 for folder naming consistency
    $shortVersion = ($detectedVersion -split '\.')[0..1] -join '.'
} else {
    $shortVersion = $Version -replace '\.0$', ''
}

$targetDir = Join-Path $OutputDir "poppler-$shortVersion"

Write-Host "Detected version: $shortVersion"
Write-Host "Target directory: $targetDir"

# Clean up target directory if it exists
if (Test-Path $targetDir) {
    Remove-Item -Recurse -Force $targetDir
}

# Create target directory structure
New-Item -ItemType Directory -Path "$targetDir\bin" -Force | Out-Null

# Copy binaries (bin folder contains exe files and DLLs)
$sourcebin = Join-Path $extractedFolder.FullName "Library\bin"
if (Test-Path $sourcebin) {
    Copy-Item -Path "$sourcebin\*" -Destination "$targetDir\bin\" -Recurse -Force
    Write-Host "Copied binaries from Library\bin"
} else {
    # Try alternate structure
    $sourcebin = Join-Path $extractedFolder.FullName "bin"
    if (Test-Path $sourcebin) {
        Copy-Item -Path "$sourcebin\*" -Destination "$targetDir\bin\" -Recurse -Force
        Write-Host "Copied binaries from bin"
    }
}

# Create VERSION file
$versionContent = @"
POPPLER_VERSION=$shortVersion
BUILD_DATE=$(Get-Date -Format "yyyy-MM-dd")
PLATFORM=win32
"@
$versionContent | Out-File -FilePath "$targetDir\VERSION" -Encoding UTF8

# Clean up
Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $extractPath -ErrorAction SilentlyContinue

# List what we got
Write-Host ""
Write-Host "=== Downloaded poppler binaries ==="
Get-ChildItem -Path "$targetDir\bin" -Filter "*.exe" | ForEach-Object { Write-Host $_.Name }

Write-Host ""
Write-Host "=== DLL files ==="
Get-ChildItem -Path "$targetDir\bin" -Filter "*.dll" | ForEach-Object { Write-Host $_.Name }

Write-Host ""
Write-Host "Done! Binaries installed to: $targetDir"

# Test pdfinfo
$pdfinfo = Join-Path $targetDir "bin\pdfinfo.exe"
if (Test-Path $pdfinfo) {
    Write-Host ""
    Write-Host "=== Testing pdfinfo ==="
    & $pdfinfo -v 2>&1
}
