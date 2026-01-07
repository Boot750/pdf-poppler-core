# pdf-poppler-core

Convert PDF files into images using Poppler with promises. It achieves 10x faster performance compared to other PDF converters.

This is the core wrapper package that requires platform-specific binary packages to be installed separately.

## Installation

You need to install both the core package and the platform-specific binary package:

### For Linux (Production)

```bash
npm install pdf-poppler-core pdf-poppler-binaries-linux
```

### For Windows (Development/Production)

```bash
npm install pdf-poppler-core pdf-poppler-binaries-win32
```

### For macOS (Development/Production)

```bash
npm install pdf-poppler-core pdf-poppler-binaries-darwin
```

### Mixed Environment (e.g., Windows dev, Linux production)

```bash
# Install Linux binaries for production
npm install pdf-poppler-core pdf-poppler-binaries-linux

# Install Windows binaries for local development
npm install --save-dev pdf-poppler-binaries-win32
```

Both packages will be available during development, but only the Linux binaries will be deployed to production.

## Usage

### Get PDF info

```javascript
const pdf = require('pdf-poppler-core');

let file = 'C:\\tmp\\convertme.pdf'

pdf.info(file)
    .then(pdfinfo => {
        console.log(pdfinfo);
    });
```

### Convert PDF into image

```javascript
const path = require('path');
const pdf = require('pdf-poppler-core');

let file = 'C:\\tmp\\convertme.pdf'

let opts = {
    format: 'jpeg',
    out_dir: path.dirname(file),
    out_prefix: path.basename(file, path.extname(file)),
    page: null
}

pdf.convert(file, opts)
    .then(res => {
        console.log('Successfully converted');
    })
    .catch(error => {
        console.error(error);
    })
```

### TypeScript Support

This package is written in TypeScript and includes type definitions.

```typescript
import { info, convert } from 'pdf-poppler-core';

const pdfPath = './document.pdf';

info(pdfPath).then(pdfInfo => {
    console.log(pdfInfo);
});
```

## Custom Binary Configuration

You can use your own Poppler binaries instead of the bundled packages. This is useful for:
- Using system-installed Poppler
- Using a custom-compiled version
- Supporting platforms not covered by the bundled packages

### Using a Custom Binary Path

Set the `POPPLER_BINARY_PATH` environment variable to point directly to the folder containing Poppler executables:

```bash
# Linux/macOS
export POPPLER_BINARY_PATH=/usr/local/bin
node app.js

# Windows
set POPPLER_BINARY_PATH=C:\poppler\bin
node app.js
```

The folder should contain executables like `pdfinfo`, `pdftocairo`, `pdfimages` (or `.exe` versions on Windows).

### Using a Custom Binary Package

Set the `POPPLER_BINARY_PACKAGE` environment variable to use a different npm package:

```bash
export POPPLER_BINARY_PACKAGE=my-custom-poppler-binaries
node app.js
```

The custom package should export a `getBinaryPath()` function that returns the path to the binaries.

### Checking Configuration

You can check if custom binaries are being used:

```javascript
const pdf = require('pdf-poppler-core');

console.log('Binary path:', pdf.path);
console.log('Using custom binaries:', pdf.isCustomBinaries);
```

## Platform Support

- **Linux** (x64) - Including AWS Lambda
- **Windows** (x64)
- **macOS** (x64)
- **Other platforms** - Supported via custom binary configuration

## AWS Lambda Support

This package works in AWS Lambda environments. The Linux binaries include support for headless environments with bundled Xvfb.

## Electron Support

The package automatically handles Electron ASAR unpacking for the binaries.

## License

ISC

## Related Packages

- [pdf-poppler-binaries-linux](https://npmjs.com/package/pdf-poppler-binaries-linux) - Linux binaries
- [pdf-poppler-binaries-win32](https://npmjs.com/package/pdf-poppler-binaries-win32) - Windows binaries
- [pdf-poppler-binaries-darwin](https://npmjs.com/package/pdf-poppler-binaries-darwin) - macOS binaries
