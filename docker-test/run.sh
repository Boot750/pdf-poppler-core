#!/bin/bash
cd "$(dirname "$0")/.."

echo "Building Docker image..."
docker build -f docker-test/Dockerfile -t pdf-poppler-test .

echo ""
echo "Running conversion test..."
docker run --rm -v "$(pwd)/docker-test/output:/app/output" pdf-poppler-test

echo ""
echo "Output files are in docker-test/output/"
ls -la docker-test/output/
