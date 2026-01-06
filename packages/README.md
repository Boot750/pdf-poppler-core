# pdf-poppler Monorepo

This repository contains the restructured pdf-poppler packages.

## Packages

### [pdf-poppler-core](./pdf-poppler-core)

Core wrapper package written in TypeScript. Contains all the JavaScript logic for interacting with Poppler utilities.

- **Install:** `npm install pdf-poppler-core`
- **Requires:** One of the binary packages below

### [pdf-poppler-binaries-linux](./pdf-poppler-binaries-linux)

Linux x64 binaries for Poppler, including Xvfb support for headless environments.

- **Install:** `npm install pdf-poppler-binaries-linux`
- **Platform:** Linux x64
- **Use case:** Production servers, Docker, AWS Lambda

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

### Mixed (Windows dev, Linux prod)
```bash
npm install pdf-poppler-core pdf-poppler-binaries-linux
npm install --save-dev pdf-poppler-binaries-win32
```

## Documentation

- [Migration Guide](./MIGRATION.md) - Detailed migration instructions
- [Core Package README](./pdf-poppler-core/README.md)
- [Linux Binaries README](./pdf-poppler-binaries-linux/README.md)
- [Windows Binaries README](./pdf-poppler-binaries-win32/README.md)
- [macOS Binaries README](./pdf-poppler-binaries-darwin/README.md)

## Development

### Building Core Package

```bash
cd packages/pdf-poppler-core
npm install
npm run build
```

### Testing

```bash
cd packages/pdf-poppler-core
npm test
```

## License

ISC
