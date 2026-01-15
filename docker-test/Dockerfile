FROM node:22-slim

# Install X11 libraries required by pdftocairo
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxrender1 \
    libfontconfig1 \
    libfreetype6 \
    libx11-6 \
    libxext6 \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/pdf-poppler-core ./packages/pdf-poppler-core
COPY packages/pdf-poppler-binaries-linux ./packages/pdf-poppler-binaries-linux

# Copy test files
COPY form_sample.pdf ./
COPY sample_form.pdf ./

# Install dependencies and build
RUN npm install --legacy-peer-deps
RUN cd packages/pdf-poppler-core && npm install && npm run build && cd ../..
RUN npm install ./packages/pdf-poppler-core ./packages/pdf-poppler-binaries-linux pdf-lib@1.17.0 --legacy-peer-deps

# Copy test script
COPY docker-test/test-convert.js ./

# Create output directory
RUN mkdir -p /app/output

# Make binaries executable
RUN chmod -R +x /app/packages/pdf-poppler-binaries-linux/lib/

# Run conversion
CMD ["node", "test-convert.js"]
