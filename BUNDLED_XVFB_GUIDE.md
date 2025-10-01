# Bundled Xvfb Setup Guide

This guide explains how to use the bundled Xvfb (X Virtual Framebuffer) solution for pdf-poppler, which includes a complete virtual display server bundled directly within the npm package.

## What is Bundled Xvfb?

The bundled Xvfb solution includes:
- All poppler utilities (pdftocairo, pdfinfo, etc.)
- Xvfb server for virtual display
- Custom xvfb-run script
- All required shared libraries (EGL, OpenGL, X11, etc.)
- Zero external dependencies

This eliminates the need for Lambda Layers or system-level installations.

## Quick Start

1. **Build the bundled binaries** (one-time setup):
   ```bash
   chmod +x build-bundled-xvfb.sh
   ./build-bundled-xvfb.sh
   ```

2. **Use in your code** - The library automatically detects and uses bundled Xvfb:
   ```javascript
   const poppler = require('pdf-poppler');
   
   // Works automatically in headless environments
   const options = {
       format: 'png',
       out_dir: './output',
       out_prefix: 'page',
       page: 1
   };
   
   poppler.convert('document.pdf', options)
       .then(res => console.log('Success:', res))
       .catch(err => console.error('Error:', err));
   ```

## Building Bundled Binaries

### Prerequisites
- Docker installed and running
- Bash shell (Linux/macOS/WSL)

### Build Process

1. **Run the build script**:
   ```bash
   ./build-bundled-xvfb.sh
   ```

2. **What happens during build**:
   - Creates Docker image with Amazon Linux 2
   - Installs poppler-utils, Xvfb, and all dependencies
   - Bundles everything into `lib/linux/poppler-xvfb-latest/`
   - Tests binary functionality

3. **Build output**:
   ```
   lib/linux/poppler-xvfb-latest/
   ├── bin/
   │   ├── Xvfb              # Virtual display server (1.9MB)
   │   ├── xvfb-run          # Wrapper script (1.2KB)
   │   ├── xauth             # X11 authentication (42KB)
   │   ├── pdftocairo        # PDF to image converter (123KB)
   │   ├── pdfinfo           # PDF info utility (67KB)
   │   └── [other poppler tools]
   └── lib/
       ├── libEGL.so.1       # Graphics libraries
       ├── libGL.so.1
       ├── libpoppler.so.46
       └── [67 shared libraries ~35MB total]
   ```

## Automatic Detection

The library uses intelligent detection to choose the best available binaries:

1. **Priority Order**:
   ```
   1. AWS Lambda Layer binaries (/opt/bin/)
   2. Bundled Xvfb binaries (poppler-xvfb-latest)
   3. Regular bundled binaries (poppler-latest)
   ```

2. **Headless Environment Detection**:
   - AWS Lambda (`process.env.AWS_LAMBDA_FUNCTION_NAME`)
   - CI environments (`process.env.CI`, `process.env.GITHUB_ACTIONS`)
   - Jest test environments (`process.env.JEST_WORKER_ID`)
   - No display server (`!process.env.DISPLAY`)

3. **Virtual Display Usage**:
   - Automatically uses `xvfb-run` in headless environments
   - Falls back to system xvfb-run if bundled version unavailable
   - Works without xvfb-run on systems with display server

## Environment-Specific Usage

### AWS Lambda

**Option 1: Bundled Approach (Recommended)**
```javascript
// No special configuration needed
const poppler = require('pdf-poppler');
// Library automatically detects Lambda and uses bundled Xvfb
```

**Option 2: Lambda Layer Approach**
1. Create Lambda Layer with virtual display support
2. Deploy with layer containing `/opt/bin/xvfb-run`
3. Library automatically prefers Lambda Layer binaries

### CI/CD (GitHub Actions, GitLab CI, etc.)

```yaml
# .github/workflows/test.yml
- name: Test PDF conversion
  run: |
    npm test
    # Library automatically detects CI environment and uses virtual display
```

### Local Development

```bash
# Works on any system - virtual display used automatically when needed
npm test
```

### Docker Containers

