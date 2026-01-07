#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Publishing pdf-poppler packages to npm"
echo "=========================================="

# Check if logged in
if ! npm whoami > /dev/null 2>&1; then
    echo -e "${RED}Error: Not logged in to npm${NC}"
    echo "Please run: npm login"
    exit 1
fi

echo -e "${GREEN}✓ Logged in as: $(npm whoami)${NC}"
echo ""

# Show current versions
echo "Package versions to publish:"
echo "  pdf-poppler-core:            $(grep '"version"' packages/pdf-poppler-core/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')"
echo "  pdf-poppler-binaries-linux:  $(grep '"version"' packages/pdf-poppler-binaries-linux/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')"
echo "  pdf-poppler-binaries-win32:  $(grep '"version"' packages/pdf-poppler-binaries-win32/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')"
echo "  pdf-poppler-binaries-aws-2:  $(grep '"version"' packages/pdf-poppler-binaries-aws-2/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')"
echo ""
echo -e "${YELLOW}Note: pdf-poppler-binaries-darwin is not included in this release${NC}"
echo ""

# Confirm before publishing
read -p "Are you sure you want to publish these packages to npm? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Publishing cancelled"
    exit 0
fi

echo ""
echo -e "${BLUE}Step 1: Publishing pdf-poppler-binaries-linux...${NC}"
cd packages/pdf-poppler-binaries-linux
npm pack --dry-run
echo ""
read -p "Publish pdf-poppler-binaries-linux? (yes/no): " confirm_linux
if [ "$confirm_linux" = "yes" ]; then
    npm publish --access public --tag beta
    echo -e "${GREEN}✓ pdf-poppler-binaries-linux published!${NC}"
else
    echo -e "${YELLOW}Skipped pdf-poppler-binaries-linux${NC}"
fi
cd ../..

echo ""
echo -e "${BLUE}Step 2: Publishing pdf-poppler-binaries-win32...${NC}"
cd packages/pdf-poppler-binaries-win32
npm pack --dry-run
echo ""
read -p "Publish pdf-poppler-binaries-win32? (yes/no): " confirm_win32
if [ "$confirm_win32" = "yes" ]; then
    npm publish --access public --tag beta
    echo -e "${GREEN}✓ pdf-poppler-binaries-win32 published!${NC}"
else
    echo -e "${YELLOW}Skipped pdf-poppler-binaries-win32${NC}"
fi
cd ../..

echo ""
echo -e "${BLUE}Step 3: Publishing pdf-poppler-binaries-aws-2...${NC}"
cd packages/pdf-poppler-binaries-aws-2
npm pack --dry-run
echo ""
read -p "Publish pdf-poppler-binaries-aws-2? (yes/no): " confirm_aws2
if [ "$confirm_aws2" = "yes" ]; then
    npm publish --access public --tag beta
    echo -e "${GREEN}✓ pdf-poppler-binaries-aws-2 published!${NC}"
else
    echo -e "${YELLOW}Skipped pdf-poppler-binaries-aws-2${NC}"
fi
cd ../..

echo ""
echo -e "${BLUE}Step 4: Publishing pdf-poppler-core...${NC}"
cd packages/pdf-poppler-core
npm run build
npm pack --dry-run
echo ""
read -p "Publish pdf-poppler-core? (yes/no): " confirm_core
if [ "$confirm_core" = "yes" ]; then
    npm publish --access public --tag beta
    echo -e "${GREEN}✓ pdf-poppler-core published!${NC}"
else
    echo -e "${YELLOW}Skipped pdf-poppler-core${NC}"
fi
cd ../..

echo ""
echo -e "${GREEN}=========================================="
echo "Publishing complete!"
echo "==========================================${NC}"
echo ""
echo "Verify on npm:"
echo "• https://www.npmjs.com/package/pdf-poppler-core"
echo "• https://www.npmjs.com/package/pdf-poppler-binaries-linux"
echo "• https://www.npmjs.com/package/pdf-poppler-binaries-win32"
echo "• https://www.npmjs.com/package/pdf-poppler-binaries-aws-2"
echo ""
echo "Test installation:"
echo "  mkdir /tmp/test && cd /tmp/test"
echo "  npm install pdf-poppler-core pdf-poppler-binaries-linux  # For Linux"
echo "  npm install pdf-poppler-core pdf-poppler-binaries-aws-2  # For AWS Lambda"
echo ""
