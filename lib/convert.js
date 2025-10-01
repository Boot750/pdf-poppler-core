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

        // Headless environment handling (Lambda, CI, etc.)
        const needsVirtualDisplay = isLambda || 
            process.env.CI === 'true' || 
            process.env.GITHUB_ACTIONS === 'true' ||
            process.env.JEST_WORKER_ID ||
            !process.env.DISPLAY;

        if (needsVirtualDisplay && process.platform === 'linux') {
            // Check if xvfb-run is available (Lambda Layer, CI, or system)
            const xvfbPaths = ['/opt/bin/xvfb-run', '/usr/bin/xvfb-run'];
            let xvfbFound = false;
            
            for (const xvfbPath of xvfbPaths) {
                if (fs.existsSync(xvfbPath)) {
                    command = xvfbPath;
                    execArgs = ['-a', '--server-args=-screen 0 1024x768x24', path.join(popplerPath, 'pdftocairo'), ...args];
                    xvfbFound = true;
                    break;
                }
            }
            
            // If xvfb-run is not available, set up minimal display environment
            if (!xvfbFound) {
                execOptions.env = {
                    ...execOptions.env,
                    DISPLAY: ':99',
                    XAUTHORITY: '/tmp/.Xauth'
                };
            }
        }

        // Debug logging for test environment
        if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID || typeof jest !== 'undefined') {
            console.log('Convert DEBUG - Command:', command);
            console.log('Convert DEBUG - Args:', execArgs);
            console.log('Convert DEBUG - Exec options:', JSON.stringify(execOptions, null, 2));
            console.log('Convert DEBUG - Is Lambda:', isLambda);
            console.log('Convert DEBUG - Needs virtual display:', needsVirtualDisplay);
            console.log('Convert DEBUG - Using xvfb-run:', command.includes('xvfb-run'));
            console.log('Convert DEBUG - Environment DISPLAY:', execOptions.env?.DISPLAY);
        }

        execFile(command, execArgs, execOptions, (err, stdout, stderr) => {
            // Debug logging for test environment
            if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID || typeof jest !== 'undefined') {
                console.log('Convert DEBUG - Error:', err);
                console.log('Convert DEBUG - Stdout:', stdout);
                console.log('Convert DEBUG - Stderr:', stderr);
            }
            
            if (err) {
                reject(err);
            }
            else {
                resolve(stdout);
            }
        });
    });
};