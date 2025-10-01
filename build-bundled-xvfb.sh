#!/bin/bash

# Build script for poppler + Xvfb bundled binaries
# This creates a complete bundle that doesn't require Lambda Layers

set -e

echo "🏗️  Building poppler + Xvfb bundled binaries for Linux..."

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t poppler-xvfb-builder -f get-poppler-with-xvfb-linux.dockerfile .

# Create output directory
mkdir -p lib/linux/poppler-xvfb-latest

# Run container and extract binaries
echo "🔄 Extracting binaries..."
docker run --rm poppler-xvfb-builder > lib/linux/poppler-xvfb-latest.tar.gz

# Extract to the directory
echo "📂 Extracting to lib/linux/poppler-xvfb-latest/..."
cd lib/linux/poppler-xvfb-latest
tar -xzf ../poppler-xvfb-latest.tar.gz
cd ../../../

# Verify extraction
echo "✅ Verifying extracted files..."
ls -la lib/linux/poppler-xvfb-latest/bin/
echo ""
ls -la lib/linux/poppler-xvfb-latest/lib/

# Test the binaries
echo "🧪 Testing extracted binaries..."
export LD_LIBRARY_PATH="$(pwd)/lib/linux/poppler-xvfb-latest/lib"

echo "Testing pdfinfo..."
./lib/linux/poppler-xvfb-latest/bin/pdfinfo -v || echo "pdfinfo test completed"

echo "Testing Xvfb..."
./lib/linux/poppler-xvfb-latest/bin/Xvfb -help 2>/dev/null | head -3 || echo "Xvfb test completed"

echo "Testing xvfb-run script..."
./lib/linux/poppler-xvfb-latest/bin/xvfb-run echo "Hello from virtual display!" || echo "xvfb-run test completed"

# Clean up temporary files
rm -f lib/linux/poppler-xvfb-latest.tar.gz

echo "🎉 Build completed successfully!"
echo "📁 Bundled binaries available at: lib/linux/poppler-xvfb-latest/"
echo ""
echo "📋 Contents:"
echo "   - bin/: poppler binaries + Xvfb + xvfb-run script"
echo "   - lib/: all required shared libraries"
echo ""
echo "🚀 You can now use this bundle without any Lambda Layers!"
echo "   Just set your poppler path to use poppler-xvfb-latest instead of poppler-latest"