# pdf-poppler

> **Beta Software:** This project is in early beta. Interface changes may occur frequently. When breaking changes happen, the minor version will be incremented. Not recommended for production use yet.

Convert PDF files into images using Poppler with promises. Achieves 10x faster performance compared to other PDF converters.

Poppler binaries are bundled - no system installation required.

## Supported Platforms

- **Linux** (x64) - including AWS Lambda, Docker, CI/CD
- **Windows** (x64)
- **macOS** (x64)
- **AWS Lambda** - with dedicated `pdf-poppler-binaries-aws-2` package

## Installation

Install the core package plus the binary package for your platform:

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

### Mixed Environment (Windows dev + Linux production)

```bash
# Production dependency (Linux server)
npm install pdf-poppler-core pdf-poppler-binaries-linux

# Development dependency (Windows local)
npm install --save-dev pdf-poppler-binaries-win32
```

The correct binary package is automatically selected based on the current platform.

## Usage

### Basic Usage

```javascript
const { PdfPoppler } = require('pdf-poppler-core');
const fs = require('fs');

const poppler = new PdfPoppler();

// All methods accept: file path, Buffer, Uint8Array, or Readable stream
const pdfBuffer = fs.readFileSync('document.pdf');

// Get PDF info
const info = await poppler.info(pdfBuffer);
console.log('Pages:', info.pages);
console.log('Size:', info.page_size);

// Convert PDF to images (returns array of buffers)
const pages = await poppler.convert(pdfBuffer, { format: 'png' });
pages.forEach(({ page, data }) => {
  fs.writeFileSync(`page-${page}.png`, data);
});

// Or use file path directly
const info = await poppler.info('document.pdf');
```

### Text Extraction

```javascript
// Extract all text
const text = await poppler.text(pdfBuffer);
console.log(text);

// Extract text page by page
const pages = await poppler.textPages(pdfBuffer);
pages.forEach(({ page, text }) => {
  console.log(`Page ${page}:`, text);
});

// With options
const text = await poppler.text(pdfBuffer, {
  layout: true,       // Maintain original layout
  firstPage: 1,
  lastPage: 5,
  password: 'secret'  // For encrypted PDFs
});
```

### PDF Merging

```javascript
const pdf1 = fs.readFileSync('doc1.pdf');
const pdf2 = fs.readFileSync('doc2.pdf');

// Merge multiple PDFs
const merged = await poppler.merge([pdf1, pdf2]);
fs.writeFileSync('merged.pdf', merged);

// Or get as stream
const stream = await poppler.mergeToStream([pdf1, pdf2]);
stream.pipe(fs.createWriteStream('merged.pdf'));
```

### PDF Splitting

```javascript
// Split PDF into individual pages
const pages = await poppler.split(pdfBuffer);
pages.forEach(({ page, data }) => {
  fs.writeFileSync(`page-${page}.pdf`, data);
});

// Split to streams (memory efficient)
const pageStreams = await poppler.splitToStreams(pdfBuffer);
pageStreams.forEach(({ page, stream }) => {
  stream.pipe(fs.createWriteStream(`page-${page}.pdf`));
});
```

### PDF Flattening

```javascript
// Flatten form fields and annotations
const flattened = await poppler.flatten(pdfBuffer);
fs.writeFileSync('flattened.pdf', flattened);

// Or as stream
const stream = await poppler.flattenToStream(pdfBuffer);
stream.pipe(fs.createWriteStream('flattened.pdf'));
```

### Font Information

```javascript
const fonts = await poppler.listFonts(pdfBuffer);
fonts.forEach(font => {
  console.log(`${font.name} - ${font.type} (embedded: ${font.embedded})`);
});
```

### Image Information

```javascript
const images = await poppler.listImages(pdfBuffer);
images.forEach(img => {
  console.log(`Page ${img.page}: ${img.width}x${img.height} ${img.type}`);
});
```

### Attachments

```javascript
// List attachments
const attachments = await poppler.listAttachments(pdfBuffer);
attachments.forEach(a => console.log(a.name, a.size));

// Extract specific attachment
const data = await poppler.extractAttachment(pdfBuffer, 1);

// Extract all attachments
const all = await poppler.extractAllAttachments(pdfBuffer);
all.forEach(({ name, data }) => {
  fs.writeFileSync(name, data);
});
```

### HTML Conversion

```javascript
const html = await poppler.html(pdfBuffer, {
  singlePage: true,
  noFrames: true
});
fs.writeFileSync('output.html', html);
```

### Streaming API

```javascript
// Convert to streams (for piping)
const streams = await poppler.convertToStream(pdfBuffer, { format: 'png' });
streams.forEach(({ page, stream }) => {
  stream.pipe(fs.createWriteStream(`page-${page}.png`));
});

// Async iterator (memory efficient for large PDFs)
for await (const { page, data } of poppler.convertIterator(pdfBuffer)) {
  fs.writeFileSync(`page-${page}.png`, data);
  console.log(`Converted page ${page}`);
}
```

### Factory Methods

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

// For AWS Lambda
const poppler = PdfPoppler.forLambda();

// For CI environments
const poppler = PdfPoppler.forCI();

// With custom binary path
const poppler = PdfPoppler.withBinaryPath('/custom/path/to/bin');

// Auto-detect settings
const poppler = PdfPoppler.autoDetect();
```

### Builder Pattern

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

const config = PdfPoppler.configure()
    .withOsBinary()           // Auto-detect platform binaries
    .withPreferXvfb(false)    // Disable xvfb
    .withMaxBuffer(10 * 1024 * 1024)
    .build();

const poppler = new PdfPoppler(config);
```

### TypeScript

