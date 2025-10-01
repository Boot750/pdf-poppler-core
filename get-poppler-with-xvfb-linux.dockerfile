FROM amazonlinux:2

# Install dependencies
RUN yum update -y && yum install -y \
    wget \
    tar \
    gzip \
    which \
    && yum clean all

# Install poppler-utils, graphics libraries, and Xvfb
RUN yum install -y \
    poppler-utils \
    mesa-libEGL mesa-libGL mesa-libGLU \
    xorg-x11-server-Xvfb \
    xorg-x11-xauth \
    && yum clean all

# Create output directories
RUN mkdir -p /output/bin /output/lib

WORKDIR /build

# Copy poppler binaries
RUN cp /usr/bin/pdfinfo /output/bin/ || echo "pdfinfo not available"
RUN cp /usr/bin/pdftotext /output/bin/ || echo "pdftotext not available"
RUN cp /usr/bin/pdftoppm /output/bin/ || echo "pdftoppm not available"
RUN cp /usr/bin/pdftops /output/bin/ || echo "pdftops not available"
RUN cp /usr/bin/pdftocairo /output/bin/ || echo "pdftocairo not available"
RUN cp /usr/bin/pdfimages /output/bin/ || echo "pdfimages not available"
RUN cp /usr/bin/pdffonts /output/bin/ || echo "pdffonts not available"
RUN cp /usr/bin/pdfattach /output/bin/ || echo "pdfattach not available"
RUN cp /usr/bin/pdfdetach /output/bin/ || echo "pdfdetach not available"
RUN cp /usr/bin/pdfseparate /output/bin/ || echo "pdfseparate not available"
RUN cp /usr/bin/pdfunite /output/bin/ || echo "pdfunite not available"

# Copy Xvfb and related binaries
RUN cp /usr/bin/Xvfb /output/bin/ || echo "Xvfb not available"
RUN cp /usr/bin/xauth /output/bin/ || echo "xauth not available"

# Create xvfb-run script (since it's often just a shell script)
RUN cat > /output/bin/xvfb-run << 'EOF'
#!/bin/bash
# Simplified xvfb-run script for bundled use

DISPLAY_NUM=${DISPLAY_NUM:-99}
SCREEN_NUM=${SCREEN_NUM:-0}
SCREEN_RESOLUTION=${SCREEN_RESOLUTION:-1024x768x24}
XVFB_TIMEOUT=${XVFB_TIMEOUT:-5}

# Find the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start Xvfb in background
DISPLAY=:${DISPLAY_NUM} "${SCRIPT_DIR}/Xvfb" :${DISPLAY_NUM} -screen ${SCREEN_NUM} ${SCREEN_RESOLUTION} -nolisten tcp -auth /tmp/.Xauth${DISPLAY_NUM} &
XVFB_PID=$!

# Wait for Xvfb to start
sleep ${XVFB_TIMEOUT}

# Set up auth file
if command -v "${SCRIPT_DIR}/xauth" >/dev/null 2>&1; then
    "${SCRIPT_DIR}/xauth" -f /tmp/.Xauth${DISPLAY_NUM} add :${DISPLAY_NUM} . $(mcookie 2>/dev/null || echo "0000000000000000000000000000000000000000")
fi

# Export environment variables
export DISPLAY=:${DISPLAY_NUM}
export XAUTHORITY=/tmp/.Xauth${DISPLAY_NUM}

