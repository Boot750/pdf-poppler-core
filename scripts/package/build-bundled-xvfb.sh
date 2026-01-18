#!/bin/bash

# Build script for poppler + Xvfb bundled binaries
# This creates a complete bundle that doesn't require Lambda Layers
#
# Usage: Run from repository root:
#   ./scripts/build/build-bundled-xvfb.sh

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Building poppler + Xvfb bundled binaries for Linux..."
echo "Repository root: $REPO_ROOT"

# Change to repo root for correct output paths
cd "$REPO_ROOT"

# Build the Docker image
echo "Building Docker image..."
docker build -t poppler-xvfb-builder -f "$SCRIPT_DIR/get-poppler-with-xvfb-linux.dockerfile" .

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
TEMP_TAR="$TEMP_DIR/poppler-xvfb.tar.gz"

# Run container and extract binaries to temp location
echo "Extracting binaries..."
docker run --rm poppler-xvfb-builder > "$TEMP_TAR"

# Extract to temp directory first to get VERSION file
echo "Reading version information..."
tar -xzf "$TEMP_TAR" -C "$TEMP_DIR"

# Read version from VERSION file
if [ -f "$TEMP_DIR/VERSION" ]; then
    POPPLER_VERSION=$(grep POPPLER_VERSION "$TEMP_DIR/VERSION" | cut -d'=' -f2)
else
    POPPLER_VERSION="unknown"
fi

echo "Detected poppler version: ${POPPLER_VERSION}"

# Determine output directory name (versioned)
OUTPUT_DIR="packages/pdf-poppler-binaries-linux/lib/linux/poppler-${POPPLER_VERSION}-xvfb"

# Remove old directory if exists
if [ -d "$OUTPUT_DIR" ]; then
    echo "Removing existing $OUTPUT_DIR..."
    rm -rf "$OUTPUT_DIR"
fi

# Create output directory and move files
echo "Creating $OUTPUT_DIR/..."
mkdir -p "$OUTPUT_DIR"
mv "$TEMP_DIR/bin" "$OUTPUT_DIR/"
mv "$TEMP_DIR/lib" "$OUTPUT_DIR/"
mv "$TEMP_DIR/share" "$OUTPUT_DIR/" 2>/dev/null || true
mv "$TEMP_DIR/VERSION" "$OUTPUT_DIR/"

# Clean up temp directory
rm -rf "$TEMP_DIR"

# Verify extraction
echo "Verifying extracted files..."
ls -la "$OUTPUT_DIR/bin/"
echo ""
ls -la "$OUTPUT_DIR/lib/"

# Test the binaries (only on Linux)
if [[ "$(uname -s)" == "Linux" ]]; then
    echo "Testing extracted binaries..."
    export LD_LIBRARY_PATH="$(pwd)/$OUTPUT_DIR/lib"

    echo "Testing pdfinfo..."
    "./$OUTPUT_DIR/bin/pdfinfo" -v || echo "pdfinfo test completed"

    echo "Testing Xvfb..."
    "./$OUTPUT_DIR/bin/Xvfb" -help 2>/dev/null | head -3 || echo "Xvfb test completed"

    echo "Testing xvfb-run script..."
    "./$OUTPUT_DIR/bin/xvfb-run" echo "Hello from virtual display!" || echo "xvfb-run test completed"
else
    echo "Skipping binary tests (not running on Linux)"
fi

echo "Build completed successfully!"
echo "Bundled binaries available at: $OUTPUT_DIR/"
echo ""
echo "Contents:"
echo "   - bin/: poppler binaries + Xvfb + xvfb-run script"
echo "   - lib/: all required shared libraries"
echo "   - VERSION: version information file"
echo ""
echo "You can now use this bundle without any Lambda Layers!"
echo "The library will auto-detect this version based on folder name."
