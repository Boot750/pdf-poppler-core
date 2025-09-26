#!/bin/bash
set -e

echo "=========================================="
echo "Preparing packages for publishing"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}Step 1: Copying LICENSE files...${NC}"
cp LICENSE packages/pdf-poppler-core/ 2>/dev/null || echo "LICENSE already exists in core"
cp LICENSE packages/pdf-poppler-binaries-linux/ 2>/dev/null || echo "LICENSE already exists in linux"
cp LICENSE packages/pdf-poppler-binaries-win32/ 2>/dev/null || echo "LICENSE already exists in win32"
echo -e "${GREEN}✓ LICENSE files copied${NC}"

echo ""
echo -e "${BLUE}Step 2: Creating .npmignore files...${NC}"

# Core package .npmignore
cat > packages/pdf-poppler-core/.npmignore << 'EOF'
# Source files (we ship dist/ instead)
src/
tsconfig.json
*.test.ts
*.test.js

# Development
node_modules/
coverage/
.nyc_output/

# Docs (except README)
*.md
!README.md

# IDE
.vscode/
.idea/
EOF

# Binary packages .npmignore (same for all platforms)
for pkg in linux win32; do
cat > packages/pdf-poppler-binaries-$pkg/.npmignore << 'EOF'
# Development
node_modules/

# Docs (except README)
*.md
!README.md

# Archives (ship extracted only)
*.tar.gz
*.zip

# IDE
.vscode/
.idea/
EOF
done

echo -e "${GREEN}✓ .npmignore files created${NC}"

echo ""
echo -e "${BLUE}Step 3: Building core package...${NC}"
cd packages/pdf-poppler-core
npm install
npm run build
cd ../..
echo -e "${GREEN}✓ Core package built${NC}"

echo ""
echo -e "${BLUE}Step 4: Checking package contents...${NC}"

echo ""
echo -e "${YELLOW}=== pdf-poppler-core ===${NC}"
cd packages/pdf-poppler-core
npm pack --dry-run 2>&1 | head -30
cd ../..

echo ""
echo -e "${YELLOW}=== pdf-poppler-binaries-linux ===${NC}"
cd packages/pdf-poppler-binaries-linux
npm pack --dry-run 2>&1 | head -30
cd ../..

echo ""
echo -e "${YELLOW}=== pdf-poppler-binaries-win32 ===${NC}"
cd packages/pdf-poppler-binaries-win32
npm pack --dry-run 2>&1 | head -30
cd ../..

echo ""
echo -e "${GREEN}=========================================="
echo "Preparation complete!"
echo "==========================================${NC}"
echo ""
echo "Package versions:"
echo "  pdf-poppler-core:            $(grep '"version"' packages/pdf-poppler-core/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')"
echo "  pdf-poppler-binaries-linux:  $(grep '"version"' packages/pdf-poppler-binaries-linux/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')"
echo "  pdf-poppler-binaries-win32:  $(grep '"version"' packages/pdf-poppler-binaries-win32/package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')"
echo ""
echo -e "${YELLOW}Note: pdf-poppler-binaries-darwin is not included in this release${NC}"
echo ""
echo "Next steps:"
echo "1. Review package contents above"
echo "2. Update versions in package.json files if needed"
echo "3. Run: npm login"
echo "4. Run: bash scripts/publish-packages.sh"
echo ""
