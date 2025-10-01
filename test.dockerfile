FROM node:22-slim

# Install system dependencies for testing (same as CI)
RUN apt-get update && apt-get install -y \
    xvfb \
    git \
    libxcb-render0 \
    libxcb-shm0 \
    libxcb-xfixes0 \
    libxrender1 \
    libxrandr2 \
    libxss1 \
    libxft2 \
    libxcomposite1 \
    libxi6 \
    libxtst6 \
    libxdamage1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy source code
COPY . .

# Set environment variables to match CI
ENV CI=true
ENV NODE_ENV=test
ENV GITHUB_ACTIONS=true

# Run tests with the same command as CI
CMD ["npm", "test"]