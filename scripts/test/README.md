# Test Scripts

Docker configurations for testing pdf-poppler in different environments.

## Standard Test Environment

Tests using Node.js with Xvfb for headless PDF rendering.

```bash
# Build the test image
docker build -t pdf-poppler-test -f scripts/test/test.dockerfile .

# Run tests
docker run --rm pdf-poppler-test
```

This simulates the GitHub Actions CI environment with:
- Node.js 22
- Xvfb installed
- X11 libraries for rendering
- `CI=true` and `GITHUB_ACTIONS=true` environment variables

## Lambda Test Environment

Tests using AWS Lambda's Node.js 22 runtime image.

```bash
# Build the Lambda test image
docker build -t pdf-poppler-lambda-test -f scripts/test/lambda-test.dockerfile .

# Run tests
docker run --rm pdf-poppler-lambda-test
```

This simulates AWS Lambda with:
- Official AWS Lambda Node.js 22 base image
- Lambda environment variables (`AWS_LAMBDA_FUNCTION_NAME`, etc.)
- Lambda's minimal runtime environment

## Environment Variables

Both test environments set:

| Variable | Value | Description |
|----------|-------|-------------|
| `CI` | `true` | Indicates CI environment |
| `NODE_ENV` | `test` | Node environment |

Lambda test additionally sets:

| Variable | Value |
|----------|-------|
| `AWS_LAMBDA_FUNCTION_NAME` | `test-pdf-poppler` |
| `AWS_LAMBDA_RUNTIME_API` | `127.0.0.1:9001` |
| `LAMBDA_RUNTIME_DIR` | `/var/runtime` |
| `_LAMBDA_SERVER_PORT` | `8080` |

## When to Use

- **test.dockerfile**: General testing, CI simulation, development
- **lambda-test.dockerfile**: Testing Lambda-specific behavior, binary compatibility with Lambda runtime
