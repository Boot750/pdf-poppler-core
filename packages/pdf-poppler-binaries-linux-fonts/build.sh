#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building pdf-poppler-binaries-linux-fonts..."

# Build the Docker image
docker build -f Dockerfile.build -t pdf-poppler-fonts-builder .

# Create lib directory if not exists
mkdir -p lib

# Extract the built files
docker run --rm -v "$SCRIPT_DIR/lib:/export" pdf-poppler-fonts-builder

echo ""
echo "Build complete! Files extracted to lib/"
ls -la lib/
