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

## Platform Support

- **Linux** (x64) - Including AWS Lambda
- **Windows** (x64)
- **macOS** (x64)

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
