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

// Create an instance (auto-detects platform)
const poppler = new PdfPoppler();

// Get PDF info
const info = await poppler.info('document.pdf');
console.log('Pages:', info.pages);
console.log('Size:', info.page_size);

// Convert PDF to images
await poppler.convert('document.pdf', {
    format: 'png',
    out_dir: './output',
    out_prefix: 'page',
    scale: 1024
});

// Get embedded image data
const images = await poppler.imgdata('document.pdf');
console.log('Found', images.length, 'images');
```

### Factory Methods

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

// For AWS Lambda
const poppler = new PdfPoppler({ isLambda: true, preferXvfb: false });

// For CI environments
const poppler = PdfPoppler.forCI();

// With custom binary path
const poppler = PdfPoppler.withBinaryPath('/custom/path/to/bin');
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

### Full Configuration

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

const poppler = new PdfPoppler({
    binaryPath: '/custom/path/to/bin',  // Optional: explicit path
    preferXvfb: false,                   // Optional: disable xvfb wrapper
    version: '24.02',                    // Optional: specific version
    isLambda: true,                      // Optional: force Lambda mode
    isCI: false,                         // Optional: force CI mode
    execOptions: {
        maxBuffer: 10 * 1024 * 1024,     // Optional: buffer size
        timeout: 30000                    // Optional: timeout in ms
    }
});
```

### TypeScript

```typescript
import { PdfPoppler, PdfInfo, ConvertOptions } from 'pdf-poppler-core';

const poppler = new PdfPoppler();

const info: PdfInfo = await poppler.info('document.pdf');
console.log(info.pages, info.width_in_pts, info.height_in_pts);

const options: ConvertOptions = {
    format: 'png',
    out_dir: './output',
    scale: 800
};
await poppler.convert('document.pdf', options);
```

## Options

### Convert Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | string | `'jpeg'` | Output format: `png`, `jpeg`, `tiff`, `pdf`, `ps`, `eps`, `svg` |
| `scale` | number | `1024` | Scale to specified pixel size (only for png, jpeg, tiff) |
| `out_dir` | string | PDF directory | Output directory |
| `out_prefix` | string | PDF filename | Output filename prefix |
| `page` | number | `null` | Page number (null = all pages) |

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `binaryPath` | string | auto | Path to poppler bin directory |
| `preferXvfb` | boolean | auto | Use xvfb wrapper for headless rendering |
| `version` | string | highest | Specific poppler version |
| `isLambda` | boolean | auto | Force Lambda environment detection |
| `isCI` | boolean | auto | Force CI environment detection |

## AWS Lambda

For AWS Lambda, use the dedicated `pdf-poppler-binaries-aws-2` package:

```javascript
const { PdfPoppler } = require('pdf-poppler-core');

// Lambda handler
const poppler = new PdfPoppler({
    isLambda: true,
    preferXvfb: false  // Not needed with aws-2 binaries
});

exports.handler = async (event) => {
    const info = await poppler.info('/tmp/input.pdf');

    await poppler.convert('/tmp/input.pdf', {
        format: 'png',
        out_dir: '/tmp',
        out_prefix: 'page'
    });

    return { statusCode: 200 };
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

Originally forked from [pdf-poppler](https://github.com/nickhsine/pdf-poppler) by Khishigbaatar N.

## License

ISC
