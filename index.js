const os = require('os');
const path = require('path');
const fs = require('fs');
const {spawn} = require('child_process');

let platform = os.platform();
if (!['darwin', 'win32', 'linux'].includes(platform)) {
    console.error(`${platform} is NOT supported.`);
    process.exit(1);
}

// Detect AWS Lambda environment
const isLambda = !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_LAMBDA_RUNTIME_API ||
    process.env.LAMBDA_RUNTIME_DIR ||
    process.env._LAMBDA_SERVER_PORT
);

let popplerPath;
let selectedVersionPath = null;

let execOptions = {
    encoding: 'utf8',
    maxBuffer: 5000*1024,
    shell: false
};

// Discover available poppler versions in a directory
function discoverAvailableVersions(basePath, isWindows = false) {
    const versions = [];

    try {
        const entries = fs.readdirSync(basePath);

        for (const entry of entries) {
            // Match versioned folders: poppler-X.XX or poppler-X.XX-xvfb
            const match = entry.match(/^poppler-(\d+\.\d+)(-xvfb)?$/);
            if (match) {
                const versionPath = path.join(basePath, entry);
                const binaryName = isWindows ? 'pdftocairo.exe' : 'pdftocairo';
                const binPath = path.join(versionPath, 'bin', binaryName);

                if (fs.existsSync(binPath)) {
                    versions.push({
                        version: match[1],
                        hasXvfb: match[2] === '-xvfb',
                        path: versionPath
                    });
                }
            }
        }
    } catch (e) {
        // Directory doesn't exist or can't be read
    }

    // Sort by version descending (highest first)
    return versions.sort((a, b) => {
        const [aMajor, aMinor] = a.version.split('.').map(Number);
        const [bMajor, bMinor] = b.version.split('.').map(Number);
        return bMajor - aMajor || bMinor - aMinor;
    });
}

// Select poppler version based on environment and preferences
function selectPopplerVersion(basePath, preferXvfb, isWindows = false) {
    const requestedVersion = process.env.POPPLER_VERSION;
    const versions = discoverAvailableVersions(basePath, isWindows);

    if (requestedVersion) {
        // Look for exact version match
        const xvfbMatch = versions.find(v => v.version === requestedVersion && v.hasXvfb);
        const regularMatch = versions.find(v => v.version === requestedVersion && !v.hasXvfb);

        if (preferXvfb && xvfbMatch) {
            return xvfbMatch.path;
        } else if (regularMatch) {
            return regularMatch.path;
        } else if (xvfbMatch) {
            return xvfbMatch.path;
        }

        // Version not found - throw error with available versions
        const availableVersions = [...new Set(versions.map(v => v.version))];
        throw new Error(
            `Poppler version ${requestedVersion} not found. ` +
            `Available versions: ${availableVersions.length > 0 ? availableVersions.join(', ') : 'none'}`
        );
    }

    // Auto-select: prefer highest version with appropriate variant
    for (const v of versions) {
        if (preferXvfb === v.hasXvfb) {
            return v.path;
        }
    }

    // Fallback to any available version
    return versions.length > 0 ? versions[0].path : null;
}

