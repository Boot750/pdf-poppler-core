FROM amazonlinux:2

# Install dependencies
RUN yum update -y && yum install -y \
    wget \
    tar \
    gzip \
    which \
    && yum clean all

# Install poppler-utils
RUN yum install -y poppler-utils

# Create output directories
RUN mkdir -p /output/bin /output/lib

WORKDIR /build

# Copy poppler binaries
RUN cp /usr/bin/pdfinfo /output/bin/ || echo "pdfinfo not available"
RUN cp /usr/bin/pdftotext /output/bin/ || echo "pdftotext not available"
RUN cp /usr/bin/pdftoppm /output/bin/ || echo "pdftoppm not available"
RUN cp /usr/bin/pdftops /output/bin/ || echo "pdftops not available"
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
    cp /usr/lib64/libffi.so* /output/lib/ 2>/dev/null || true

# Copy essential system libraries
RUN echo "Copying system libraries..." && \
    cp /lib64/libc.so.6 /output/lib/ 2>/dev/null || true && \
    cp /lib64/libm.so.6 /output/lib/ 2>/dev/null || true && \
    cp /lib64/libpthread.so.0 /output/lib/ 2>/dev/null || true && \
    cp /lib64/libdl.so.2 /output/lib/ 2>/dev/null || true && \
    cp /lib64/libz.so* /output/lib/ 2>/dev/null || true && \
    cp /lib64/libstdc++.so* /output/lib/ 2>/dev/null || true && \
    cp /lib64/libgcc_s.so* /output/lib/ 2>/dev/null || true

# Use ldd to find missing dependencies and copy them
RUN echo "=== Finding missing dependencies ===" && \
    for binary in /output/bin/*; do \
        echo "Dependencies for $(basename $binary):"; \
        ldd "$binary" 2>/dev/null | grep "not found" || true; \
    done && \
    echo "=== Copying additional dependencies ===" && \
    ldd /output/bin/pdfinfo | grep "=>" | awk '{print $3}' | while read lib; do \
        if [[ -f "$lib" && ! -f "/output/lib/$(basename $lib)" ]]; then \
            cp "$lib" /output/lib/ 2>/dev/null || echo "Failed to copy $lib"; \
        fi; \
    done

# Verify what we have
RUN echo "=== Available poppler binaries ===" && \
    ls -la /output/bin/ && \
    echo "=== Available libraries ===" && \
    ls -la /output/lib/ && \
    echo "=== Testing pdfinfo with LD_LIBRARY_PATH ===" && \
    LD_LIBRARY_PATH=/output/lib /output/bin/pdfinfo -v 2>/dev/null || echo "pdfinfo test completed"

WORKDIR /output

# Simple CMD that works regardless of lib directory state
CMD tar -czf /tmp/poppler-linux-lambda-binaries.tar.gz bin $([ -d lib ] && echo lib || echo "")