#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==========================================
# PACKAGE CONFIGURATION
# Set tags for each package:
#   "latest"      - publish as latest only
#   "beta"        - publish as beta only
#   "beta,latest" - publish as both beta and latest
# ==========================================
TAGS_CORE="latest"
TAGS_LINUX="beta"
TAGS_WIN32="beta"
TAGS_DARWIN="beta,latest"
TAGS_AWS2="beta"

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

# Function to publish package with specified tags
# Usage: publish_package <package_dir> <tags>
# tags can be "latest", "beta", or "beta,latest"
publish_package() {
    local pkg_dir=$1
    local tags=$2
    local pkg_name=$(basename "$pkg_dir")

    # First publish with the first tag
    local first_tag=$(echo "$tags" | cut -d',' -f1)
    echo -e "${BLUE}Publishing with tag: $first_tag${NC}"
    npm publish --access public --tag "$first_tag"

    # If there are additional tags, add them
    if [[ "$tags" == *","* ]]; then
        local version=$(grep '"version"' package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
        local second_tag=$(echo "$tags" | cut -d',' -f2)
        echo -e "${BLUE}Adding tag: $second_tag${NC}"
        npm dist-tag add "${pkg_name}@${version}" "$second_tag"
    fi
}

# Show current versions and tags
echo "Package versions and tags to publish:"
echo "  pdf-poppler-core:            $(grep '"version"' packages/pdf-poppler-core/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/') [${TAGS_CORE}]"
echo "  pdf-poppler-binaries-linux:  $(grep '"version"' packages/pdf-poppler-binaries-linux/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/') [${TAGS_LINUX}]"
echo "  pdf-poppler-binaries-win32:  $(grep '"version"' packages/pdf-poppler-binaries-win32/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/') [${TAGS_WIN32}]"
echo "  pdf-poppler-binaries-darwin: $(grep '"version"' packages/pdf-poppler-binaries-darwin/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/') [${TAGS_DARWIN}]"
echo "  pdf-poppler-binaries-aws-2:  $(grep '"version"' packages/pdf-poppler-binaries-aws-2/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/') [${TAGS_AWS2}]"
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
    publish_package "pdf-poppler-binaries-linux" "$TAGS_LINUX"
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
    publish_package "pdf-poppler-binaries-win32" "$TAGS_WIN32"
    echo -e "${GREEN}✓ pdf-poppler-binaries-win32 published!${NC}"
else
    echo -e "${YELLOW}Skipped pdf-poppler-binaries-win32${NC}"
fi
cd ../..

echo ""
echo -e "${BLUE}Step 3: Publishing pdf-poppler-binaries-darwin...${NC}"
cd packages/pdf-poppler-binaries-darwin
npm pack --dry-run
echo ""
read -p "Publish pdf-poppler-binaries-darwin? (yes/no): " confirm_darwin
if [ "$confirm_darwin" = "yes" ]; then
    publish_package "pdf-poppler-binaries-darwin" "$TAGS_DARWIN"
    echo -e "${GREEN}✓ pdf-poppler-binaries-darwin published!${NC}"
else
    echo -e "${YELLOW}Skipped pdf-poppler-binaries-darwin${NC}"
fi
cd ../..

echo ""
echo -e "${BLUE}Step 4: Publishing pdf-poppler-binaries-aws-2...${NC}"
cd packages/pdf-poppler-binaries-aws-2
npm pack --dry-run
echo ""
read -p "Publish pdf-poppler-binaries-aws-2? (yes/no): " confirm_aws2
if [ "$confirm_aws2" = "yes" ]; then
    publish_package "pdf-poppler-binaries-aws-2" "$TAGS_AWS2"
    echo -e "${GREEN}✓ pdf-poppler-binaries-aws-2 published!${NC}"
else
    echo -e "${YELLOW}Skipped pdf-poppler-binaries-aws-2${NC}"
fi
cd ../..

echo ""
echo -e "${BLUE}Step 5: Publishing pdf-poppler-core...${NC}"
cd packages/pdf-poppler-core
npm run build
npm pack --dry-run
echo ""
read -p "Publish pdf-poppler-core? (yes/no): " confirm_core
if [ "$confirm_core" = "yes" ]; then
    publish_package "pdf-poppler-core" "$TAGS_CORE"
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
echo "• https://www.npmjs.com/package/pdf-poppler-binaries-darwin"
echo "• https://www.npmjs.com/package/pdf-poppler-binaries-aws-2"
echo ""
echo "Test installation:"
echo "  mkdir /tmp/test && cd /tmp/test"
echo "  npm install pdf-poppler-core pdf-poppler-binaries-linux   # For Linux"
echo "  npm install pdf-poppler-core pdf-poppler-binaries-darwin  # For macOS"
echo "  npm install pdf-poppler-core pdf-poppler-binaries-aws-2   # For AWS Lambda"
echo ""