```dockerfile
FROM node:18-alpine
COPY . /app
WORKDIR /app
RUN npm install
# Library handles virtual display automatically
CMD ["npm", "start"]
```

## Manual Testing

### Test Individual Components

1. **Test poppler binary**:
   ```bash
   export LD_LIBRARY_PATH="$(pwd)/lib/linux/poppler-xvfb-latest/lib"
   ./lib/linux/poppler-xvfb-latest/bin/pdfinfo -v
   ```

2. **Test Xvfb server**:
   ```bash
   export LD_LIBRARY_PATH="$(pwd)/lib/linux/poppler-xvfb-latest/lib"
   ./lib/linux/poppler-xvfb-latest/bin/Xvfb -help | head -5
   ```

3. **Test virtual display wrapper**:
   ```bash
   export LD_LIBRARY_PATH="$(pwd)/lib/linux/poppler-xvfb-latest/lib"
   ./lib/linux/poppler-xvfb-latest/bin/xvfb-run echo "Virtual display works!"
   ```

4. **Test PDF conversion**:
   ```bash
   export LD_LIBRARY_PATH="$(pwd)/lib/linux/poppler-xvfb-latest/lib"
   ./lib/linux/poppler-xvfb-latest/bin/xvfb-run \
       ./lib/linux/poppler-xvfb-latest/bin/pdftocairo \
       -png -f 1 -l 1 sample.pdf /tmp/test-output
   ```

### Expected Warnings

These warnings are normal and don't affect functionality:
```
_XSERVTransmkdir: Mode of /tmp/.X11-unix should be set to 1777
sh: 1: /usr/bin/xkbcomp: not found
XKB: Failed to compile keymap
Keyboard initialization failed
xauth: file /tmp/.Xauth99 does not exist
```

## Troubleshooting

### Build Issues

**Problem**: Docker build fails
```bash
# Solution: Check Docker is running
docker --version
docker ps
```

**Problem**: Permission denied on build script
```bash
# Solution: Make script executable
chmod +x build-bundled-xvfb.sh
```

**Problem**: CRLF line ending errors
```bash
# Solution: Fix line endings
sed -i 's/\r$//' build-bundled-xvfb.sh
```

### Runtime Issues

**Problem**: Library path errors
```bash
# Solution: Library automatically sets LD_LIBRARY_PATH
# If issues persist, manually set:
export LD_LIBRARY_PATH="/path/to/pdf-poppler/lib/linux/poppler-xvfb-latest/lib"
```

**Problem**: "cannot execute: required file not found"
```bash
# Solution: Fix script permissions and line endings
chmod +x lib/linux/poppler-xvfb-latest/bin/xvfb-run
sed -i 's/\r$//' lib/linux/poppler-xvfb-latest/bin/xvfb-run
```

**Problem**: Virtual display warnings
- **Status**: Normal behavior in containerized environments
- **Impact**: Does not affect PDF conversion functionality
- **Verification**: Check that output files are created successfully

## Performance Considerations

### Bundle Size
- **Total Size**: ~40MB (binaries + libraries)
- **Binaries**: ~5MB (Xvfb + poppler tools)
- **Libraries**: ~35MB (shared dependencies)

### Memory Usage
- **Xvfb overhead**: ~10-20MB RAM
- **Startup time**: +200-500ms for virtual display initialization
- **CPU impact**: Minimal during PDF processing

### Optimization Tips

1. **Reuse processes** when converting multiple files
2. **Use appropriate DPI settings** to balance quality vs. performance
3. **Consider pagination** for large documents
4. **Monitor memory usage** in Lambda (adjust timeout/memory accordingly)

## Integration Examples

### Express.js API

```javascript
const express = require('express');
const poppler = require('pdf-poppler');
const app = express();

app.post('/convert', async (req, res) => {
    try {
        const options = {
            format: 'png',
            out_dir: '/tmp',
            out_prefix: 'page'
        };
        
        const result = await poppler.convert(req.file.path, options);
        res.json({ success: true, files: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### AWS Lambda Function

```javascript
exports.handler = async (event) => {
    const poppler = require('pdf-poppler');
    
    try {
        const options = {
            format: 'png',
            out_dir: '/tmp',
            page: event.page || 1
        };
        
        const result = await poppler.convert(event.pdfPath, options);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ files: result })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
