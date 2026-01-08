# pdf-poppler-binaries-aws-2

Poppler binaries compiled for **AWS Lambda** (Amazon Linux 2, GLIBC 2.26).

## Why this package?

AWS Lambda runs on Amazon Linux 2, which has an older GLIBC (2.26). The standard `pdf-poppler-binaries-linux` package is compiled on newer Linux distributions and won't work on Lambda.

This package provides binaries specifically compiled on Amazon Linux 2 for full Lambda compatibility.

## Installation

```bash
npm install pdf-poppler-core pdf-poppler-binaries-aws-2
```

## Usage

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

// Create instance for Lambda (xvfb not required)
const poppler = new PdfPoppler({
    isLambda: true,
    preferXvfb: false
});

// Lambda handler
exports.handler = async (event) => {
    const info = await poppler.info('/tmp/document.pdf');
    console.log('Pages:', info.pages);

    await poppler.convert('/tmp/document.pdf', {
        format: 'png',
        out_dir: '/tmp',
        out_prefix: 'page',
        page: 1
    });

    return { statusCode: 200 };
};
```

## Configuration

The `preferXvfb: false` setting is recommended for Lambda. The binaries work without a virtual display.

```javascript
// Recommended Lambda configuration
const poppler = new PdfPoppler({
    isLambda: true,
    preferXvfb: false
});
```

## Included Binaries

- `pdfinfo` - PDF document information
- `pdftotext` - PDF to text conversion
- `pdftoppm` - PDF to PPM/PNG/JPEG image conversion
- `pdftocairo` - PDF to PNG/JPEG/SVG/PDF conversion
- `pdfimages` - Extract images from PDF
- `pdffonts` - List fonts used in PDF
- `pdfseparate` - Split PDF pages
- `pdfunite` - Merge PDF files

## Compatibility

- AWS Lambda (Node.js 18.x, 20.x, 22.x runtimes)
- Amazon Linux 2
- Any Linux with GLIBC 2.26+

## License

ISC

## Related Packages

- [pdf-poppler-core](https://npmjs.com/package/pdf-poppler-core) - Core wrapper (required)
- [pdf-poppler-binaries-linux](https://npmjs.com/package/pdf-poppler-binaries-linux) - Standard Linux binaries
- [pdf-poppler-binaries-win32](https://npmjs.com/package/pdf-poppler-binaries-win32) - Windows binaries
- [pdf-poppler-binaries-darwin](https://npmjs.com/package/pdf-poppler-binaries-darwin) - macOS binaries
