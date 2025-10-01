const os = require('os');
const path = require('path');
const {spawn} = require('child_process');

let platform = os.platform();
if (!['darwin', 'win32', 'linux'].includes(platform)) {
    console.error(`${platform} is NOT supported.`);
    process.exit(1);
}

// Detect AWS Lambda environment
const isLambda = !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_LAMBDA_RUNTIME_API ||
    process.env.LAMBDA_RUNTIME_DIR ||
    process.env._LAMBDA_SERVER_PORT
);

let popplerPath;

let execOptions = {
    encoding: 'utf8',
    maxBuffer: 5000*1024,
    shell: false
};

// Lambda-specific environment setup will be merged with LD_LIBRARY_PATH later

if (platform === 'win32') {
    popplerPath = path.join(
        __dirname,
        'lib',
        'win',
        'poppler-0.51',
        'bin'
    );

    // for electron ASAR
    popplerPath = popplerPath.replace(".asar", ".asar.unpacked");
}
else if (platform === 'darwin') {
    popplerPath = path.join(
        __dirname,
        'lib',
        'osx',
        'poppler-latest',
        'bin'
    );

    let dyldPath = path.join(
        __dirname,
        'lib',
        'osx',
        'poppler-latest',
        'lib'
    );

    let libRoot = path.join(
        __dirname,
        'lib',
        'osx'
    );

    // for electron ASAR
    popplerPath = popplerPath.replace(".asar", ".asar.unpacked");
    dyldPath = dyldPath.replace(".asar", ".asar.unpacked");
    libRoot = libRoot.replace(".asar", ".asar.unpacked");

    // make files executable
    spawn('chmod', ['-R', '755', `${libRoot}`]);

    // change name for every executables (only in Mac and only if actually on macOS)
    if (process.platform === 'darwin') {
        spawn('install_name_tool', ['-change', `/usr/local/Cellar/poppler/0.66.0/lib/libpoppler.77.dylib`, `${path.join(dyldPath, 'libpoppler.77.0.0.dylib')}`, `${path.join(popplerPath, 'pdfinfo')}`]);
        spawn('install_name_tool', ['-change', `/usr/local/Cellar/poppler/0.66.0/lib/libpoppler.77.dylib`, `${path.join(dyldPath, 'libpoppler.77.0.0.dylib')}`, `${path.join(popplerPath, 'pdftocairo')}`]);
        spawn('install_name_tool', ['-change', `/usr/local/Cellar/poppler/0.66.0/lib/libpoppler.77.dylib`, `${path.join(dyldPath, 'libpoppler.77.0.0.dylib')}`, `${path.join(popplerPath, 'pdfimages')}`]);
    }
}
else if (platform === 'linux') {
    // Check if running in AWS Lambda environment
    if (isLambda) {
        // In Lambda, try to use binaries from /opt (Lambda Layer) first
        if (require('fs').existsSync('/opt/bin/pdftocairo')) {
            popplerPath = '/opt/bin';
        } else {
            // Check for bundled Xvfb version first (includes virtual display)
            const xvfbBundlePath = path.join(__dirname, 'lib', 'linux', 'poppler-xvfb-latest', 'bin');
            if (require('fs').existsSync(path.join(xvfbBundlePath, 'pdftocairo'))) {
                popplerPath = xvfbBundlePath;
            } else {
                // Fallback to regular bundled binaries
                popplerPath = path.join(__dirname, 'lib', 'linux', 'poppler-latest', 'bin');
            }
        }
    } else {
        // For non-Lambda environments, prefer bundled Xvfb version if available
        const xvfbBundlePath = path.join(__dirname, 'lib', 'linux', 'poppler-xvfb-latest', 'bin');
        if (require('fs').existsSync(path.join(xvfbBundlePath, 'pdftocairo'))) {
            popplerPath = xvfbBundlePath;
        } else {
            popplerPath = path.join(__dirname, 'lib', 'linux', 'poppler-latest', 'bin');
        }
    }

    // for electron ASAR
    popplerPath = popplerPath.replace(".asar", ".asar.unpacked");

    let libRoot = path.join(
        __dirname,
        'lib',
        'linux'
    );

    // for electron ASAR
    libRoot = libRoot.replace(".asar", ".asar.unpacked");

    // Set up library path for shared libraries
    // Check for bundled Xvfb version first
    let libPath = path.join(libRoot, 'poppler-xvfb-latest', 'lib');
    if (!require('fs').existsSync(libPath)) {
        libPath = path.join(libRoot, 'poppler-latest', 'lib');
    }
    
    if (require('fs').existsSync(libPath)) {
        // Add our lib directory to LD_LIBRARY_PATH
        const currentLdPath = process.env.LD_LIBRARY_PATH || '';
        const newLdPath = currentLdPath ? `${libPath}:${currentLdPath}` : libPath;
        
        // Base environment with library path
        let env = {
            ...process.env,
            LD_LIBRARY_PATH: newLdPath
        };
        
        // Add Lambda-specific environment variables
        if (isLambda) {
            env.DISPLAY = ':99';
            env.XAUTHORITY = '/tmp/.Xauth';
            // Add Lambda Layer lib paths if they exist
            if (require('fs').existsSync('/opt/lib')) {
                env.LD_LIBRARY_PATH = `/opt/lib:${env.LD_LIBRARY_PATH}`;
            }
        }
        
        execOptions.env = env;
    } else if (isLambda) {
        // Lambda environment without bundled libraries
        execOptions.env = {
            ...process.env,
            DISPLAY: ':99',
            XAUTHORITY: '/tmp/.Xauth',
            LD_LIBRARY_PATH: '/opt/lib:' + (process.env.LD_LIBRARY_PATH || '')
        };
    }

    // make files executable (only for bundled binaries, not Lambda Layer)
    if (!isLambda || !require('fs').existsSync('/opt/bin/pdftocairo')) {
        spawn('chmod', ['-R', '755', `${libRoot}`]);
    }
}
else {
    console.error(`${platform} is NOT supported.`);
    process.exit(1);
}

// Check if we're using the bundled Xvfb version
const usingBundledXvfb = popplerPath && popplerPath.includes('poppler-xvfb-latest');

module.exports.path = popplerPath;
module.exports.exec_options = execOptions;
module.exports.isLambda = isLambda;
module.exports.hasBundledXvfb = usingBundledXvfb;
module.exports.info = require('./lib/info');
module.exports.imgdata = require('./lib/imgdata');
module.exports.convert = require('./lib/convert');
