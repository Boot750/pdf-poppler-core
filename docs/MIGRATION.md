# Migration Guide: Restructured pdf-poppler Packages

## Overview

The `pdf-poppler` library has been restructured into **4 separate npm packages**:

1. **pdf-poppler-core** - Core wrapper (TypeScript)
2. **pdf-poppler-binaries-linux** - Linux binaries
3. **pdf-poppler-binaries-win32** - Windows binaries
4. **pdf-poppler-binaries-darwin** - macOS binaries

## Why This Change?

- **Smaller installs**: Download only the binaries you need
- **Flexible deployment**: Different binaries for dev vs production
- **Better CI/CD**: Install only platform-specific binaries
- **Cleaner separation**: Core logic separate from platform binaries

## Package Structure

```
packages/
├── pdf-poppler-core/
│   ├── src/
│   │   ├── index.ts
│   │   └── lib/
│   │       ├── convert.js
│   │       ├── imgdata.js
│   │       └── info.js
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── pdf-poppler-binaries-linux/
│   ├── lib/
│   │   └── linux/
│   │       ├── poppler-X.XX/        # Versioned (e.g., poppler-0.26)
│   │       └── poppler-X.XX-xvfb/   # Versioned with Xvfb (e.g., poppler-0.26-xvfb)
│   ├── index.js
│   ├── package.json
│   └── README.md
│
├── pdf-poppler-binaries-win32/
│   ├── lib/
│   │   └── win/
│   │       └── poppler-0.51/
│   ├── index.js
│   ├── package.json
│   └── README.md
│
└── pdf-poppler-binaries-darwin/
    ├── lib/
    │   └── osx/
    │       └── poppler-0.66/
    ├── index.js
    ├── package.json
    └── README.md
```

## Installation Examples

### 1. Linux Production Environment

```bash
npm install pdf-poppler-core pdf-poppler-binaries-linux
```

**package.json:**
```json
{
  "dependencies": {
    "pdf-poppler-core": "^1.0.0",
    "pdf-poppler-binaries-linux": "^1.0.0"
  }
}
```

### 2. Windows Development Environment

```bash
npm install pdf-poppler-core pdf-poppler-binaries-win32
```

**package.json:**
```json
{
  "dependencies": {
    "pdf-poppler-core": "^1.0.0",
    "pdf-poppler-binaries-win32": "^1.0.0"
  }
}
```

### 3. Mixed Environment (Windows Dev, Linux Production)

This is your specific use case!

```bash
# Install core and Linux binaries for production
npm install pdf-poppler-core pdf-poppler-binaries-linux

# Install Windows binaries for local development only
npm install --save-dev pdf-poppler-binaries-win32
```

**package.json:**
```json
{
  "dependencies": {
    "pdf-poppler-core": "^1.0.0",
    "pdf-poppler-binaries-linux": "^1.0.0"
  },
  "devDependencies": {
    "pdf-poppler-binaries-win32": "^1.0.0"
  }
}
```

**How it works:**
- During `npm install`, both packages are installed (deps + devDeps)
- In production (e.g., Docker, AWS Lambda), only `dependencies` are installed
- The core package will automatically use the correct binaries for the current platform

### 4. macOS Development Environment

```bash
npm install pdf-poppler-core pdf-poppler-binaries-darwin
```

**package.json:**
```json
{
  "dependencies": {
    "pdf-poppler-core": "^1.0.0",
    "pdf-poppler-binaries-darwin": "^1.0.0"
  }
}
```

## Code Changes

### Before (Old API)

```javascript
const pdf = require('pdf-poppler');

pdf.info(file).then(info => console.log(info));
pdf.convert(file, opts).then(() => console.log('Done'));
```

### After (New API)

```javascript
const pdf = require('pdf-poppler-core');

pdf.info(file).then(info => console.log(info));
pdf.convert(file, opts).then(() => console.log('Done'));
```

**That's it!** Just change the package name from `pdf-poppler` to `pdf-poppler-core`.

### TypeScript Support

The new core package is written in TypeScript:

