#!/bin/bash
set -e

echo "=========================================="
echo "Setting up pdf-poppler packages for testing"
echo "=========================================="

# Colors for output
GREEN='\033[0.32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect platform
PLATFORM=$(uname -s)
echo -e "${BLUE}Detected platform: $PLATFORM${NC}"

# Determine which binary package to link based on platform
if [[ "$PLATFORM" == "Linux" ]]; then
    BINARY_PACKAGE="pdf-poppler-binaries-linux"
elif [[ "$PLATFORM" == "Darwin" ]]; then
    BINARY_PACKAGE="pdf-poppler-binaries-darwin"
elif [[ "$PLATFORM" == MINGW* ]] || [[ "$PLATFORM" == MSYS* ]] || [[ "$PLATFORM" == CYGWIN* ]]; then
    BINARY_PACKAGE="pdf-poppler-binaries-win32"
else
    echo "Unknown platform: $PLATFORM"
    exit 1
fi

echo -e "${BLUE}Using binary package: $BINARY_PACKAGE${NC}"

# Step 1: Build and link pdf-poppler-core
echo ""
echo -e "${GREEN}Step 1: Building pdf-poppler-core...${NC}"
cd packages/pdf-poppler-core
npm install
npm run build
npm link
cd ../..

# Step 2: Link the platform-specific binary package
echo ""
echo -e "${GREEN}Step 2: Linking $BINARY_PACKAGE...${NC}"
cd packages/$BINARY_PACKAGE
npm link
cd ../..

# Step 3: Link both packages to root for testing
echo ""
echo -e "${GREEN}Step 3: Linking packages to root project...${NC}"
npm link pdf-poppler-core $BINARY_PACKAGE

echo ""
echo -e "${GREEN}=========================================="
echo "Setup complete!"
echo "==========================================${NC}"
echo ""
echo "You can now run tests with:"
echo "  npm test"
echo ""
echo "To unlink packages:"
echo "  npm unlink pdf-poppler-core $BINARY_PACKAGE"
echo ""
