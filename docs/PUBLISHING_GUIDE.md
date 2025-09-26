# Publishing Guide: pdf-poppler Packages

## Overview

You'll publish **2 packages** to npm:
1. `pdf-poppler-binaries-linux` - Linux binaries (publish first)
2. `pdf-poppler-core` - Core wrapper (publish second)

## Prerequisites

### 1. npm Account Setup

```bash
# If you don't have an npm account, create one at https://www.npmjs.com/signup

# Login to npm
npm login

# Verify you're logged in
npm whoami
```

### 2. Verify Package Names Are Available

```bash
# Check if package names are available
npm view pdf-poppler-core
npm view pdf-poppler-binaries-linux

# If they show "npm ERR! 404", they're available!
# If they exist, you'll need to either:
# - Use a different name (e.g., @yourname/pdf-poppler-core)
# - Or request ownership if they're abandoned
```

## Step-by-Step Publishing Process

### Phase 1: Prepare Packages

#### 1.1 Add LICENSE Files

```bash
# Copy LICENSE to all packages
cp LICENSE packages/pdf-poppler-core/
cp LICENSE packages/pdf-poppler-binaries-linux/
```

#### 1.2 Create .npmignore Files

**For `pdf-poppler-core/.npmignore`:**
```bash
cat > packages/pdf-poppler-core/.npmignore << 'EOF'
# Source files (we ship dist/ instead)
src/
tsconfig.json
*.test.ts
*.test.js

# Development files
node_modules/
.git/
.github/
*.log
npm-debug.log*

# Build artifacts
coverage/
.nyc_output/

# Documentation (except README)
*.md
!README.md

# IDE
.vscode/
.idea/
*.swp
EOF
```

**For `pdf-poppler-binaries-linux/.npmignore`:**
```bash
cat > packages/pdf-poppler-binaries-linux/.npmignore << 'EOF'
# Development files
node_modules/
.git/
.github/
*.log
npm-debug.log*

# Documentation (except README)
*.md
!README.md

# Compressed archives (ship extracted files only)
*.tar.gz
*.zip

# IDE
.vscode/
.idea/
*.swp
EOF
```

#### 1.3 Build Core Package

```bash
cd packages/pdf-poppler-core
npm install
npm run build

# Verify dist/ directory is created
ls -la dist/

# Should see:
# - index.js
# - index.d.ts
# - lib/

cd ../..
```

#### 1.4 Review Package Contents

```bash
# See what will be published (dry run)
cd packages/pdf-poppler-binaries-linux
npm pack --dry-run

cd ../pdf-poppler-core
npm pack --dry-run

cd ../..
```

### Phase 2: Version Management

#### 2.1 Decide on Version Number

Following semantic versioning (semver):
- `1.0.0` - First stable release
- `0.1.0` - Beta/pre-release
- `1.0.0-beta.1` - Beta with identifier

**Recommendation:** Start with `1.0.0` since this is a major restructure.

#### 2.2 Update package.json Versions

Both packages should have the same version:

```bash
# Edit these files:
# packages/pdf-poppler-core/package.json - Update "version": "1.0.0"
# packages/pdf-poppler-binaries-linux/package.json - Update "version": "1.0.0"
```

### Phase 3: Final Testing

#### 3.1 Local Testing with npm link

```bash
# Link packages locally
npm run setup:test

# Run all tests
npm test

# Verify all tests pass (except skipped Windows/macOS)
```

#### 3.2 Test Clean Install

```bash
# Create a test directory
mkdir /tmp/test-pdf-poppler
cd /tmp/test-pdf-poppler
npm init -y

# Link your local packages
npm link ../../path/to/pdf-poppler/packages/pdf-poppler-core
npm link ../../path/to/pdf-poppler/packages/pdf-poppler-binaries-linux

# Test the API
cat > test.js << 'EOF'
const poppler = require('pdf-poppler-core');
console.log('Poppler path:', poppler.path);
console.log('Exports:', Object.keys(poppler));
EOF

node test.js

# Clean up
cd -
rm -rf /tmp/test-pdf-poppler
```

### Phase 4: Publishing

#### 4.1 Publish Linux Binaries First

```bash
cd packages/pdf-poppler-binaries-linux

# Final check
npm pack --dry-run

# Publish (this is it!)
npm publish

# If successful, you'll see:
# + pdf-poppler-binaries-linux@1.0.0

cd ../..
```

#### 4.2 Publish Core Package Second

```bash
cd packages/pdf-poppler-core

# Final check
npm pack --dry-run

# Build one more time to be sure
npm run build

# Publish
npm publish

# If successful, you'll see:
# + pdf-poppler-core@1.0.0

cd ../..
```

### Phase 5: Verify Published Packages

#### 5.1 Check on npm Registry

```bash
# View published packages
npm view pdf-poppler-binaries-linux
npm view pdf-poppler-core

# Check on website
# https://www.npmjs.com/package/pdf-poppler-binaries-linux
# https://www.npmjs.com/package/pdf-poppler-core
```

