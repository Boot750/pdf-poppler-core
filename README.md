# pdf-poppler

Convert PDF files into images using Poppler with promises. Achieves 10x faster performance compared to other PDF converters.

Poppler binaries are bundled - no system installation required.

## Supported Platforms

- **Linux** (x64) - including AWS Lambda, Docker, CI/CD
- **Windows** (x64)
- **macOS** (x64)

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

### Mixed Environment (Windows dev + Linux production)

```bash
# Production dependency (Linux server/Lambda)
npm install pdf-poppler-core pdf-poppler-binaries-linux

# Development dependency (Windows local)
npm install --save-dev pdf-poppler-binaries-win32
```

The correct binary package is automatically selected based on the current platform.

## Usage

### Get PDF Info

```javascript
const pdf = require('pdf-poppler-core');

pdf.info('document.pdf')
    .then(info => {
        console.log('Pages:', info.pages);
        console.log('Size:', info.page_size);
    });
```

### Convert PDF to Images

```javascript
const path = require('path');
const pdf = require('pdf-poppler-core');

const file = 'document.pdf';

const options = {
    format: 'png',      // png, jpeg, tiff, pdf, ps, eps, svg
    out_dir: './output',
    out_prefix: path.basename(file, path.extname(file)),
    page: null          // null = all pages, or specific page number
};

pdf.convert(file, options)
    .then(() => console.log('Converted!'))
    .catch(err => console.error(err));
```

### Extract Image Data

```javascript
const pdf = require('pdf-poppler-core');

pdf.imgdata('document.pdf')
    .then(images => {
        console.log('Found', images.length, 'images');
    });
```

### TypeScript

```typescript
import { info, convert, imgdata } from 'pdf-poppler-core';

const pdfInfo = await info('document.pdf');
console.log(pdfInfo.pages);

await convert('document.pdf', {
    format: 'png',
    out_dir: './output'
});
```

## Options

### Convert Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | string | `'jpeg'` | Output format: `png`, `jpeg`, `tiff`, `pdf`, `ps`, `eps`, `svg` |
| `scale` | number | `1024` | Scale to specified pixel size |
| `out_dir` | string | PDF directory | Output directory |
| `out_prefix` | string | PDF filename | Output filename prefix |
| `page` | number | `null` | Page number (null = all pages) |

## AWS Lambda / Headless Environments

The Linux binaries include Xvfb support for headless environments. Lambda is automatically detected and configured:

```javascript
const pdf = require('pdf-poppler-core');

// Automatically works in Lambda
exports.handler = async (event) => {
    await pdf.convert('/tmp/input.pdf', {
        format: 'png',
        out_dir: '/tmp'
    });
};
```

See [docs/AWS_LAMBDA_SETUP.md](docs/AWS_LAMBDA_SETUP.md) for detailed Lambda configuration.

## Version Selection

Multiple Poppler versions can be installed. Control selection via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `POPPLER_VERSION` | Specific version (e.g., `24.08`) | Highest available |
| `POPPLER_PREFER_XVFB` | Prefer Xvfb variant | `true` in Lambda |

```javascript
const pdf = require('pdf-poppler-core');

// Check detected version
console.log('Version:', pdf.version);
console.log('Available:', pdf.getAvailableVersions());
```

## Package Structure

This library uses a modular package structure:

| Package | Description |
|---------|-------------|
| `pdf-poppler-core` | Core JavaScript/TypeScript wrapper |
| `pdf-poppler-binaries-linux` | Linux x64 binaries (includes Xvfb) |
| `pdf-poppler-binaries-win32` | Windows x64 binaries |
| `pdf-poppler-binaries-darwin` | macOS x64 binaries |

See [packages/README.md](packages/README.md) for package details.

## Documentation

- [Migration Guide](docs/MIGRATION.md) - Migrating from older versions
- [AWS Lambda Setup](docs/AWS_LAMBDA_SETUP.md) - Lambda deployment guide
- [Publishing Guide](docs/PUBLISHING_GUIDE.md) - For maintainers

## Credits

Originally forked from [pdf-poppler](https://github.com/nickhsine/pdf-poppler) by Khishigbaatar N.

## License

ISC
