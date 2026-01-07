# pdf-poppler-binaries-aws-2

Poppler binaries compiled for **AWS Lambda** (Amazon Linux 2, GLIBC 2.26).

## Why this package?

AWS Lambda runs on Amazon Linux 2, which has an older GLIBC (2.26). The standard `pdf-poppler-binaries-linux` package is compiled on newer Linux distributions and won't work on Lambda.

This package provides binaries specifically compiled on Amazon Linux 2 for full Lambda compatibility.

## Installation

```bash
npm install pdf-poppler-core pdf-poppler-binaries-aws-2
```

## Usage with pdf-poppler-core

```javascript
const pdfPoppler = require('pdf-poppler-core');

// The core package will auto-detect this binary package on Lambda
```

Or explicitly configure:

```javascript
// Set environment variable before requiring pdf-poppler-core
process.env.POPPLER_BINARY_PACKAGE = 'pdf-poppler-binaries-aws-2';

const pdfPoppler = require('pdf-poppler-core');
```

## Included binaries

- `pdfinfo` - PDF document information
- `pdftotext` - PDF to text conversion
- `pdftoppm` - PDF to PPM/PNG/JPEG image conversion
- `pdftocairo` - PDF to PNG/JPEG/SVG/PDF conversion
- `pdfimages` - Extract images from PDF
- `pdffonts` - List fonts used in PDF
- `pdfseparate` - Split PDF pages
- `pdfunite` - Merge PDF files
- `Xvfb` - Virtual framebuffer for headless rendering
- `xvfb-run` - Wrapper script for Xvfb

## Compatibility

- AWS Lambda (Node.js 14.x, 16.x, 18.x, 20.x runtimes)
- Amazon Linux 2
- Any Linux with GLIBC 2.26+

## License

ISC
