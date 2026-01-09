const path = require('path');

/**
 * Returns the base path where Linux poppler binaries are located
 * @returns {string} The base path to the Linux binaries directory
 */
function getBinaryPath() {
    return path.join(__dirname, 'lib', 'linux');
}

/**
 * Returns the path to the bundled fontconfig directory
 * @returns {string} The path to fontconfig configuration
 */
function getFontconfigPath() {
    return path.join(__dirname, 'lib', 'fontconfig');
}

/**
 * Returns the path to the bundled fonts directory
 * @returns {string} The path to fonts directory
 */
function getFontsPath() {
    return path.join(__dirname, 'lib', 'fonts');
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
