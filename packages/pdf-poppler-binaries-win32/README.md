# pdf-poppler-binaries-win32

Windows binaries for [pdf-poppler-core](https://npmjs.com/package/pdf-poppler-core).

This package contains pre-compiled Poppler utilities for Windows (x64).

## Installation

```bash
npm install pdf-poppler-core pdf-poppler-binaries-win32
```

## Usage

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

// Create instance (auto-detects platform)
const poppler = new PdfPoppler();

// Get PDF info
const info = await poppler.info('document.pdf');
console.log('Pages:', info.pages);

// Convert to images
await poppler.convert('document.pdf', {
    format: 'png',
    out_dir: './output',
    out_prefix: 'page'
});
```

## What's Included

- Poppler utilities compiled for Windows x64
- All required DLLs

## Mixed Development Environment

For Windows development with Linux production:

```bash
# Production (Linux)
npm install pdf-poppler-core pdf-poppler-binaries-linux

# Development (Windows)
npm install --save-dev pdf-poppler-binaries-win32
```

The correct binaries are automatically selected based on the platform.

## System Requirements

- Windows x64
- No additional system dependencies required

## License

ISC

## Related Packages

- [pdf-poppler-core](https://npmjs.com/package/pdf-poppler-core) - Core wrapper (required)
- [pdf-poppler-binaries-linux](https://npmjs.com/package/pdf-poppler-binaries-linux) - Linux binaries
- [pdf-poppler-binaries-darwin](https://npmjs.com/package/pdf-poppler-binaries-darwin) - macOS binaries
- [pdf-poppler-binaries-aws-2](https://npmjs.com/package/pdf-poppler-binaries-aws-2) - AWS Lambda binaries