if (platform === 'win32') {
    const winBasePath = path.join(__dirname, 'lib', 'win');

    // Try versioned folder selection first
    const selectedVersionPath = selectPopplerVersion(winBasePath, false, true);

    if (selectedVersionPath) {
        popplerPath = path.join(selectedVersionPath, 'bin');
    } else {
        // Legacy fallback for backwards compatibility
        popplerPath = path.join(winBasePath, 'poppler-0.51', 'bin');
    }

    // for electron ASAR
    popplerPath = popplerPath.replace(".asar", ".asar.unpacked");
}
else if (platform === 'darwin') {
    popplerPath = path.join(
        __dirname,
        'lib',
        'osx',
        'poppler-0.66',
        'bin'
    );

    let dyldPath = path.join(
        __dirname,
        'lib',
        'osx',
        'poppler-0.66',
        'lib'
    );

    let libRoot = path.join(
        __dirname,
        'lib',
        'osx'
    );

    // for electron ASAR
    popplerPath = popplerPath.replace(".asar", ".asar.unpacked");
    dyldPath = dyldPath.replace(".asar", ".asar.unpacked");
    libRoot = libRoot.replace(".asar", ".asar.unpacked");

    // make files executable
    spawn('chmod', ['-R', '755', `${libRoot}`]);

    // change name for every executables (only in Mac and only if actually on macOS)
    if (process.platform === 'darwin') {
        spawn('install_name_tool', ['-change', `/usr/local/Cellar/poppler/0.66.0/lib/libpoppler.77.dylib`, `${path.join(dyldPath, 'libpoppler.77.0.0.dylib')}`, `${path.join(popplerPath, 'pdfinfo')}`]);
        spawn('install_name_tool', ['-change', `/usr/local/Cellar/poppler/0.66.0/lib/libpoppler.77.dylib`, `${path.join(dyldPath, 'libpoppler.77.0.0.dylib')}`, `${path.join(popplerPath, 'pdftocairo')}`]);
        spawn('install_name_tool', ['-change', `/usr/local/Cellar/poppler/0.66.0/lib/libpoppler.77.dylib`, `${path.join(dyldPath, 'libpoppler.77.0.0.dylib')}`, `${path.join(popplerPath, 'pdfimages')}`]);
    }
}
else if (platform === 'linux') {
    const linuxBasePath = path.join(__dirname, 'lib', 'linux');

    // Determine xvfb preference
    // In Lambda/CI: default to xvfb unless explicitly disabled (xvfb version has bundled libs)
    // Non-Lambda/Non-CI: default to non-xvfb unless explicitly enabled
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const preferXvfb = (isLambda || isCI)
        ? process.env.POPPLER_PREFER_XVFB !== 'false'
        : process.env.POPPLER_PREFER_XVFB === 'true';

    // Check if running in AWS Lambda environment
    if (isLambda) {
        // In Lambda, try to use binaries from /opt (Lambda Layer) first
        if (fs.existsSync('/opt/bin/pdftocairo')) {
            popplerPath = '/opt/bin';
        } else {
            // Try versioned folder selection first
            selectedVersionPath = selectPopplerVersion(linuxBasePath, preferXvfb);

            if (selectedVersionPath) {
                popplerPath = path.join(selectedVersionPath, 'bin');
            } else {
                // Legacy fallback for backwards compatibility
                const legacyXvfb = path.join(linuxBasePath, 'poppler-xvfb-latest', 'bin');
                const legacyRegular = path.join(linuxBasePath, 'poppler-latest', 'bin');

                if (fs.existsSync(path.join(legacyXvfb, 'pdftocairo'))) {
                    popplerPath = legacyXvfb;
                } else {
                    popplerPath = legacyRegular;
                }
            }
        }
    } else {
        // For non-Lambda environments
        selectedVersionPath = selectPopplerVersion(linuxBasePath, preferXvfb);

        if (selectedVersionPath) {
            popplerPath = path.join(selectedVersionPath, 'bin');
        } else {
            // Legacy fallback
            const legacyXvfb = path.join(linuxBasePath, 'poppler-xvfb-latest', 'bin');
            const legacyRegular = path.join(linuxBasePath, 'poppler-latest', 'bin');

            if (preferXvfb && fs.existsSync(path.join(legacyXvfb, 'pdftocairo'))) {
                popplerPath = legacyXvfb;
            } else if (fs.existsSync(path.join(legacyRegular, 'pdftocairo'))) {
                popplerPath = legacyRegular;
            } else if (fs.existsSync(path.join(legacyXvfb, 'pdftocairo'))) {
                popplerPath = legacyXvfb;
            } else {
                popplerPath = legacyRegular;
            }
        }
    }

    // for electron ASAR
    popplerPath = popplerPath.replace(".asar", ".asar.unpacked");

    let libRoot = linuxBasePath.replace(".asar", ".asar.unpacked");

    // Determine the poppler directory (for lib and share paths)
    const popplerDir = selectedVersionPath
        ? selectedVersionPath.replace('.asar', '.asar.unpacked')
        : popplerPath.replace(/[\/\\]bin$/, '');

    // Set up library path for shared libraries
    let libPath = path.join(popplerDir, 'lib');

    // Legacy fallback if lib doesn't exist in selected version
    if (!fs.existsSync(libPath)) {
        libPath = path.join(libRoot, 'poppler-xvfb-latest', 'lib');
        if (!fs.existsSync(libPath)) {
            libPath = path.join(libRoot, 'poppler-latest', 'lib');
        }
    }

    if (fs.existsSync(libPath)) {
        // Add our lib directory to LD_LIBRARY_PATH
        const currentLdPath = process.env.LD_LIBRARY_PATH || '';
        const newLdPath = currentLdPath ? `${libPath}:${currentLdPath}` : libPath;

        // Base environment with library path
        let env = {
            ...process.env,
            LD_LIBRARY_PATH: newLdPath
        };

        // Add Lambda-specific environment variables
        if (isLambda) {
            env.DISPLAY = ':99';
            env.XAUTHORITY = '/tmp/.Xauth';
            // Add Lambda Layer lib paths if they exist
            if (fs.existsSync('/opt/lib')) {
                env.LD_LIBRARY_PATH = `/opt/lib:${env.LD_LIBRARY_PATH}`;
            }
            // Set XKB config path for bundled keyboard config
            const xkbPath = path.join(popplerDir, 'share', 'xkb');
            if (fs.existsSync(xkbPath)) {
                env.XKB_CONFIG_ROOT = xkbPath;
            } else {
                // Legacy fallback
                const legacyXkb = path.join(libRoot, 'poppler-xvfb-latest', 'share', 'xkb');
                if (fs.existsSync(legacyXkb)) {
                    env.XKB_CONFIG_ROOT = legacyXkb;
                }
            }
        }

        execOptions.env = env;
    } else if (isLambda) {
        // Lambda environment without bundled libraries
        execOptions.env = {
            ...process.env,
            DISPLAY: ':99',
            XAUTHORITY: '/tmp/.Xauth',
            LD_LIBRARY_PATH: '/opt/lib:' + (process.env.LD_LIBRARY_PATH || '')
        };
    }

    // make files executable (only for bundled binaries, not Lambda Layer)
    if (!isLambda || !fs.existsSync('/opt/bin/pdftocairo')) {
        spawn('chmod', ['-R', '755', `${libRoot}`]);
    }
}
else {
    console.error(`${platform} is NOT supported.`);
    process.exit(1);
}

