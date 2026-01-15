@echo off
cd /d "%~dp0"

echo Building pdf-poppler-binaries-linux-fonts...

REM Build the Docker image
docker build -f Dockerfile.build -t pdf-poppler-fonts-builder .

REM Create lib directory if not exists
if not exist lib mkdir lib

REM Extract the built files
docker run --rm -v "%~dp0lib:/export" pdf-poppler-fonts-builder

echo.
echo Build complete! Files extracted to lib/
dir lib
