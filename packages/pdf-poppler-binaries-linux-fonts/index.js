const path = require('path');
const fs = require('fs');

const PACKAGE_NAME = 'pdf-poppler-binaries-linux-fonts';

/**
 * Finds the actual package location, handling bundled environments.
 * When code is bundled by esbuild/webpack, __dirname points to the bundled location,
 * not the original package location. This function checks multiple fallback paths.
 * @returns {string} The base path to the package's lib directory
 */
function findLibPath() {
    // Try __dirname first (works in non-bundled environments)
    const localLib = path.join(__dirname, 'lib');
    if (fs.existsSync(localLib)) {
        return localLib;
    }

    // Fallback paths for bundled environments (Lambda, containers)
    const fallbackPaths = [
        // Standard Lambda node_modules location
        `/var/task/node_modules/${PACKAGE_NAME}/lib`,
        // Lambda layer location
        `/opt/nodejs/node_modules/${PACKAGE_NAME}/lib`,
        // Alternative layer path
        `/opt/node_modules/${PACKAGE_NAME}/lib`,
    ];

    for (const fallbackPath of fallbackPaths) {
        if (fs.existsSync(fallbackPath)) {
            return fallbackPath;
        }
    }

    // If nothing found, return the __dirname path (will show in error messages)
    return localLib;
}

// Cache the lib path
let cachedLibPath = null;

function getLibPath() {
    if (cachedLibPath === null) {
        cachedLibPath = findLibPath();
    }
    return cachedLibPath;
}

/**
 * Returns the base path where Linux poppler binaries are located
 * @returns {string} The base path to the Linux binaries directory
 */
function getBinaryPath() {
    return path.join(getLibPath(), 'linux');
}

/**
 * Returns the path to the bundled fontconfig directory
 * @returns {string} The path to fontconfig configuration
 */
function getFontconfigPath() {
    return path.join(getLibPath(), 'fontconfig');
}

/**
 * Returns the path to the bundled fonts directory
 * @returns {string} The path to fonts directory
 */
function getFontsPath() {
    return path.join(getLibPath(), 'fonts');
}

/**
 * Returns environment variables needed for fontconfig to work with bundled fonts
 * @returns {object} Environment variables to merge with process.env
 */
function getFontconfigEnv() {
    const fontconfigPath = getFontconfigPath();
    return {
        FONTCONFIG_PATH: fontconfigPath,
        FONTCONFIG_FILE: path.join(fontconfigPath, 'fonts.conf'),
        FC_CACHEDIR: '/tmp/fontconfig-cache'
    };
}

module.exports = {
    getBinaryPath,
    getFontconfigPath,
    getFontsPath,
    getFontconfigEnv
};
