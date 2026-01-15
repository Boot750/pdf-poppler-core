#!/bin/sh
# Extract fonts.conf and Liberation Sans for bundling

# Install fonts
dnf install -y liberation-sans-fonts fontconfig freetype

# Create output directory structure
mkdir -p /output/fonts
mkdir -p /output/fontconfig

# Copy fonts.conf
cp /etc/fonts/fonts.conf /output/fontconfig/

# Copy Liberation Sans fonts
cp /usr/share/fonts/liberation-sans/*.ttf /output/fonts/

# Create a minimal fonts.conf that points to bundled fonts
cat > /output/fontconfig/fonts.conf << 'EOF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
    <!-- Bundled fonts directory - relative to FONTCONFIG_PATH -->
    <dir prefix="default">fonts</dir>

    <!-- Fallback to common system font locations -->
    <dir>/usr/share/fonts</dir>
    <dir>/usr/local/share/fonts</dir>

    <!-- Cache directory -->
    <cachedir prefix="xdg">fontconfig</cachedir>
    <cachedir>/tmp/fontconfig-cache</cachedir>

    <!-- Default rendering settings -->
    <match target="font">
        <edit name="antialias" mode="assign"><bool>true</bool></edit>
        <edit name="hinting" mode="assign"><bool>true</bool></edit>
        <edit name="hintstyle" mode="assign"><const>hintslight</const></edit>
        <edit name="rgba" mode="assign"><const>rgb</const></edit>
        <edit name="lcdfilter" mode="assign"><const>lcddefault</const></edit>
    </match>

    <!-- Map Helvetica to Liberation Sans -->
    <alias>
        <family>Helvetica</family>
        <prefer><family>Liberation Sans</family></prefer>
    </alias>
    <alias>
        <family>Arial</family>
        <prefer><family>Liberation Sans</family></prefer>
    </alias>
    <alias>
        <family>sans-serif</family>
        <prefer><family>Liberation Sans</family></prefer>
    </alias>
    <alias>
        <family>sans</family>
        <prefer><family>Liberation Sans</family></prefer>
    </alias>
</fontconfig>
EOF

# List what we extracted
echo "=== Extracted files ==="
ls -la /output/fonts/
ls -la /output/fontconfig/
echo "=== fonts.conf content ==="
cat /output/fontconfig/fonts.conf
