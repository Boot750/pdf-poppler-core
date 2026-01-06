const path = require('path');

/**
 * Returns the base path where macOS poppler binaries are located
 * @returns {string} The base path to the macOS binaries directory
 */
function getBinaryPath() {
    return path.join(__dirname, 'lib', 'osx');
}

module.exports = {
    getBinaryPath
};
