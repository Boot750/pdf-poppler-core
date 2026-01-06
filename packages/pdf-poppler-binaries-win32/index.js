const path = require('path');

/**
 * Returns the base path where Windows poppler binaries are located
 * @returns {string} The base path to the Windows binaries directory
 */
function getBinaryPath() {
    return path.join(__dirname, 'lib', 'win');
}

module.exports = {
    getBinaryPath
};