# Execute the command
if [ $# -eq 0 ]; then
    echo "Usage: xvfb-run command [args...]"
    kill $XVFB_PID 2>/dev/null
    exit 1
fi

# Run the command and capture exit code
"$@"
EXIT_CODE=$?

# Clean up
kill $XVFB_PID 2>/dev/null
rm -f /tmp/.Xauth${DISPLAY_NUM}

exit $EXIT_CODE
EOF

# Make all binaries executable
RUN chmod +x /output/bin/*

# Copy required libraries for poppler
RUN echo "Copying poppler libraries..." && \
    cp /usr/lib64/libpoppler.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libpoppler-glib.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libpoppler-cpp.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libfreetype.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libfontconfig.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libjpeg.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libpng*.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libtiff.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libopenjp2.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libopenjpeg.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libcairo.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libglib-2.0.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libexpat.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libxml2.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/liblzma.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libbz2.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libpcre.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libffi.so* /output/lib/ 2>/dev/null || true

# Copy X11 and graphics libraries for both poppler and Xvfb
RUN echo "Copying X11 and graphics libraries..." && \
    cp /usr/lib64/libEGL.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libGL.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libGLU.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libglapi.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libX11.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXext.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXfont.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXfont2.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXfontcache.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXau.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXdmcp.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libxcb.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXfixes.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXrender.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXrandr.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXi.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXcursor.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXcomposite.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXdamage.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libdrm.so* /output/lib/ 2>/dev/null || true

# Copy safe system libraries (avoid glibc conflicts)
RUN echo "Copying safe system libraries..." && \
    cp /lib64/libz.so* /output/lib/ 2>/dev/null || true && \
    cp /lib64/libstdc++.so* /output/lib/ 2>/dev/null || true && \
    cp /lib64/libgcc_s.so* /output/lib/ 2>/dev/null || true

# Find and copy additional dependencies for both poppler and Xvfb
RUN echo "=== Finding missing dependencies for poppler ===" && \
    for binary in /output/bin/pdf*; do \
        echo "Dependencies for $(basename $binary):"; \
        ldd "$binary" 2>/dev/null | grep "not found" || true; \
    done && \
    echo "=== Finding missing dependencies for Xvfb ===" && \
    ldd /output/bin/Xvfb 2>/dev/null | grep "not found" || true && \
    echo "=== Copying additional dependencies (excluding system libs) ===" && \
    for binary in /output/bin/pdfinfo /output/bin/Xvfb; do \
        ldd "$binary" | grep "=>" | awk '{print $3}' | while read lib; do \
            libname=$(basename "$lib"); \
            # Skip core system libraries that should use host versions \
            if [[ "$libname" == "libc.so.6" || "$libname" == "libpthread.so.0" || \
                  "$libname" == "libm.so.6" || "$libname" == "libdl.so.2" || \
                  "$libname" == "ld-linux-x86-64.so.2" || "$libname" == "librt.so.1" ]]; then \
                echo "Skipping system library: $libname"; \
            elif [[ -f "$lib" && ! -f "/output/lib/$libname" ]]; then \
                cp "$lib" /output/lib/ 2>/dev/null || echo "Failed to copy $lib"; \
            fi; \
        done; \
    done

# Test both poppler and Xvfb functionality
RUN echo "=== Available binaries ===" && \
    ls -la /output/bin/ && \
    echo "=== Available libraries ===" && \
    ls -la /output/lib/ && \
    echo "=== Testing pdfinfo with LD_LIBRARY_PATH ===" && \
    LD_LIBRARY_PATH=/output/lib /output/bin/pdfinfo -v 2>/dev/null || echo "pdfinfo test completed" && \
    echo "=== Testing pdftocairo with LD_LIBRARY_PATH ===" && \
    LD_LIBRARY_PATH=/output/lib /output/bin/pdftocairo -v 2>/dev/null || echo "pdftocairo test completed" && \
    echo "=== Testing Xvfb with LD_LIBRARY_PATH ===" && \
    LD_LIBRARY_PATH=/output/lib /output/bin/Xvfb -help 2>/dev/null | head -5 || echo "Xvfb test completed"

WORKDIR /output

# Create tar.gz with both poppler and Xvfb
CMD ["sh", "-c", "tar -czf /tmp/poppler-xvfb-linux-binaries.tar.gz bin lib && cat /tmp/poppler-xvfb-linux-binaries.tar.gz"]