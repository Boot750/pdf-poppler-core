const path = require('path');

/**
 * Returns the base path where Linux poppler binaries are located
 * @returns {string} The base path to the Linux binaries directory
 */
function getBinaryPath() {
    return path.join(__dirname, 'lib', 'linux');
}

module.exports = {
    getBinaryPath
};
