@echo off
cd /d "%~dp0.."

echo Building Docker image...
docker build -f docker-test/Dockerfile -t pdf-poppler-test .

echo.
echo Running conversion test...
docker run --rm -v "%~dp0output:/app/output" pdf-poppler-test

echo.
echo Output files are in docker-test/output/
dir "%~dp0output"
