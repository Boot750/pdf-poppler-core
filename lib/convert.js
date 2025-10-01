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

// module.exports = function (file, out_file, page_start, page_end) {
module.exports = function (file, opts) {
    return new Promise((resolve, reject) => {
        opts.format = FORMATS.includes(opts.format) ? opts.format : defaultOptions.format;
        if (opts.scale === undefined) {
            opts.scale = defaultOptions.scale;
        }
        opts.out_dir = opts.out_dir || path.dirname(file);
        opts.out_prefix = opts.out_prefix || path.basename(file, path.extname(file));
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
        args.push(`${file}`);
        args.push(`${path.join(opts.out_dir, opts.out_prefix)}`);

        // Prepare command and arguments for execution
        let command = path.join(popplerPath, 'pdftocairo');
        let execArgs = args;
        let execOptions = { ...EXEC_OPTS };
        
        // Ensure environment from index.js is preserved (especially LD_LIBRARY_PATH)
        if (EXEC_OPTS.env) {
            execOptions.env = { ...process.env, ...EXEC_OPTS.env };
        }

        // Headless environment handling (Lambda, CI, etc.)
        const needsVirtualDisplay = isLambda || 
            process.env.CI === 'true' || 
            process.env.GITHUB_ACTIONS === 'true' ||
            process.env.JEST_WORKER_ID ||
            !process.env.DISPLAY;

        if (needsVirtualDisplay && process.platform === 'linux') {
            // Check if xvfb-run is available (prioritize bundled version)
            const bundledXvfbPath = path.join(popplerPath, 'xvfb-run');
            const xvfbPaths = [bundledXvfbPath, '/opt/bin/xvfb-run', '/usr/bin/xvfb-run'];
            let xvfbFound = false;
            
            for (const xvfbPath of xvfbPaths) {
                if (fs.existsSync(xvfbPath)) {
                    command = xvfbPath;
                    
                    // For bundled xvfb-run, use simpler arguments (it handles Xvfb internally)
                    if (xvfbPath === bundledXvfbPath) {
                        execArgs = [path.join(popplerPath, 'pdftocairo'), ...args];
                    } else {
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
                reject(err);
            }
            else {
                resolve(stdout);
            }
        });
    });
};