// Check if we're using the bundled Xvfb version (versioned or legacy)
const usingBundledXvfb = popplerPath && (popplerPath.includes('-xvfb') || popplerPath.includes('poppler-xvfb-latest'));

// Extract version from path if available
const detectedVersion = popplerPath ? (popplerPath.match(/poppler-(\d+\.\d+)/)?.[1] || null) : null;

// Get available versions for the current platform
function getAvailableVersions() {
    if (platform !== 'linux' && platform !== 'win32') {
        return [];
    }
    try {
        if (platform === 'win32') {
            const winBasePath = path.join(__dirname, 'lib', 'win');
            return discoverAvailableVersions(winBasePath, true);
        } else {
            const linuxBasePath = path.join(__dirname, 'lib', 'linux');
            return discoverAvailableVersions(linuxBasePath);
        }
    } catch (e) {
        return [];
    }
}

module.exports.path = popplerPath;
module.exports.exec_options = execOptions;
module.exports.isLambda = isLambda;
module.exports.hasBundledXvfb = usingBundledXvfb;
module.exports.version = detectedVersion;
module.exports.getAvailableVersions = getAvailableVersions;
module.exports.info = require('./lib/info');
module.exports.imgdata = require('./lib/imgdata');
module.exports.convert = require('./lib/convert');
