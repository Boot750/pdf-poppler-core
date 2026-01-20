#!/bin/bash

# Build script for AWS Lambda (Amazon Linux 2) compatible poppler binaries
# This creates binaries compatible with GLIBC 2.26
#
# Usage: Run from repository root:
#   ./scripts/build/build-aws-2.sh

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Building poppler binaries for AWS Lambda (Amazon Linux 2)..."
echo "Repository root: $REPO_ROOT"

# Change to repo root for correct output paths
cd "$REPO_ROOT"

# Build the Docker image using Amazon Linux 2 base
echo "Building Docker image with Amazon Linux 2..."
docker build -t poppler-aws2-builder -f "$SCRIPT_DIR/get-poppler-aws-2.dockerfile" .

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
TEMP_TAR="$TEMP_DIR/poppler-aws2.tar.gz"

# Run container and extract binaries to temp location
echo "Extracting binaries..."
docker run --rm poppler-aws2-builder > "$TEMP_TAR"

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

# Determine output directory
OUTPUT_DIR="packages/pdf-poppler-binaries-aws-2/lib/aws-2/poppler-${POPPLER_VERSION}-xvfb"

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

# Fix line endings for shell scripts (Windows extraction may add CRLF)
echo "Fixing line endings for shell scripts..."
if [ -f "$OUTPUT_DIR/bin/xvfb-run" ]; then
    sed -i 's/\r$//' "$OUTPUT_DIR/bin/xvfb-run"
    chmod +x "$OUTPUT_DIR/bin/xvfb-run"
fi

# Verify extraction
echo "Verifying extracted files..."
ls -la "$OUTPUT_DIR/bin/"
echo ""
ls -la "$OUTPUT_DIR/lib/" | head -20

# Test the binaries (only on Linux)
if [[ "$(uname -s)" == "Linux" ]]; then
    echo "Testing extracted binaries..."
    export LD_LIBRARY_PATH="$(pwd)/$OUTPUT_DIR/lib"

    echo "Testing pdfinfo..."
    "./$OUTPUT_DIR/bin/pdfinfo" -v || echo "pdfinfo test completed"

    echo "Testing Xvfb..."
    "./$OUTPUT_DIR/bin/Xvfb" -help 2>/dev/null | head -3 || echo "Xvfb test completed"
else
    echo "Skipping binary tests (not running on Linux)"
fi

echo ""
echo "Build completed successfully!"
echo "AWS Lambda compatible binaries available at: $OUTPUT_DIR/"
echo ""
echo "This package is compatible with:"
echo "  - AWS Lambda (all Node.js runtimes)"
echo "  - Amazon Linux 2"
echo "  - Any Linux with GLIBC 2.26+"