```typescript
import { info, convert } from 'pdf-poppler-core';

const pdfPath = './document.pdf';

info(pdfPath).then(pdfInfo => {
    console.log(pdfInfo);
});
```

## Publishing Workflow

### 1. Build Core Package

```bash
cd packages/pdf-poppler-core
npm install
npm run build
npm publish
```

### 2. Publish Binary Packages

```bash
# Linux
cd packages/pdf-poppler-binaries-linux
npm publish

# Windows
cd packages/pdf-poppler-binaries-win32
npm publish

# macOS
cd packages/pdf-poppler-binaries-darwin
npm publish
```

## Docker Example

**Dockerfile:**
```dockerfile
FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies (Linux binaries)
RUN npm ci --only=production

COPY . .

CMD ["node", "index.js"]
```

**package.json:**
```json
{
  "dependencies": {
    "pdf-poppler-core": "^1.0.0",
    "pdf-poppler-binaries-linux": "^1.0.0"
  }
}
```

## AWS Lambda Example

**package.json:**
```json
{
  "dependencies": {
    "pdf-poppler-core": "^1.0.0",
    "pdf-poppler-binaries-linux": "^1.0.0"
  }
}
```

The Linux binaries include Xvfb support for headless environments, which is automatically detected in Lambda.

## Version Configuration

You can control which poppler version is used via environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `POPPLER_VERSION` | Select specific version (e.g., `0.26`) | Auto-detect highest |
| `POPPLER_PREFER_XVFB` | Prefer Xvfb variant (`true`/`false`) | `true` in Lambda |

**Example:**
```bash
# Use specific version
POPPLER_VERSION=0.26 node app.js

# Prefer non-xvfb variant
POPPLER_PREFER_XVFB=false node app.js
```

**Programmatic version discovery:**
```javascript
const poppler = require('pdf-poppler-core');

// Get current version
console.log('Using version:', poppler.version);

// List all available versions
const versions = poppler.getAvailableVersions();
console.log('Available:', versions);
```

## CI/CD Example (GitHub Actions)

**.github/workflows/deploy.yml:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci --only=production

      - name: Deploy
        run: npm run deploy
```

Only Linux binaries will be installed in the CI environment.

## Testing Locally

### Option 1: Using npm link

```bash
# In each package directory
cd packages/pdf-poppler-core
npm link

cd ../pdf-poppler-binaries-linux
npm link

cd ../pdf-poppler-binaries-win32
npm link

cd ../pdf-poppler-binaries-darwin
npm link

# In your test project
npm link pdf-poppler-core pdf-poppler-binaries-win32
```

### Option 2: Using local file paths

**package.json:**
```json
{
  "dependencies": {
    "pdf-poppler-core": "file:../pdf-poppler/packages/pdf-poppler-core",
    "pdf-poppler-binaries-linux": "file:../pdf-poppler/packages/pdf-poppler-binaries-linux"
  },
  "devDependencies": {
    "pdf-poppler-binaries-win32": "file:../pdf-poppler/packages/pdf-poppler-binaries-win32"
  }
}
```

## Troubleshooting

### Error: Binary package not found

**Error:**
```
Binary package 'pdf-poppler-binaries-linux' not found.
Please install it using: npm install pdf-poppler-binaries-linux
```

**Solution:** Install the appropriate binary package for your platform.

### Wrong binaries installed

If you're on Linux but have Windows binaries installed, the core package will show an error. Make sure to install the correct binary package for your platform.

### TypeScript compilation errors

Make sure to build the TypeScript files:

```bash
cd packages/pdf-poppler-core
npm run build
```

## Version Management

All packages should be versioned together:

- `pdf-poppler-core@1.0.0`
- `pdf-poppler-binaries-linux@1.0.0`
- `pdf-poppler-binaries-win32@1.0.0`
- `pdf-poppler-binaries-darwin@1.0.0`

When releasing a new version, update all packages to maintain consistency.

## Support

For issues or questions:
- Open an issue on GitHub
- Check the README files in each package
- Review this migration guide

## License

All packages maintain the ISC license.