```typescript
import { PdfPoppler, PdfInfo, ConvertOptions, PageResult } from 'pdf-poppler-core';
import * as fs from 'fs';

const poppler = new PdfPoppler();
const pdfBuffer = fs.readFileSync('document.pdf');

const info: PdfInfo = await poppler.info(pdfBuffer);
console.log(info.pages, info.width_in_pts, info.height_in_pts);

const options: ConvertOptions = {
  format: 'png',
  scale: 800,
  page: 1
};

const pages: PageResult[] = await poppler.convert(pdfBuffer, options);
fs.writeFileSync('page-1.png', pages[0].data);
```

## Options

### Convert Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | string | `'png'` | Output format: `png`, `jpeg`, `tiff`, `pdf`, `ps`, `eps`, `svg` |
| `scale` | number | `1024` | Scale to specified pixel size (png, jpeg, tiff only) |
| `dpi` | number | - | Resolution in DPI (takes precedence over scale) |
| `page` | number | all | Convert specific page only |
| `pages` | number[] | - | Convert specific pages (e.g., `[1, 3, 5]`) |
| `firstPage` | number | 1 | First page to convert |
| `lastPage` | number | last | Last page to convert |
| `quality` | number | - | JPEG quality 1-100 (jpeg only) |
| `transparent` | boolean | false | Transparent background (png only) |
| `password` | string | - | PDF user password |
| `ownerPassword` | string | - | PDF owner password |
| `cropBox` | boolean | false | Use crop box instead of media box |
| `antialias` | string | 'default' | Antialias mode: `default`, `none`, `gray`, `subpixel` |

### Text Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `page` | number | all | Extract specific page only |
| `firstPage` | number | 1 | First page to extract |
| `lastPage` | number | last | Last page to extract |
| `layout` | boolean | false | Maintain original layout spacing |
| `raw` | boolean | false | Raw text extraction order |
| `password` | string | - | PDF user password |
| `noPageBreaks` | boolean | false | Don't insert page break characters |

### HTML Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `page` | number | all | Convert specific page only |
| `firstPage` | number | 1 | First page to convert |
| `lastPage` | number | last | Last page to convert |
| `noFrames` | boolean | false | Don't generate frame structure |
| `complex` | boolean | false | Generate complex HTML (preserves layout) |
| `singlePage` | boolean | false | Generate single HTML page for all pages |
| `ignoreImages` | boolean | false | Don't include images in output |
| `zoom` | number | 1 | Zoom factor (e.g., 1.5 for 150%) |
| `password` | string | - | PDF user password |

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `binaryPath` | string | auto | Path to poppler bin directory |
| `preferXvfb` | boolean | auto | Use xvfb wrapper for headless rendering |
| `version` | string | highest | Specific poppler version |
| `isLambda` | boolean | auto | Force Lambda environment detection |
| `isCI` | boolean | auto | Force CI environment detection |

## Error Handling

```javascript
const {
  PdfPoppler,
  InvalidPdfError,
  EncryptedPdfError,
  PageOutOfRangeError,
  BinaryNotFoundError
} = require('pdf-poppler-core');

try {
  const info = await poppler.info(pdfBuffer);
} catch (error) {
  if (error instanceof InvalidPdfError) {
    console.log('Invalid or corrupted PDF');
  } else if (error instanceof EncryptedPdfError) {
    console.log('PDF is password protected');
  } else if (error instanceof PageOutOfRangeError) {
    console.log(`Page ${error.requestedPage} not found (total: ${error.totalPages})`);
  } else if (error instanceof BinaryNotFoundError) {
    console.log(`Binary not available: ${error.binaryName}`);
  }
}
```

## AWS Lambda

For AWS Lambda, use the dedicated `pdf-poppler-binaries-aws-2` package:

```javascript
const { PdfPoppler } = require('pdf-poppler-core');
const fs = require('fs');

exports.handler = async (event) => {
  const poppler = PdfPoppler.forLambda();

  // Read PDF from S3 or request body
  const pdfBuffer = Buffer.from(event.body, 'base64');

  const info = await poppler.info(pdfBuffer);

  // Convert to PNG
  const pages = await poppler.convert(pdfBuffer, {
    format: 'png',
    scale: 800
  });

  // Return first page as base64
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/png' },
    body: pages[0].data.toString('base64'),
    isBase64Encoded: true
  };
};
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POPPLER_BINARY_PATH` | Direct path to bin directory | auto |
| `POPPLER_VERSION` | Specific version (e.g., `24.08`) | highest |
| `POPPLER_PREFER_XVFB` | Set to `false` to disable xvfb | `true` in headless |

## Utility Methods

```javascript
const poppler = new PdfPoppler();

poppler.getPath();              // Get binary path
poppler.getVersion();           // Get detected version
poppler.getAvailableVersions(); // Get all available versions
poppler.isLambdaEnvironment();  // Check if Lambda mode
poppler.hasBundledXvfb();       // Check if using xvfb
poppler.getConfig();            // Get resolved configuration
poppler.getExecOptions();       // Get exec options
```

## Package Structure

| Package | Description |
|---------|-------------|
| `pdf-poppler-core` | Core TypeScript wrapper |
| `pdf-poppler-binaries-linux` | Linux x64 binaries |
| `pdf-poppler-binaries-win32` | Windows x64 binaries |
| `pdf-poppler-binaries-darwin` | macOS x64 binaries |
| `pdf-poppler-binaries-aws-2` | AWS Lambda binaries (Amazon Linux 2) |

## Credits

Originally forked from [pdf-poppler](https://github.com/kb47/pdf-poppler) by Khishigbaatar N.

## License

ISC
