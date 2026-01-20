#!/bin/bash
#
# Package macOS SDK for use with osxcross
# Run this script on a Mac with Xcode installed
#
# Usage: ./package-macos-sdk.sh [SDK_VERSION]
# Example: ./package-macos-sdk.sh 14.0
#

set -e

SDK_VERSION="${1:-14.0}"
XCODE_PATH=$(xcode-select -p)
SDK_PATH="${XCODE_PATH}/Platforms/MacOSX.platform/Developer/SDKs/MacOSX${SDK_VERSION}.sdk"

if [ ! -d "$SDK_PATH" ]; then
    echo "Error: SDK not found at $SDK_PATH"
    echo ""
    echo "Available SDKs:"
    ls -la "${XCODE_PATH}/Platforms/MacOSX.platform/Developer/SDKs/"
    exit 1
fi

OUTPUT_FILE="MacOSX${SDK_VERSION}.sdk.tar.xz"

echo "Packaging macOS SDK ${SDK_VERSION}..."
echo "Source: $SDK_PATH"
echo "Output: $OUTPUT_FILE"

# Create tarball
cd "$(dirname "$SDK_PATH")"
tar -cJf "/tmp/${OUTPUT_FILE}" "MacOSX${SDK_VERSION}.sdk"
mv "/tmp/${OUTPUT_FILE}" "$(pwd)/${OUTPUT_FILE}"

echo ""
echo "Done! SDK packaged to: $(pwd)/${OUTPUT_FILE}"
echo ""
echo "Copy this file to the scripts/ directory and build with:"
echo "  cd scripts"
echo "  docker build -f Dockerfile.darwin -t poppler-darwin-builder ."
echo "  docker run --rm -v \$(pwd)/output:/artifacts poppler-darwin-builder"
