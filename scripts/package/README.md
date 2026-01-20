# Build Scripts

Scripts for downloading and building Poppler binaries for different platforms.

## Linux Binaries

### Regular Linux Build

Downloads Poppler binaries from Amazon Linux 2023 with basic dependencies.

```bash
# Build and extract
docker build -t poppler-linux-builder -f scripts/package/get-poppler-linux.dockerfile .
docker run --rm poppler-linux-builder > poppler-linux.tar.gz
```

### Linux with Xvfb (Recommended for Lambda)

Downloads Poppler binaries bundled with Xvfb for headless environments like AWS Lambda.

```bash
# Using the build script (recommended)
./scripts/package/build-bundled-xvfb.sh

# Or manually:
docker build -t poppler-xvfb-builder -f scripts/package/get-poppler-with-xvfb-linux.dockerfile .
docker run --rm poppler-xvfb-builder > poppler-xvfb.tar.gz
```

The build script automatically:
- Detects the Poppler version
- Creates versioned output folder (e.g., `poppler-24.08-xvfb`)
- Places binaries in `packages/pdf-poppler-binaries-linux/lib/linux/`

## Windows Binaries

Downloads pre-built Windows binaries from [poppler-windows](https://github.com/oschwartz10612/poppler-windows) releases.

```powershell
# Default version (24.08.0)
.\scripts\build\get-poppler-windows.ps1

# Specific version
.\scripts\build\get-poppler-windows.ps1 -Version "24.08.0"

# Custom output directory
.\scripts\build\get-poppler-windows.ps1 -OutputDir ".\custom\path"
```

Output is placed in `packages/pdf-poppler-binaries-win32/lib/win/poppler-{version}/`.

## macOS Binaries

macOS binaries can be built in several ways:

### Option 1: GitHub Actions (Recommended)

The easiest way is using the GitHub Actions workflow:

1. Go to **Actions** → **Build macOS Binaries**
2. Click **Run workflow**
3. Optionally specify a poppler version
4. Downloads artifacts or let the workflow create a PR

The workflow builds for both Intel (x86_64) and Apple Silicon (arm64), then creates universal binaries.

### Option 2: Local Build on macOS

Run directly on a Mac:

```bash
# Make the script executable
chmod +x scripts/package/build-darwin-binaries.sh

# Build binaries
./scripts/package/build-darwin-binaries.sh ./output

# Copy to package
cp -r output/poppler-* packages/pdf-poppler-binaries-darwin/lib/osx/
```

### Option 3: Docker with osxcross

Cross-compile from Linux using osxcross. Requires the macOS SDK (due to Apple licensing, you must obtain this from a Mac with Xcode):

```bash
# Step 1: On a Mac, create the SDK tarball
./scripts/package/package-macos-sdk.sh 14.0
# This creates MacOSX14.0.sdk.tar.xz

# Step 2: Copy the SDK to scripts/package/

# Step 3: Build with Docker
cd scripts/package
docker build -f Dockerfile.darwin -t poppler-darwin-builder .
docker run --rm -v $(pwd)/output:/artifacts poppler-darwin-builder
```

### Option 4: Homebrew Bottles (Experimental)

Extract pre-built binaries from Homebrew bottles:

```bash
cd scripts/package
docker build -f Dockerfile.darwin-homebrew -t poppler-darwin-extractor .
docker run --rm -v $(pwd)/output:/output poppler-darwin-extractor
```

**Note:** Homebrew bottles are macOS binaries and may not work correctly when extracted on Linux.

## Output Structure

After building, binaries are organized as:

```
packages/
  pdf-poppler-binaries-linux/
    lib/linux/
      poppler-{version}/           # Regular build
        bin/
        lib/
        VERSION
      poppler-{version}-xvfb/      # Xvfb build
        bin/
        lib/
        share/
        VERSION
  pdf-poppler-binaries-win32/
    lib/win/
      poppler-{version}/
        bin/
        VERSION
  pdf-poppler-binaries-darwin/
    lib/osx/
      poppler-{version}/
        bin/
        lib/
        VERSION
```

## VERSION File

Each build creates a `VERSION` file containing:

```
POPPLER_VERSION=24.08
BUILD_DATE=2025-01-06
VARIANT=xvfb          # Only for xvfb builds
PLATFORM=win32        # Only for Windows
```

This file is used by `pdf-poppler-core` to detect available versions.
