# Lambda environment test Dockerfile
# This simulates AWS Lambda environment for testing pdf-poppler
FROM public.ecr.aws/lambda/nodejs:22

# Install system dependencies that would be available in Lambda
# Note: Lambda has a minimal runtime, most packages come pre-installed
# We'll check what's available without installing additional packages
RUN which git || echo "git not available" && \
    which tar || echo "tar not available" && \
    which gzip || echo "gzip not available"

# Set Lambda environment variables
ENV AWS_LAMBDA_FUNCTION_NAME=test-pdf-poppler
ENV AWS_LAMBDA_RUNTIME_API=127.0.0.1:9001
ENV LAMBDA_RUNTIME_DIR=/var/runtime
ENV _LAMBDA_SERVER_PORT=8080
ENV AWS_REGION=us-east-1
ENV AWS_EXECUTION_ENV=AWS_Lambda_nodejs22.x

# Lambda-specific environment
ENV CI=true
ENV NODE_ENV=test

# Set working directory to Lambda's typical location
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Install dev dependencies for testing
RUN npm ci

# Override the default Lambda entrypoint for testing
# In real Lambda, this would be handled by the Lambda runtime
ENTRYPOINT []
CMD ["npm", "test"]