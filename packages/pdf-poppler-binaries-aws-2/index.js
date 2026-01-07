const path = require('path');

/**
 * Returns the base path where AWS Lambda (Amazon Linux 2) poppler binaries are located
 * @returns {string} The base path to the AWS Lambda binaries directory
 */
function getBinaryPath() {
    return path.join(__dirname, 'lib', 'aws-2');
}

module.exports = {
    getBinaryPath
};
