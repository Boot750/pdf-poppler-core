const path = require('path');
const {execFile} = require('child_process');
const fs = require('fs');

const FORMATS = ['png', 'jpeg', 'tiff', 'pdf', 'ps', 'eps', 'svg'];
const EXEC_OPTS = require('../index').exec_options;
const isLambda = require('../index').isLambda;

let popplerPath = require('../index').path;

let defaultOptions = {
    format: 'jpeg',
    scale: 1024,
    out_dir: null,
    out_prefix: null,
    page: null
};

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

/**
 * Validates output directory for security
 * @param {string} outDir - The output directory path
 * @throws {Error} If validation fails
 */
function validateOutputDir(outDir) {
    if (typeof outDir !== 'string') {
        throw new Error('Output directory must be a string');
    }
    if (outDir.includes('\0')) {
        throw new Error('Invalid output directory: null bytes detected');
    }
    const resolvedDir = path.resolve(outDir);
    if (!fs.existsSync(resolvedDir)) {
        throw new Error(`Output directory not found: ${resolvedDir}`);
    }
    const stats = fs.statSync(resolvedDir);
    if (!stats.isDirectory()) {
        throw new Error('Output path is not a directory');
    }
    return resolvedDir;
}

/**
 * Validates output prefix for security
 * @param {string} prefix - The output filename prefix
 * @throws {Error} If validation fails
 */
function validateOutputPrefix(prefix) {
    if (typeof prefix !== 'string') {
        throw new Error('Output prefix must be a string');
    }
    if (prefix.includes('\0')) {
        throw new Error('Invalid output prefix: null bytes detected');
    }
    if (prefix.includes('/') || prefix.includes('\\') || prefix.includes('..')) {
        throw new Error('Output prefix cannot contain path separators');
    }
    return prefix;
}

// module.exports = function (file, out_file, page_start, page_end) {
module.exports = function (file, opts) {
    return new Promise((resolve, reject) => {
        // Validate input file
        let validatedFile;
        try {
            validatedFile = validatePdfPath(file);
        } catch (err) {
            return reject(err);
        }

        opts.format = FORMATS.includes(opts.format) ? opts.format : defaultOptions.format;
        if (opts.scale === undefined) {
            opts.scale = defaultOptions.scale;
        }

        // Validate and set output directory
        let validatedOutDir;
        try {
            validatedOutDir = validateOutputDir(opts.out_dir || path.dirname(validatedFile));
        } catch (err) {
            return reject(err);
        }

        // Validate and set output prefix
        let validatedPrefix;
        try {
            validatedPrefix = validateOutputPrefix(opts.out_prefix || path.basename(validatedFile, path.extname(validatedFile)));
        } catch (err) {
            return reject(err);
        }

        opts.page = opts.page || defaultOptions.page;

        let args = [];
        args.push(`-${opts.format}`);
        if (opts.page) {
            args.push('-f');
            args.push(parseInt(opts.page).toString());
            args.push('-l');
            args.push(parseInt(opts.page).toString());
        }
        if (opts.scale && opts.scale !== null) {
            args.push('-scale-to');
            args.push(parseInt(opts.scale).toString());
        }
        args.push(validatedFile);
        args.push(path.join(validatedOutDir, validatedPrefix));

        // Prepare command and arguments for execution
        let command = path.join(popplerPath, 'pdftocairo');
        let execArgs = args;
        let execOptions = { ...EXEC_OPTS };
        
        // Ensure environment from index.js is preserved (especially LD_LIBRARY_PATH)
        if (EXEC_OPTS.env) {
            execOptions.env = { ...process.env, ...EXEC_OPTS.env };
        }

        // Headless environment handling (Lambda, CI, etc.)
        // Only use xvfb-run if DISPLAY is not already set (e.g., CI already runs inside xvfb-run)
        const needsVirtualDisplay = !process.env.DISPLAY && (
            isLambda ||
            process.env.CI === 'true' ||
            process.env.GITHUB_ACTIONS === 'true' ||
            process.env.JEST_WORKER_ID
        );

        if (needsVirtualDisplay && process.platform === 'linux') {
            // Check if xvfb-run is available (prioritize bundled version)
            const bundledXvfbPath = path.join(popplerPath, 'xvfb-run');
            const xvfbPaths = [bundledXvfbPath, '/opt/bin/xvfb-run', '/usr/bin/xvfb-run'];
            let xvfbFound = false;

            for (const xvfbPath of xvfbPaths) {
                if (fs.existsSync(xvfbPath)) {
                    // For bundled xvfb-run (which is a bash script), we need to invoke it through bash
                    // because execFile with shell:false can't handle shebang scripts
                    if (xvfbPath === bundledXvfbPath) {
                        command = '/bin/bash';
                        execArgs = [bundledXvfbPath, path.join(popplerPath, 'pdftocairo'), ...args];
                    } else {
                        command = xvfbPath;
                        execArgs = ['-a', '--server-args=-screen 0 1024x768x24', path.join(popplerPath, 'pdftocairo'), ...args];
                    }

                    xvfbFound = true;

                    // Ensure environment variables are properly passed to xvfb-run
                    // This is critical for system xvfb-run to find our bundled libraries
                    execOptions.env = {
                        ...process.env,
                        ...execOptions.env,
                        // Explicitly set DISPLAY for virtual display
                        DISPLAY: ':99'
                    };
                    break;
                }
            }
            
            // If xvfb-run is not available, set up minimal display environment
            if (!xvfbFound) {
                execOptions.env = {
                    ...process.env,
                    ...execOptions.env,
                    DISPLAY: ':99',
                    XAUTHORITY: '/tmp/.Xauth'
                };
            }
        }


        execFile(command, execArgs, execOptions, (err, stdout, stderr) => {
            if (err) {
                const errorMsg = stderr ? `${err.message}\nStderr: ${stderr}` : err.message;
                reject(new Error(errorMsg));
            } else {
                resolve(stdout);
            }
        });
    });
};