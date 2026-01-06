const path = require('path');
const fs = require('fs');
const {execFile} = require('child_process');
const EXEC_OPTS = require('../index').exec_options;

let popplerPath = require('../index').path;

/**
 * Validates a PDF file path for security
 * @param {string} file - The file path to validate
 * @throws {Error} If validation fails
 */
function validatePdfPath(file) {
    if (typeof file !== 'string') {
        throw new Error('File path must be a string');
    }
    if (file.includes('\0')) {
        throw new Error('Invalid file path: null bytes detected');
    }
    const resolvedPath = path.resolve(file);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File not found: ${resolvedPath}`);
    }
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
        throw new Error('Path is not a file');
    }
    if (!resolvedPath.toLowerCase().endsWith('.pdf')) {
        throw new Error('File must have .pdf extension');
    }
    return resolvedPath;
}

module.exports = function (file) {
    return new Promise((resolve, reject) => {
        // Validate input file
        let validatedFile;
        try {
            validatedFile = validatePdfPath(file);
        } catch (err) {
            return reject(err);
        }

        execFile(path.join(popplerPath, 'pdfinfo'), [validatedFile], EXEC_OPTS, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            else {
                let nfo = stdout.split(/\r?\n/);
                nfoObj = {};
                nfo.forEach(node => {
                    // split by first colon
                    let n = node.replace(/(^:)|(:$)/, '').split(/:(.+)/);
                    if (n[0]) {
                        nfoObj[n[0].replace(/ /g, "_").toLowerCase()] = n[1].trim();
                    }
                });

                let d = nfoObj['page_size'].split('x');

                // find dimensions in pixel
                nfoObj['width_in_pts'] = parseFloat(d[0]);
                nfoObj['height_in_pts'] = parseFloat(d[1]);

                // nfoObj['width_in_px'] = parseFloat(d[0])*96/72;
                // nfoObj['height_in_px'] = parseFloat(d[1])*96/72;

                resolve(nfoObj);
            }
        });
    });
};
