# pdf-poppler-binaries-linux

Linux binaries for [pdf-poppler-core](https://npmjs.com/package/pdf-poppler-core).

This package contains pre-compiled Poppler utilities for Linux (x64).

## Installation

```bash
npm install pdf-poppler-core pdf-poppler-binaries-linux
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

- Poppler utilities compiled for Linux x64
- Optional Xvfb support for headless environments
- All required shared libraries

## Headless Environments

For Docker, CI/CD, or other headless environments:

```javascript
const poppler = new PdfPoppler({
    preferXvfb: true  // Enable xvfb wrapper if needed
});
```

Or disable xvfb if not required:

```javascript
const poppler = new PdfPoppler({
    preferXvfb: false
});
```

## AWS Lambda

For AWS Lambda, use [pdf-poppler-binaries-aws-2](https://npmjs.com/package/pdf-poppler-binaries-aws-2) instead - it's compiled specifically for Amazon Linux 2's GLIBC version.

## System Requirements

- Linux x64
- No additional system dependencies required (all libraries bundled)

## License

ISC

## Related Packages

- [pdf-poppler-core](https://npmjs.com/package/pdf-poppler-core) - Core wrapper (required)
- [pdf-poppler-binaries-aws-2](https://npmjs.com/package/pdf-poppler-binaries-aws-2) - AWS Lambda binaries
- [pdf-poppler-binaries-win32](https://npmjs.com/package/pdf-poppler-binaries-win32) - Windows binaries
- [pdf-poppler-binaries-darwin](https://npmjs.com/package/pdf-poppler-binaries-darwin) - macOS binaries
