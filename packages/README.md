# pdf-poppler Monorepo

This repository contains the pdf-poppler packages for converting PDF files to images.

## Packages

### [pdf-poppler-core](./pdf-poppler-core)

Core wrapper package written in TypeScript. Provides the `PdfPoppler` class for all PDF operations.

- **Install:** `npm install pdf-poppler-core`
- **Requires:** One of the binary packages below

### [pdf-poppler-binaries-linux](./pdf-poppler-binaries-linux)

Linux x64 binaries for Poppler.

- **Install:** `npm install pdf-poppler-binaries-linux`
- **Platform:** Linux x64
- **Use case:** Production servers, Docker, CI/CD

### [pdf-poppler-binaries-win32](./pdf-poppler-binaries-win32)

Windows x64 binaries for Poppler.

- **Install:** `npm install pdf-poppler-binaries-win32`
- **Platform:** Windows x64
- **Use case:** Windows development/production

### [pdf-poppler-binaries-darwin](./pdf-poppler-binaries-darwin)

macOS x64 binaries for Poppler.

- **Install:** `npm install pdf-poppler-binaries-darwin`
- **Platform:** macOS x64
- **Use case:** macOS development/production

### [pdf-poppler-binaries-aws-2](./pdf-poppler-binaries-aws-2)

AWS Lambda binaries compiled for Amazon Linux 2.

- **Install:** `npm install pdf-poppler-binaries-aws-2`
- **Platform:** Amazon Linux 2 (GLIBC 2.26)
- **Use case:** AWS Lambda functions

## Quick Start

### Linux
```bash
npm install pdf-poppler-core pdf-poppler-binaries-linux
```

### Windows
```bash
npm install pdf-poppler-core pdf-poppler-binaries-win32
```

### macOS
```bash
npm install pdf-poppler-core pdf-poppler-binaries-darwin
```

### AWS Lambda
```bash
npm install pdf-poppler-core pdf-poppler-binaries-aws-2
```

### Mixed (Windows dev, Linux prod)
```bash
npm install pdf-poppler-core pdf-poppler-binaries-linux
npm install --save-dev pdf-poppler-binaries-win32
```

## Usage

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

// Create instance
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

### AWS Lambda

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

const poppler = new PdfPoppler({
    isLambda: true,
    preferXvfb: false
});

exports.handler = async (event) => {
    await poppler.convert('/tmp/input.pdf', {
        format: 'png',
        out_dir: '/tmp'
    });
    return { statusCode: 200 };
};
```

## Development

### Building Core Package

```bash
cd packages/pdf-poppler-core
npm install
npm run build
```

### Testing

```bash
# From repo root
npm test
```

## License

ISC
