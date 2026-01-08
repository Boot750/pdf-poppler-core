# pdf-poppler-core

> **Beta Software:** This project is in early beta. Interface changes may occur frequently. When breaking changes happen, the minor version will be incremented. Not recommended for production use yet.

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

### Basic Usage

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

// Create an instance (auto-detects platform)
const poppler = new PdfPoppler();

// Get PDF info
const info = await poppler.info('/path/to/file.pdf');
console.log(info.pages, info.page_size);

// Convert PDF to images
await poppler.convert('/path/to/file.pdf', {
    format: 'png',
    out_dir: '/output/directory',
    out_prefix: 'page',
    scale: 1024
});

// Get embedded image data
const images = await poppler.imgdata('/path/to/file.pdf');
```

### Factory Methods

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

// For AWS Lambda (auto-configures xvfb and Lambda settings)
const lambdaPoppler = PdfPoppler.forLambda();

// For CI environments
const ciPoppler = PdfPoppler.forCI();

// With custom binary path
const customPoppler = PdfPoppler.withBinaryPath('/custom/poppler/bin');

// Auto-detect everything
const autoPoppler = PdfPoppler.autoDetect();
```

### Builder Pattern

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

const config = PdfPoppler.configure()
    .withOsBinary()           // Use auto-detected OS binaries
    .withPreferXvfb(false)    // Disable xvfb preference
    .withVersion('24.02')     // Use specific version
    .withMaxBuffer(10 * 1024 * 1024)  // Set max buffer
    .build();

const poppler = new PdfPoppler(config);
```

### Full Configuration

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

const poppler = new PdfPoppler({
    binaryPath: '/custom/path/to/bin',     // Optional: explicit binary path
    preferXvfb: true,                       // Optional: prefer xvfb variant
    version: '24.02',                       // Optional: specific version
    isLambda: true,                         // Optional: force Lambda mode
    isCI: false,                            // Optional: force CI mode
    execOptions: {
        maxBuffer: 10 * 1024 * 1024,        // Optional: buffer size
        timeout: 30000                       // Optional: timeout in ms
    }
});
```

### Instance Methods

```javascript
const poppler = new PdfPoppler();

// Get PDF metadata
const info = await poppler.info('/path/to/file.pdf');

// Convert PDF to images
await poppler.convert('/path/to/file.pdf', {
    format: 'png',       // 'png' | 'jpeg' | 'tiff' | 'pdf' | 'ps' | 'eps' | 'svg'
    out_dir: './output', // Output directory
    out_prefix: 'page',  // Output filename prefix
    page: 1,             // Specific page (null for all pages)
    scale: 1024          // Scale (only for png, jpeg, tiff)
});

// Get embedded image data
const images = await poppler.imgdata('/path/to/file.pdf');

// Utility methods
poppler.getPath();              // Get binary path
poppler.getVersion();           // Get detected version
poppler.getAvailableVersions(); // Get all available versions
poppler.isLambdaEnvironment();  // Check if Lambda mode
poppler.hasBundledXvfb();       // Check if using xvfb
poppler.getConfig();            // Get resolved configuration
poppler.getExecOptions();       // Get execution options
```

### TypeScript Support

This package is written in TypeScript and includes type definitions.

```typescript
import { PdfPoppler, PdfInfo, ConvertOptions } from 'pdf-poppler-core';

const poppler = new PdfPoppler();

const info: PdfInfo = await poppler.info('./document.pdf');
console.log(info.pages, info.width_in_pts, info.height_in_pts);

const options: ConvertOptions = {
    format: 'png',
    out_dir: './output',
    scale: 800
};
await poppler.convert('./document.pdf', options);
```

## Environment Variables

The following environment variables can configure behavior:

| Variable | Description |
|----------|-------------|
| `POPPLER_BINARY_PATH` | Direct path to poppler bin directory |
| `POPPLER_BINARY_PACKAGE` | Custom npm package for binaries |
| `POPPLER_VERSION` | Preferred poppler version |
| `POPPLER_PREFER_XVFB` | Set to 'false' to disable xvfb |

## Platform Support

- **Linux** (x64) - Including AWS Lambda
- **Windows** (x64)
- **macOS** (x64)
- **Other platforms** - Supported via custom binary configuration

## AWS Lambda Support

This package works in AWS Lambda environments. Use the `forLambda()` factory method for optimal configuration:

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

const poppler = PdfPoppler.forLambda();

exports.handler = async (event) => {
    const info = await poppler.info('/tmp/document.pdf');
    await poppler.convert('/tmp/document.pdf', {
        format: 'png',
        out_dir: '/tmp',
        out_prefix: 'page'
    });
    return { statusCode: 200 };
};
```

## Electron Support

The package automatically handles Electron ASAR unpacking for the binaries.

## License

ISC

## Related Packages

- [pdf-poppler-binaries-linux](https://npmjs.com/package/pdf-poppler-binaries-linux) - Linux binaries
- [pdf-poppler-binaries-win32](https://npmjs.com/package/pdf-poppler-binaries-win32) - Windows binaries
- [pdf-poppler-binaries-darwin](https://npmjs.com/package/pdf-poppler-binaries-darwin) - macOS binaries
