#!/bin/bash
#
# Build macOS poppler binaries
#
# This script should be run on a macOS machine (or GitHub Actions macos-latest runner)
# It installs poppler via Homebrew and packages the binaries with their dependencies.
#
# Usage: ./build-darwin-binaries.sh [output_dir]
#

set -e

OUTPUT_DIR="${1:-./output}"
POPPLER_VERSION=$(brew info poppler --json | jq -r '.[0].versions.stable')

echo "=== Building macOS Poppler Binaries ==="
echo "Poppler version: ${POPPLER_VERSION}"
echo "Output directory: ${OUTPUT_DIR}"
echo ""

# Install poppler and dependencies via Homebrew
echo "Installing poppler via Homebrew..."
brew install poppler

# Get Homebrew prefix
BREW_PREFIX=$(brew --prefix)
POPPLER_PREFIX=$(brew --prefix poppler)

# Create output directory structure
PACKAGE_DIR="${OUTPUT_DIR}/poppler-${POPPLER_VERSION}"
mkdir -p "${PACKAGE_DIR}/bin"
mkdir -p "${PACKAGE_DIR}/lib"

echo ""
echo "=== Copying binaries ==="

# List of poppler binaries to include
BINARIES=(
    "pdfinfo"
    "pdftocairo"
    "pdftotext"
    "pdffonts"
    "pdfimages"
    "pdfseparate"
    "pdfunite"
    "pdfdetach"
    "pdftohtml"
    "pdftoppm"
    "pdftops"
    "pdfattach"
    "pdfsig"
)

for bin in "${BINARIES[@]}"; do
    if [ -f "${POPPLER_PREFIX}/bin/${bin}" ]; then
        cp "${POPPLER_PREFIX}/bin/${bin}" "${PACKAGE_DIR}/bin/"
        echo "  + ${bin}"
    else
        echo "  - ${bin} (not found)"
    fi
done

echo ""
echo "=== Collecting dependencies ==="

# Function to recursively collect dylib dependencies
collect_deps() {
    local binary=$1
    local collected_file="/tmp/collected_deps.txt"
    touch "$collected_file"

    # Get list of dependencies
    otool -L "$binary" 2>/dev/null | tail -n +2 | awk '{print $1}' | while read dep; do
        # Skip system libraries
        if [[ "$dep" == /usr/lib/* ]] || [[ "$dep" == /System/* ]]; then
            continue
        fi

        # Skip if already collected
        if grep -q "^${dep}$" "$collected_file" 2>/dev/null; then
            continue
        fi

        # Check if it's a Homebrew library
        if [[ "$dep" == ${BREW_PREFIX}/* ]] || [[ "$dep" == @loader_path/* ]] || [[ "$dep" == @rpath/* ]]; then
            local real_path="$dep"

            # Resolve @loader_path and @rpath
            if [[ "$dep" == @loader_path/* ]]; then
                real_path="${BREW_PREFIX}/lib/${dep#@loader_path/}"
            elif [[ "$dep" == @rpath/* ]]; then
                real_path="${BREW_PREFIX}/lib/${dep#@rpath/}"
            fi

            if [ -f "$real_path" ]; then
                echo "$dep" >> "$collected_file"
                local dest_name=$(basename "$real_path")

                if [ ! -f "${PACKAGE_DIR}/lib/${dest_name}" ]; then
                    cp "$real_path" "${PACKAGE_DIR}/lib/"
                    echo "  + ${dest_name}"

                    # Recursively collect dependencies of this library
                    collect_deps "$real_path"
                fi
            fi
        fi
    done
}

# Collect dependencies for each binary
for bin in "${PACKAGE_DIR}/bin/"*; do
    if [ -f "$bin" ]; then
        collect_deps "$bin"
    fi
done

rm -f /tmp/collected_deps.txt

echo ""
echo "=== Fixing library paths ==="

# Fix library paths to use @executable_path/../lib
for bin in "${PACKAGE_DIR}/bin/"*; do
    if [ -f "$bin" ]; then
        echo "Fixing: $(basename "$bin")"

        # Get current dependencies
        otool -L "$bin" 2>/dev/null | tail -n +2 | awk '{print $1}' | while read dep; do
            if [[ "$dep" == ${BREW_PREFIX}/* ]]; then
                local lib_name=$(basename "$dep")
                install_name_tool -change "$dep" "@executable_path/../lib/${lib_name}" "$bin" 2>/dev/null || true
            elif [[ "$dep" == @loader_path/* ]]; then
                local lib_name=$(basename "$dep")
                install_name_tool -change "$dep" "@executable_path/../lib/${lib_name}" "$bin" 2>/dev/null || true
            elif [[ "$dep" == @rpath/* ]]; then
                local lib_name=$(basename "$dep")
                install_name_tool -change "$dep" "@executable_path/../lib/${lib_name}" "$bin" 2>/dev/null || true
            fi
        done
    fi
done

# Fix library paths within libraries themselves
for lib in "${PACKAGE_DIR}/lib/"*.dylib; do
    if [ -f "$lib" ]; then
        local lib_name=$(basename "$lib")

        # Change the library's own ID
        install_name_tool -id "@loader_path/${lib_name}" "$lib" 2>/dev/null || true

        # Fix references to other libraries
        otool -L "$lib" 2>/dev/null | tail -n +2 | awk '{print $1}' | while read dep; do
            if [[ "$dep" == ${BREW_PREFIX}/* ]]; then
                local dep_name=$(basename "$dep")
                install_name_tool -change "$dep" "@loader_path/${dep_name}" "$lib" 2>/dev/null || true
            elif [[ "$dep" == @loader_path/* ]] && [[ "$dep" != "@loader_path/${lib_name}" ]]; then
                local dep_name=$(basename "$dep")
                install_name_tool -change "$dep" "@loader_path/${dep_name}" "$lib" 2>/dev/null || true
            elif [[ "$dep" == @rpath/* ]]; then
                local dep_name=$(basename "$dep")
                install_name_tool -change "$dep" "@loader_path/${dep_name}" "$lib" 2>/dev/null || true
            fi
        done
    fi
done

# Code sign the binaries (required for macOS Monterey+)
echo ""
echo "=== Code signing ==="
for file in "${PACKAGE_DIR}/bin/"* "${PACKAGE_DIR}/lib/"*.dylib; do
    if [ -f "$file" ]; then
        codesign --force --sign - "$file" 2>/dev/null || true
    fi
done

# Create version file
echo "${POPPLER_VERSION}" > "${PACKAGE_DIR}/VERSION"

# Verify binaries work
echo ""
echo "=== Verifying binaries ==="
if "${PACKAGE_DIR}/bin/pdfinfo" -v 2>&1 | head -1; then
    echo "  + pdfinfo works!"
else
    echo "  - pdfinfo failed"
fi

echo ""
echo "=== Summary ==="
echo "Binaries: $(ls -1 "${PACKAGE_DIR}/bin/" | wc -l | tr -d ' ') files"
echo "Libraries: $(ls -1 "${PACKAGE_DIR}/lib/" | wc -l | tr -d ' ') files"
echo "Total size: $(du -sh "${PACKAGE_DIR}" | cut -f1)"
echo ""
echo "Output: ${PACKAGE_DIR}"
echo ""
echo "=== Done ==="
