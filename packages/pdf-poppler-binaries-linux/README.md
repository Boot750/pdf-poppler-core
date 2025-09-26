# pdf-poppler-binaries-linux

Linux binaries for [pdf-poppler-core](https://npmjs.com/package/pdf-poppler-core).

This package contains pre-compiled Poppler utilities for Linux (x64), including support for headless environments with bundled Xvfb.

## Installation

```bash
npm install pdf-poppler-binaries-linux
```

**Note:** You also need to install `pdf-poppler-core` to use these binaries.

```bash
npm install pdf-poppler-core pdf-poppler-binaries-linux
```

## What's Included

- Poppler utilities compiled for Linux x64
- Optional Xvfb support for headless environments (AWS Lambda, Docker, etc.)
- All required shared libraries

## AWS Lambda Support

The binaries include everything needed to run in AWS Lambda environments, including virtual display support.

## System Requirements

- Linux x64
- No additional system dependencies required (all libraries bundled)

## License

ISC

## Related Packages

- [pdf-poppler-core](https://npmjs.com/package/pdf-poppler-core) - Core wrapper (required)
- [pdf-poppler-binaries-win32](https://npmjs.com/package/pdf-poppler-binaries-win32) - Windows binaries
- [pdf-poppler-binaries-darwin](https://npmjs.com/package/pdf-poppler-binaries-darwin) - macOS binaries