#### 5.2 Test Installation from npm

```bash
# Create a fresh test directory
mkdir /tmp/test-npm-install
cd /tmp/test-npm-install
npm init -y

# Install from npm (not locally linked)
npm install pdf-poppler-core pdf-poppler-binaries-linux

# Create test file
cat > test.js << 'EOF'
const poppler = require('pdf-poppler-core');
console.log('✓ Package loaded successfully');
console.log('Platform:', process.platform);
console.log('Poppler path:', poppler.path);

// Test basic functionality (if you have a PDF)
// poppler.info('test.pdf').then(console.log);
EOF

node test.js

# Clean up
cd -
rm -rf /tmp/test-npm-install
```

### Phase 6: Post-Publishing

#### 6.1 Tag Release in Git

```bash
# Create git tags
git tag -a v1.0.0 -m "Release v1.0.0: Restructured packages"
git push origin v1.0.0
```

#### 6.2 Update Main Repository README

Update the main README.md with new installation instructions:

```markdown
## Installation

### For Linux (Production)
\`\`\`bash
npm install pdf-poppler-core pdf-poppler-binaries-linux
\`\`\`

### For Windows/Linux Mixed Environment
\`\`\`bash
# Production dependencies
npm install pdf-poppler-core pdf-poppler-binaries-linux

# Development dependencies
npm install --save-dev pdf-poppler-binaries-win32
\`\`\`

## Usage

\`\`\`javascript
const pdf = require('pdf-poppler-core');

// Get PDF info
pdf.info('document.pdf').then(info => {
  console.log(info);
});

// Convert to images
const options = {
  format: 'png',
  out_dir: './output',
  out_prefix: 'page'
};

pdf.convert('document.pdf', options).then(() => {
  console.log('Converted!');
});
\`\`\`
```

## Troubleshooting

### Issue: "You do not have permission to publish"

**Solution:** The package name might be taken. Options:
1. Use a scoped package: `@yourname/pdf-poppler-core`
2. Choose a different name
3. Request ownership if package is abandoned

### Issue: "Package size too large"

**Solution:**
```bash
# Check package size
cd packages/pdf-poppler-binaries-linux
npm pack
ls -lh pdf-poppler-binaries-linux-*.tgz

# If over 100MB, you might need to:
# 1. Remove unnecessary files via .npmignore
# 2. Compress binaries
# 3. Consider npm publish --access public for larger packages
```

### Issue: "Missing required field"

**Solution:** Verify package.json has:
- `name`
- `version`
- `main` (for core package)
- `files` array
- `license`

### Issue: Build fails during publish

**Solution:**
```bash
# Make sure prepublishOnly script works
cd packages/pdf-poppler-core
npm run prepublishOnly

# Or disable it temporarily
# Remove "prepublishOnly" from scripts in package.json
```

## Update Strategy for Future Releases

### Patch Release (1.0.x) - Bug fixes

```bash
# Update version
cd packages/pdf-poppler-core
npm version patch  # 1.0.0 → 1.0.1
npm publish

cd ../pdf-poppler-binaries-linux
npm version patch
npm publish
```

### Minor Release (1.x.0) - New features

```bash
cd packages/pdf-poppler-core
npm version minor  # 1.0.0 → 1.1.0
npm publish

cd ../pdf-poppler-binaries-linux
npm version minor
npm publish
```

### Major Release (x.0.0) - Breaking changes

```bash
cd packages/pdf-poppler-core
npm version major  # 1.0.0 → 2.0.0
npm publish

cd ../pdf-poppler-binaries-linux
npm version major
npm publish
```

## Best Practices

1. **Always publish binaries before core** - Core depends on binaries
2. **Keep versions in sync** - All packages should have same version
3. **Test before publishing** - Use `npm pack --dry-run`
4. **Use git tags** - Tag releases for easy rollback
5. **Update changelog** - Document changes for users
6. **Monitor downloads** - Check npm stats periodically

## Security Considerations

1. **Enable 2FA on npm account** - Highly recommended
   ```bash
   npm profile enable-2fa auth-and-writes
   ```

2. **Use npm tokens for CI/CD** - Don't commit credentials
   ```bash
   # Create automation token
   npm token create --read-only
   ```

3. **Review dependencies** - Run security audit
   ```bash
   npm audit
   ```

## Checklist

Before publishing, verify:

- [ ] npm login successful (`npm whoami`)
- [ ] Package names available
- [ ] LICENSE files added
- [ ] .npmignore files created
- [ ] package.json versions updated
- [ ] Core package builds successfully
- [ ] Tests pass
- [ ] Dry run looks good (`npm pack --dry-run`)
- [ ] Binaries published first
- [ ] Core published second
- [ ] Installation from npm works
- [ ] README updated
- [ ] Git tagged
- [ ] GitHub release created

## Need Help?

- [npm Documentation](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [npm Publishing Guide](https://docs.npmjs.com/cli/v8/commands/npm-publish)
