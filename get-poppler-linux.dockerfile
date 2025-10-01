FROM amazonlinux:2

# Install dependencies
RUN yum update -y && yum install -y \
    wget \
    tar \
    gzip \
    which \
    && yum clean all

# Install poppler-utils and graphics libraries needed for pdftocairo
RUN yum install -y poppler-utils mesa-libEGL mesa-libGL mesa-libGLU

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

# Make binaries executable
RUN chmod +x /output/bin/*

# Find and copy poppler shared libraries
RUN echo "Finding poppler libraries..." && \
    find /usr/lib64 -name "*poppler*" -type f 2>/dev/null || true && \
    find /lib64 -name "*poppler*" -type f 2>/dev/null || true

# Copy poppler and dependency libraries
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
    cp /usr/lib64/libffi.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libEGL.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libGL.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libGLU.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libglapi.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libX11.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXext.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libxcb.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXau.so* /output/lib/ 2>/dev/null || true && \
    cp /usr/lib64/libXdmcp.so* /output/lib/ 2>/dev/null || true

# Copy only non-system libraries (avoid glibc conflicts)
RUN echo "Copying safe system libraries..." && \
    cp /lib64/libz.so* /output/lib/ 2>/dev/null || true && \
    cp /lib64/libstdc++.so* /output/lib/ 2>/dev/null || true && \
    cp /lib64/libgcc_s.so* /output/lib/ 2>/dev/null || true

# Note: We skip copying core glibc libraries (libc.so.6, libpthread.so.0, libm.so.6, libdl.so.2)
# as these should use the host system versions to avoid ABI conflicts

# Use ldd to find missing dependencies and copy them (excluding system libraries)
RUN echo "=== Finding missing dependencies ===" && \
    for binary in /output/bin/*; do \
        echo "Dependencies for $(basename $binary):"; \
        ldd "$binary" 2>/dev/null | grep "not found" || true; \
    done && \
    echo "=== Copying additional dependencies (excluding system libs) ===" && \
    ldd /output/bin/pdfinfo | grep "=>" | awk '{print $3}' | while read lib; do \
        libname=$(basename "$lib"); \
        # Skip core system libraries that should use host versions \
        if [[ "$libname" == "libc.so.6" || "$libname" == "libpthread.so.0" || \
              "$libname" == "libm.so.6" || "$libname" == "libdl.so.2" || \
              "$libname" == "ld-linux-x86-64.so.2" || "$libname" == "librt.so.1" ]]; then \
            echo "Skipping system library: $libname"; \
        elif [[ -f "$lib" && ! -f "/output/lib/$libname" ]]; then \
            cp "$lib" /output/lib/ 2>/dev/null || echo "Failed to copy $lib"; \
        fi; \
    done

# Verify what we have
RUN echo "=== Available poppler binaries ===" && \
    ls -la /output/bin/ && \
    echo "=== Available libraries ===" && \
    ls -la /output/lib/ && \
    echo "=== Testing pdfinfo with LD_LIBRARY_PATH ===" && \
    LD_LIBRARY_PATH=/output/lib /output/bin/pdfinfo -v 2>/dev/null || echo "pdfinfo test completed" && \
    echo "=== Testing pdftocairo with LD_LIBRARY_PATH ===" && \
    LD_LIBRARY_PATH=/output/lib /output/bin/pdftocairo -v 2>/dev/null || echo "pdftocairo test completed"

WORKDIR /output

# Simple CMD that works regardless of lib directory state
CMD tar -czf /tmp/poppler-linux-lambda-binaries.tar.gz bin $([ -d lib ] && echo lib || echo "")