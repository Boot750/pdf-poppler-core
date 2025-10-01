# Bundled Xvfb Solution

This document explains how to use the bundled Xvfb solution, which includes a complete virtual display server directly in the npm package, eliminating the need for Lambda Layers or system dependencies.

## Overview

The bundled Xvfb solution packages all necessary components for headless PDF conversion:

- **Poppler binaries**: PDF processing tools
- **Xvfb server**: Virtual X11 display server  
- **Graphics libraries**: EGL, OpenGL, X11 dependencies
- **Custom xvfb-run script**: Simplified wrapper for headless operation

## Benefits

✅ **Zero external dependencies** - Everything needed is included  
✅ **No Lambda Layers required** - Deploy as a standard npm package  
✅ **Universal compatibility** - Works in any Linux environment  
✅ **Automatic detection** - Library automatically uses bundled components  
✅ **Smaller deployment** - More efficient than separate layers  

## Quick Start

### 1. Build the Bundle

```bash
# Build the bundled Xvfb solution
./build-bundled-xvfb.sh
```

This creates `lib/linux/poppler-xvfb-latest/` containing all required files.

### 2. Use in Your Code

```javascript
const poppler = require('pdf-poppler');

// The library automatically detects and uses bundled Xvfb
console.log('Using bundled Xvfb:', poppler.hasBundledXvfb);

// Convert PDF (works in any environment)
await poppler.convert('document.pdf', {
    format: 'png',
    out_dir: '/tmp',
    out_prefix: 'page'
});
```

### 3. Deploy to AWS Lambda

No special configuration needed! Just deploy your package normally:

```bash
# Standard deployment - no layers required
zip -r my-function.zip node_modules/ index.js package.json
aws lambda update-function-code --function-name my-function --zip-file fileb://my-function.zip
```

## How It Works

### Automatic Detection

The library uses this priority order for binary selection:

1. **Lambda Layer** (`/opt/bin/pdftocairo`) - If available
2. **Bundled Xvfb** (`lib/linux/poppler-xvfb-latest/`) - Preferred for most cases  
3. **Regular bundle** (`lib/linux/poppler-latest/`) - Fallback

### Virtual Display Management

When bundled Xvfb is available:

```javascript
// Library automatically detects need for virtual display
const needsVirtualDisplay = isCI || isLambda || !hasDisplay;

if (needsVirtualDisplay) {
    // 1. Try bundled xvfb-run script (preferred)
    // 2. Try system xvfb-run 
    // 3. Set DISPLAY environment variables
}
```

### Library Path Setup

The bundled solution includes all required shared libraries:

```javascript
// Automatic library path configuration
LD_LIBRARY_PATH = /path/to/poppler-xvfb-latest/lib
```

## Bundle Contents

### Binaries (`bin/`)
```
pdftocairo      # PDF to image converter
pdfinfo         # PDF information tool  
Xvfb            # Virtual X11 server
xvfb-run        # Custom wrapper script
xauth           # X11 authentication
[other poppler tools]
```

### Libraries (`lib/`)
```
libpoppler.so*     # PDF processing
libX11.so*         # X11 display
libEGL.so*         # OpenGL ES
libGL.so*          # OpenGL
libcairo.so*       # Graphics rendering
[all dependencies]
```

## Environment Compatibility

| Environment | Bundled Detection | Virtual Display | Status |
|-------------|-------------------|-----------------|--------|
| **AWS Lambda** | ✅ Auto | ✅ xvfb-run | ✅ **Perfect** |
| **GitHub Actions** | ✅ Auto | ✅ xvfb-run | ✅ **Perfect** |
| **Docker containers** | ✅ Auto | ✅ xvfb-run | ✅ **Perfect** |
| **Local development** | ✅ Auto | ⚠️ System display | ✅ **Good** |
| **Other CI systems** | ✅ Auto | ✅ xvfb-run | ✅ **Perfect** |

## Advanced Usage

### Manual Bundle Path

```javascript
// Force use of specific bundle
process.env.POPPLER_PATH = './lib/linux/poppler-xvfb-latest/bin';
const poppler = require('pdf-poppler');
```

### Debug Information

```javascript
const poppler = require('pdf-poppler');

console.log('Bundle info:', {
    path: poppler.path,
    hasBundledXvfb: poppler.hasBundledXvfb,
    isLambda: poppler.isLambda
});

// Enable debug output
process.env.NODE_ENV = 'test';
await poppler.convert('file.pdf', options); // Shows detailed execution info
```

### Custom Xvfb Configuration

The bundled `xvfb-run` script supports environment variables:

```javascript
// Customize virtual display
process.env.DISPLAY_NUM = '100';        // Display :100 instead of :99
process.env.SCREEN_RESOLUTION = '1920x1080x24';  // Higher resolution
process.env.XVFB_TIMEOUT = '10';        // Longer startup timeout

await poppler.convert('file.pdf', options);
```

## Building Custom Bundles

### Modify the Dockerfile

Edit `get-poppler-with-xvfb-linux.dockerfile` to:

- Add additional binaries
- Include extra libraries  
- Customize Xvfb configuration
- Change base image

### Rebuild

```bash
# Clean previous bundle
rm -rf lib/linux/poppler-xvfb-latest/

# Build new bundle
./build-bundled-xvfb.sh
```

## Troubleshooting

### Bundle Not Detected

```javascript
const poppler = require('pdf-poppler');
console.log('Using bundled Xvfb:', poppler.hasBundledXvfb);

// If false, check that files exist:
const fs = require('fs');
console.log('Bundle exists:', fs.existsSync('./lib/linux/poppler-xvfb-latest/bin/pdftocairo'));
```

### Library Loading Issues

```bash
# Test library dependencies
LD_LIBRARY_PATH=./lib/linux/poppler-xvfb-latest/lib \
./lib/linux/poppler-xvfb-latest/bin/pdftocairo -v
```

### Permission Problems

```bash
# Make binaries executable
chmod +x lib/linux/poppler-xvfb-latest/bin/*
```

### Virtual Display Issues

```bash
# Test Xvfb directly
./lib/linux/poppler-xvfb-latest/bin/xvfb-run echo "Virtual display test"
```

## Size Considerations

### Bundle Size
- **Complete bundle**: ~50-80 MB
- **Compressed in npm**: ~15-25 MB
- **Lambda deployment**: Fits well within limits

### Optimization Options
1. **Remove unused binaries** - Keep only pdftocairo
2. **Strip debug symbols** - Reduce binary sizes
3. **Compress libraries** - Use UPX for smaller files

### Size Comparison
```
Regular poppler bundle:     ~30 MB
+ Bundled Xvfb:            ~50 MB (+20 MB)
vs Lambda Layer approach:   0 MB package + 50 MB layer
```

## Future Enhancements

### Planned Features
- [ ] WebAssembly fallback for pure JS environments
- [ ] Automatic bundle updates via CI
- [ ] Multiple architecture support (ARM64)
- [ ] Optional GPU acceleration

### Integration Ideas
- Serverless framework plugins
- Docker base images
- CDK constructs for easy deployment

## References

- [Xvfb Documentation](https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml)
- [AWS Lambda Deployment Packages](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-package.html)
- [Poppler Utilities](https://poppler.freedesktop.org/)