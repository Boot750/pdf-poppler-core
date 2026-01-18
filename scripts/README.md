# Scripts

Utility scripts for building, testing, and publishing pdf-poppler packages.

## Directory Structure

```
scripts/
  build/              # Binary download/build scripts
  test/               # Docker test environments
  prepare-publish.sh  # Prepare packages for publishing
  publish-packages.sh # Publish to npm
  setup-test.sh       # Setup local test environment
```

## Build Scripts

Scripts for downloading and building Poppler binaries.

| Script | Description |
|--------|-------------|
| `build/get-poppler-linux.dockerfile` | Build Linux binaries from Amazon Linux |
| `build/get-poppler-with-xvfb-linux.dockerfile` | Build Linux binaries with Xvfb |
| `build/build-bundled-xvfb.sh` | Automated build script for Xvfb variant |
| `build/get-poppler-windows.ps1` | Download Windows binaries |
| `build/Dockerfile.darwin` | Cross-compile macOS binaries using osxcross |
| `build/Dockerfile.darwin-homebrew` | Extract macOS binaries from Homebrew bottles |
| `build/build-darwin-binaries.sh` | Build macOS binaries (run on macOS) |
| `build/package-macos-sdk.sh` | Package macOS SDK for osxcross (run on macOS) |

See [build/README.md](build/README.md) for details.

## Test Scripts

Docker configurations for testing in different environments.

| Script | Description |
|--------|-------------|
| `test/test.dockerfile` | Standard Node.js test environment |
| `test/lambda-test.dockerfile` | AWS Lambda simulation |

See [test/README.md](test/README.md) for details.

## Publishing Scripts

Scripts for releasing packages to npm.

| Script | Description |
|--------|-------------|
| `prepare-publish.sh` | Prepare packages (build, lint, test) |
| `publish-packages.sh` | Publish all packages to npm |
| `setup-test.sh` | Setup local testing with npm link |

## Quick Start

### Build Linux Binaries

```bash
./scripts/build/build-bundled-xvfb.sh
```

### Build Windows Binaries

```powershell
.\scripts\build\get-poppler-windows.ps1
```

### Build macOS Binaries

**Option 1: GitHub Actions (Recommended)**

Go to Actions → Build macOS Binaries → Run workflow

**Option 2: On a Mac**

```bash
./scripts/build/build-darwin-binaries.sh ./output
cp -r output/poppler-* packages/pdf-poppler-binaries-darwin/lib/osx/
```

**Option 3: Docker with osxcross (requires macOS SDK)**

```bash
# First, on a Mac, create the SDK tarball:
./scripts/build/package-macos-sdk.sh 14.0

# Then copy MacOSX14.0.sdk.tar.xz to scripts/build/ and:
cd scripts/build
docker build -f Dockerfile.darwin -t poppler-darwin-builder .
docker run --rm -v $(pwd)/output:/artifacts poppler-darwin-builder
```

### Run Tests in Docker

```bash
docker build -t pdf-poppler-test -f scripts/test/test.dockerfile .
docker run --rm pdf-poppler-test
```

### Publish Packages

```bash
./scripts/prepare-publish.sh
./scripts/publish-packages.sh
```