```

### Batch Processing

```javascript
const poppler = require('pdf-poppler');
const fs = require('fs').promises;

async function processPDFs(pdfDirectory) {
    const files = await fs.readdir(pdfDirectory);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    
    for (const pdfFile of pdfFiles) {
        const options = {
            format: 'png',
            out_dir: './output',
            out_prefix: pdfFile.replace('.pdf', '')
        };
        
        try {
            const result = await poppler.convert(`${pdfDirectory}/${pdfFile}`, options);
            console.log(`Converted ${pdfFile}:`, result);
        } catch (error) {
            console.error(`Error converting ${pdfFile}:`, error.message);
        }
    }
}
```

## Security Considerations

### Bundled Libraries
- **Source**: Amazon Linux 2 official repositories
- **Validation**: Libraries are from trusted system packages
- **Updates**: Rebuild bundle when security updates are available

### Temporary Files
- **Location**: Uses `/tmp` directory (cleaned automatically)
- **Permissions**: Files created with restrictive permissions
- **Cleanup**: Remove temporary files after processing

### Process Isolation
- **Xvfb**: Runs in isolated virtual display (display :99)
- **Network**: Xvfb configured with `-nolisten tcp` (no network access)
- **Authentication**: Uses temporary auth files (auto-cleaned)

## Comparison with Alternatives

| Approach | Bundle Size | Dependencies | Setup Complexity | Performance |
|----------|-------------|--------------|------------------|-------------|
| **Bundled Xvfb** | 40MB | None | Low | Good |
| Lambda Layer | 5MB | Layer required | Medium | Best |
| System Install | 0MB | System packages | High | Best |

### When to Use Bundled Xvfb

✅ **Good for:**
- AWS Lambda without layers
- Containerized deployments
- CI/CD environments
- Development/testing
- Simple deployment requirements

❌ **Consider alternatives for:**
- Extremely size-constrained environments
- High-performance production (use Lambda Layer)
- Systems with existing poppler installation

## Advanced Configuration

### Custom Virtual Display Settings

Set environment variables before calling poppler functions:

```javascript
// Custom display number (default: 99)
process.env.DISPLAY_NUM = '100';

// Custom screen resolution (default: 1024x768x24)
process.env.SCREEN_RESOLUTION = '1920x1080x24';

// Custom startup timeout (default: 5 seconds)
process.env.XVFB_TIMEOUT = '10';

const poppler = require('pdf-poppler');
// Uses custom settings
```

### Library Path Override

```javascript
// Override library path if needed
process.env.LD_LIBRARY_PATH = '/custom/path/to/libs';

const poppler = require('pdf-poppler');
```

### Debug Mode

```javascript
// Enable debug output
process.env.PDF_POPPLER_DEBUG = 'true';

const poppler = require('pdf-poppler');
// Shows detailed execution information
```

## Maintenance

### Updating Bundled Binaries

1. **Check for updates**:
   ```bash
   # Review Dockerfile for newer poppler versions
   # Update base image if needed
   ```

2. **Rebuild bundle**:
   ```bash
   ./build-bundled-xvfb.sh
   ```

3. **Test updated bundle**:
   ```bash
   npm test
   ```

4. **Version control**:
   ```bash
   git add lib/linux/poppler-xvfb-latest/
   git commit -m "Update bundled Xvfb binaries"
   ```

### Monitoring

Track these metrics in production:
- Bundle size impact on deployment time
- Memory usage during PDF processing
- Error rates from virtual display issues
- Performance compared to alternative approaches

## Support

For issues specific to the bundled Xvfb solution:

1. **Check troubleshooting section** above
2. **Verify bundle integrity** by rebuilding
3. **Test with sample PDF** using manual commands
4. **Report issues** with environment details and error logs

The bundled Xvfb solution provides a robust, self-contained approach to PDF processing in headless environments without requiring external dependencies or complex setup procedures.