# pdf-poppler-binaries-linux-fonts

Linux binaries for [pdf-poppler-core](https://www.npmjs.com/package/pdf-poppler-core) with bundled fonts. Designed for environments without system fonts like AWS Lambda, Docker containers, and serverless platforms.

## When to Use This Package

**Use this package if you need to fill PDF forms** (with libraries like `pdf-lib`) and convert them to images in serverless environments. Without bundled fonts, form field values will not render in the output images.

Standard Linux binary packages (`pdf-poppler-binaries-linux`, `pdf-poppler-binaries-aws-2`) do not include fonts, which causes filled form text to be invisible when converting to PNG/JPEG.

## Features

- Poppler 24.08 utilities (pdftocairo, pdfinfo, pdftotext, etc.)
- Bundled Liberation Sans fonts (Helvetica-compatible)
- Fontconfig configuration with automatic font substitution
- All required shared libraries included
- Xvfb support for headless rendering
- **PDF form field text renders correctly**

## Installation

```bash
npm install pdf-poppler-binaries-linux-fonts
```

## Usage

This package is automatically detected by `pdf-poppler-core` on Linux:

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

// Auto-detects and uses this package on Linux
const poppler = new PdfPoppler();
await poppler.convert('input.pdf', { format: 'png' });
```

For AWS Lambda:

```javascript
const poppler = PdfPoppler.forLambda();
await poppler.convert('input.pdf', { format: 'png' });
```

## Font Substitution

The package includes Liberation Sans fonts and configures fontconfig to automatically substitute:

- Helvetica → Liberation Sans
- Helvetica Neue → Liberation Sans
- Arial → Liberation Sans
- sans-serif → Liberation Sans

This ensures PDF form fields and text render correctly even without system fonts.

## Package Contents

- `lib/linux/poppler-24.08-xvfb/bin/` - Poppler binaries and Xvfb
- `lib/linux/poppler-24.08-xvfb/lib/` - Shared libraries
- `lib/fonts/` - Liberation Sans TTF fonts
- `lib/fontconfig/fonts.conf` - Fontconfig configuration

## Requirements

- Linux x86_64 (built on Amazon Linux 2023)
- Node.js 18+

## License

ISC

Poppler is licensed under GPL. Liberation Sans fonts are licensed under SIL Open Font License.
