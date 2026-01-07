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

        execFile(path.join(popplerPath, 'pdfimages'), [validatedFile, '-list'], EXEC_OPTS, (error, stdout, stderr) => {
            if (error) {
                // Only log errors in non-test environments to avoid cluttering test output
                if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
                    console.error(error);
                }
                reject(error);
            }
            else {
                let nfo = stdout.trim().split(/\r?\n/);

                nfo[0] = nfo[0].replace(/  +/g, ' ').trim();
                let titles = nfo[0].split(/ /);

                let data = [];
                for (i = 2; i < nfo.length; i++) {
                    let o = {};
                    nfo[i] = nfo[i].replace(/  +/g, ' ').trim();
                    let d = nfo[i].split(/ /);
                    o[titles[0]] = d[0];
                    o[titles[1]] = d[1];
                    o[titles[2]] = d[2];
                    o[titles[3]] = d[3];
                    o[titles[4]] = d[4];
                    o[titles[5]] = d[5];
                    o[titles[6]] = d[6];
                    o[titles[7]] = d[7];
                    o[titles[8]] = d[8];
                    o[titles[9]] = d[9];
                    o[titles[10]] = d[10];
                    o[titles[11]] = d[11];
                    o[titles[12]] = d[12];
                    o[titles[13]] = d[13];
                    o[titles[14]] = d[14];
                    o[titles[15]] = d[15];
                    data.push(o);
                }
                resolve(data);
            }
        });
    });
};
