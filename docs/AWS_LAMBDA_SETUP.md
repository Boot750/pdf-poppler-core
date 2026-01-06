
# AWS Lambda Setup Guide

This guide explains how to use pdf-poppler in AWS Lambda environments, which require special handling due to the headless nature of Lambda and the graphics dependencies needed by `pdftocairo`.

## Overview

AWS Lambda runs in a headless environment without X11 display servers. Since `pdftocairo` requires graphics libraries and a display context to generate images, we need to:

1. Provide the necessary graphics libraries (EGL, OpenGL, X11)
2. Set up a virtual display using Xvfb (X Virtual Framebuffer)
3. Configure the proper environment variables

## Quick Setup Options

### Option 1: Use Lambda Layers (Recommended)

Create a Lambda Layer containing all required dependencies:

#### Step 1: Create the Layer Structure

```bash
# Create layer directory structure
mkdir -p lambda-layer/{bin,lib}
cd lambda-layer
```

#### Step 2: Install Dependencies in Amazon Linux Container

```bash
# Run Amazon Linux container to match Lambda runtime
docker run -it --rm -v $(pwd):/workspace amazonlinux:2 bash

# Inside container:
cd /workspace

# Install required packages
yum update -y
yum install -y mesa-libEGL mesa-libGL mesa-libGLU xorg-x11-server-Xvfb

# Copy binaries to layer
cp /usr/bin/xvfb-run bin/
cp /usr/bin/Xvfb bin/

# Copy libraries to layer
cp -L /usr/lib64/libEGL.so.1 lib/
cp -L /usr/lib64/libGL.so.1 lib/
cp -L /usr/lib64/libGLU.so.1 lib/
cp -L /usr/lib64/libX11.so.6 lib/
cp -L /usr/lib64/libXau.so.6 lib/
cp -L /usr/lib64/libXdmcp.so.6 lib/
cp -L /usr/lib64/libxcb.so.1 lib/
cp -L /usr/lib64/libXext.so.6 lib/
cp -L /usr/lib64/libXfixes.so.3 lib/
cp -L /usr/lib64/libXdamage.so.1 lib/
cp -L /usr/lib64/libdrm.so.2 lib/
cp -L /usr/lib64/libexpat.so.1 lib/

# Make binaries executable
chmod +x bin/*

exit
```

#### Step 3: Create Layer ZIP

```bash
# Create layer package
zip -r lambda-layer.zip bin/ lib/

# Upload to AWS Lambda as a layer
aws lambda publish-layer-version \
  --layer-name pdf-poppler-graphics \
  --description "Graphics libraries and Xvfb for pdf-poppler" \
  --zip-file fileb://lambda-layer.zip \
  --compatible-runtimes nodejs16.x nodejs18.x nodejs20.x
```

### Option 2: Include Everything in Deployment Package

If you prefer to include everything in your deployment package:

```bash
# Add the layer contents to your Lambda deployment package
cp -r lambda-layer/* your-lambda-function/
```

## Lambda Function Configuration

### Environment Variables

The library automatically detects Lambda environment and sets up the required environment variables:

- `DISPLAY=:99` - Virtual display identifier
- `XAUTHORITY=/tmp/.Xauth` - X11 authorization file
- `LD_LIBRARY_PATH` - Includes `/opt/lib` for layer libraries

### Function Code Example

```javascript
const poppler = require('pdf-poppler');

exports.handler = async (event) => {
    try {
        // The library automatically detects Lambda environment
        console.log('Running in Lambda:', poppler.isLambda);
        
        // Convert PDF to images
        const options = {
            format: 'png',
            out_dir: '/tmp',
            out_prefix: 'page',
            page: 1
        };
        
        // Assumes PDF file is in /tmp/input.pdf
        await poppler.convert('/tmp/input.pdf', options);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Conversion successful' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
```

## How It Works

### Automatic Detection

The library automatically detects AWS Lambda environment by checking for:
- `AWS_LAMBDA_FUNCTION_NAME`
- `AWS_LAMBDA_RUNTIME_API`
- `LAMBDA_RUNTIME_DIR`
- `_LAMBDA_SERVER_PORT`

### Binary Resolution Order

1. **Lambda Layer binaries**: `/opt/bin/pdftocairo` (preferred)
2. **Bundled binaries**: Fall back to included Linux binaries

### Virtual Display Setup

The library automatically configures virtual display in this order:
1. **Lambda Layer xvfb**: `/opt/bin/xvfb-run` (preferred)
2. **System xvfb**: `/usr/bin/xvfb-run` (fallback)
3. **Environment variables**: Manual DISPLAY setup (last resort)

## Troubleshooting

### Common Issues

#### Error: "libEGL.so.1: cannot open shared object file"
- **Solution**: Ensure the Lambda Layer includes all graphics libraries
- **Check**: Verify `/opt/lib` contains EGL/OpenGL libraries

#### Error: "cannot connect to X server"
- **Solution**: Ensure xvfb-run is available and working
- **Check**: Test xvfb-run in your Lambda Layer

#### Error: "No output files generated"
- **Solution**: This usually indicates missing display context
- **Check**: Verify Xvfb is starting correctly

### Debug Mode

Enable debug logging in Lambda:

```javascript
process.env.NODE_ENV = 'test'; // Enables debug output
```

This will show detailed command execution information to help diagnose issues.

### Testing Locally

Test your Lambda setup locally using SAM or similar tools:

```bash
# Using AWS SAM
sam local invoke YourFunction --event event.json
```

## Performance Considerations

### Memory Requirements
- Minimum: 512 MB (for small PDFs)
- Recommended: 1024 MB or higher (for complex/large PDFs)

### Timeout
- Simple conversions: 30-60 seconds
- Complex/large PDFs: 2-5 minutes

### Cold Start
- First invocation includes library initialization: ~2-3 seconds
- Subsequent invocations (warm): ~500ms-1s

## Alternative Approaches

### Container Images
For more control, consider using Lambda Container Images:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:18

# Install graphics dependencies
RUN yum update -y && \
    yum install -y mesa-libEGL mesa-libGL mesa-libGLU xorg-x11-server-Xvfb

# Copy your function code
COPY app.js ${LAMBDA_TASK_ROOT}
COPY node_modules ${LAMBDA_TASK_ROOT}/node_modules

CMD [ "app.handler" ]
```

This approach provides maximum compatibility but larger deployment sizes.

## References

- [AWS Lambda Layers Documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html)
- [AWS Lambda Container Images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
- [Poppler Documentation](https://poppler.freedesktop.org/)