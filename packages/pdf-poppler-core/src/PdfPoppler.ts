import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { execFile, spawn, ExecFileOptions } from 'child_process';
import { Readable, PassThrough } from 'stream';
import {
  PdfPopplerConfig,
  ConvertOptions,
  PdfInfo,
  ImageData,
  VersionInfo,
  Platform,
  ResolvedConfig,
  OutputFormat,
  PdfInput,
  PageResult,
  PageStreamResult,
} from './types';
import { PdfPopplerConfigBuilder, configure } from './PdfPopplerConfig';
import { BinaryResolver } from './platform/BinaryResolver';
import { EnvironmentDetector } from './platform/EnvironmentDetector';

/** Valid output formats */
const FORMATS: OutputFormat[] = ['png', 'jpeg', 'tiff', 'pdf', 'ps', 'eps', 'svg'];

/**
 * Main class for PDF operations using Poppler
 *
 * All operations accept Buffer, Uint8Array, or Readable stream as input.
 * Output is returned as Buffer or Readable stream (no file I/O).
 *
 * @example
 * ```typescript
 * import { PdfPoppler } from 'pdf-poppler-core';
 * import * as fs from 'fs';
 *
 * const poppler = new PdfPoppler();
 * const pdfBuffer = fs.readFileSync('input.pdf');
 *
 * // Get PDF info
 * const info = await poppler.info(pdfBuffer);
 * console.log(`Pages: ${info.pages}`);
 *
 * // Convert to image buffers
 * const pages = await poppler.convert(pdfBuffer, { format: 'png' });
 * pages.forEach(({ page, data }) => {
 *   fs.writeFileSync(`page-${page}.png`, data);
 * });
 *
 * // Or get streams for piping
 * const streams = await poppler.convertToStream(pdfBuffer, { format: 'png' });
 * streams[0].stream.pipe(fs.createWriteStream('page-1.png'));
 *
 * // Flatten PDF (returns buffer)
 * const flattened = await poppler.flatten(pdfBuffer);
 * ```
 */
export class PdfPoppler {
  private readonly resolvedConfig: ResolvedConfig;
  private readonly binaryPath: string;
  private readonly execOptions: ExecFileOptions;
  private readonly envDetector: EnvironmentDetector;
  private readonly fontconfigEnv: Record<string, string> | null;

  /**
   * Create a new PdfPoppler instance
   * @param config - Configuration options (uses smart defaults if not provided)
   */
  constructor(config: PdfPopplerConfig = {}) {
    this.envDetector = new EnvironmentDetector();

    // Resolve configuration with smart defaults
    this.resolvedConfig = this.resolveConfig(config);

    // Resolve binary path based on final configuration
    const resolver = new BinaryResolver(this.resolvedConfig);
    this.binaryPath = resolver.resolve();

    // Get fontconfig env if available (from fonts package)
    this.fontconfigEnv = resolver.getFontconfigEnv();

    // Build exec options
    this.execOptions = this.buildExecOptions();

    // Make binaries executable on Unix
    this.ensureExecutable();
  }

  // ===================
  // Static Factory Methods
  // ===================

  /**
   * Create a configuration builder
   */
  static configure(): PdfPopplerConfigBuilder {
    return configure();
  }

  /**
   * Create instance from a builder
   */
  static fromConfig(builder: PdfPopplerConfigBuilder): PdfPoppler {
    return new PdfPoppler(builder.build());
  }

  /**
   * Create instance optimized for AWS Lambda
   */
  static forLambda(config: Partial<PdfPopplerConfig> = {}): PdfPoppler {
    return new PdfPoppler({
      isLambda: true,
      preferXvfb: true,
      ...config,
    });
  }

  /**
   * Create instance optimized for CI environments
   */
  static forCI(config: Partial<PdfPopplerConfig> = {}): PdfPoppler {
    return new PdfPoppler({
      isCI: true,
      preferXvfb: true,
      ...config,
    });
  }

  /**
   * Create instance with auto-detected settings
   */
  static autoDetect(): PdfPoppler {
    return new PdfPoppler();
  }

  /**
   * Create instance with a custom binary path
   */
  static withBinaryPath(
    binaryPath: string,
    config: Partial<PdfPopplerConfig> = {}
  ): PdfPoppler {
    return new PdfPoppler({
      binaryPath,
      ...config,
    });
  }

  // ===================
  // Main Operations
  // ===================

  /**
   * Get PDF metadata
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   */
  async info(input: PdfInput): Promise<PdfInfo> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdfinfo'));

    return new Promise((resolve, reject) => {
      const proc = spawn(binary, ['-'], {
        ...this.execOptions,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error: Error) => {
        reject(this.wrapError(error, stderr));
      });

      proc.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`pdfinfo exited with code ${code}\nStderr: ${stderr}`));
        } else {
          resolve(this.parseInfo(stdout));
        }
      });

      proc.stdin.write(pdfBuffer);
      proc.stdin.end();
    });
  }

  /**
   * Convert PDF pages to image buffers
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @param options - Conversion options
   * @returns Array of { page, data: Buffer } for each page
   */
  async convert(input: PdfInput, options: ConvertOptions = {}): Promise<PageResult[]> {
    const pdfBuffer = await this.inputToBuffer(input);

    // Get page count
    const pdfInfo = await this.info(pdfBuffer);
    const pageCount = parseInt(pdfInfo.pages, 10);

    // Determine which pages to convert
    const startPage = options.page ?? 1;
    const endPage = options.page ?? pageCount;

    const results: PageResult[] = [];

    // Process each page (pdftocairo stdout only supports single page)
    for (let page = startPage; page <= endPage; page++) {
      const pageBuffer = await this.convertSinglePageToBuffer(pdfBuffer, page, options);
      results.push({ page, data: pageBuffer });
    }

    return results;
  }

  /**
   * Convert PDF pages to streams (for piping/streaming)
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @param options - Conversion options
   * @returns Array of { page, stream: Readable } for each page
   */
  async convertToStream(input: PdfInput, options: ConvertOptions = {}): Promise<PageStreamResult[]> {
    const pdfBuffer = await this.inputToBuffer(input);

    // Get page count
    const pdfInfo = await this.info(pdfBuffer);
    const pageCount = parseInt(pdfInfo.pages, 10);

    // Determine which pages to convert
    const startPage = options.page ?? 1;
    const endPage = options.page ?? pageCount;

    const results: PageStreamResult[] = [];

    // Process each page
    for (let page = startPage; page <= endPage; page++) {
      const stream = this.convertSinglePageToStream(pdfBuffer, page, options);
      results.push({ page, stream });
    }

    return results;
  }

  /**
   * Flatten PDF (render form fields and annotations to static content)
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @returns Flattened PDF as Buffer
   */
  async flatten(input: PdfInput): Promise<Buffer> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdftocairo'));

    // Use '-' for both stdin input and stdout output
    const args = ['-pdf', '-', '-'];

    return new Promise((resolve, reject) => {
      const proc = spawn(binary, args, {
        ...this.execOptions,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const chunks: Buffer[] = [];
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error: Error) => {
        reject(this.wrapError(error, stderr));
      });

      proc.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`pdftocairo exited with code ${code}\nStderr: ${stderr}`));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });

      proc.stdin.write(pdfBuffer);
      proc.stdin.end();
    });
  }

  /**
   * Flatten PDF and return as stream
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @returns Flattened PDF as Readable stream
   */
  async flattenToStream(input: PdfInput): Promise<Readable> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdftocairo'));
    const passThrough = new PassThrough();

    const args = ['-pdf', '-', '-'];

    const proc = spawn(binary, args, {
      ...this.execOptions,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout.pipe(passThrough);

    proc.stderr.on('data', (data: Buffer) => {
      // Could emit as warning or store for debugging
    });

    proc.on('error', (err: Error) => {
      passThrough.destroy(err);
    });

    proc.stdin.write(pdfBuffer);
    proc.stdin.end();

    return passThrough;
  }

  /**
   * Get embedded image metadata from PDF
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   */
  async imgdata(input: PdfInput): Promise<ImageData[]> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdfimages'));

    // On Linux, use /dev/stdin to avoid temp files
    if (this.resolvedConfig.platform === 'linux') {
      return new Promise((resolve, reject) => {
        const proc = spawn(binary, ['/dev/stdin', '-list'], {
          ...this.execOptions,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on('error', (error: Error) => {
          reject(this.wrapError(error, stderr));
        });

        proc.on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`pdfimages exited with code ${code}\nStderr: ${stderr}`));
          } else {
            resolve(this.parseImgdata(stdout));
          }
        });

        proc.stdin.write(pdfBuffer);
        proc.stdin.end();
      });
    }

    // On Windows, we must use a temp file (no /dev/stdin)
    const tempDir = os.tmpdir();
    const tempFile = path.join(
      tempDir,
      `pdf-poppler-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.pdf`
    );

    try {
      fs.writeFileSync(tempFile, pdfBuffer);

      return await new Promise((resolve, reject) => {
        execFile(
          binary,
          [tempFile, '-list'],
          this.execOptions,
          (error, stdout, stderr) => {
            if (error) {
              return reject(this.wrapError(error, stderr as string));
            }
            resolve(this.parseImgdata(stdout as string));
          }
        );
      });
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // ===================
  // Utility Methods
  // ===================

  /**
   * Get the resolved binary path
   */
  getPath(): string {
    return this.binaryPath;
  }

  /**
   * Get current exec options
   */
  getExecOptions(): ExecFileOptions {
    return { ...this.execOptions };
  }

  /**
   * Check if running in Lambda environment
   */
  isLambdaEnvironment(): boolean {
    return this.resolvedConfig.isLambda;
  }

  /**
   * Check if using bundled xvfb
   */
  hasBundledXvfb(): boolean {
    return (
      this.binaryPath.includes('-xvfb') ||
      this.binaryPath.includes('poppler-xvfb')
    );
  }

  /**
   * Get detected poppler version
   */
  getVersion(): string | null {
    const match = this.binaryPath.match(/poppler-(\d+\.\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Get available versions for current platform
   */
  getAvailableVersions(): VersionInfo[] {
    const resolver = new BinaryResolver(this.resolvedConfig);
    return resolver.discoverVersions();
  }

  /**
   * Get the resolved configuration
   */
  getConfig(): Readonly<ResolvedConfig> {
    return { ...this.resolvedConfig };
  }

  // ===================
  // Private Methods
  // ===================

  /**
   * Resolve user config with smart defaults
   */
  private resolveConfig(userConfig: PdfPopplerConfig): ResolvedConfig {
    const envConfig = this.loadEnvironmentConfig();
    const platform = (userConfig.platform ??
      envConfig.platform ??
      os.platform()) as Platform;
    const isLambda =
      userConfig.isLambda ?? envConfig.isLambda ?? this.envDetector.isLambda();
    const isCI = userConfig.isCI ?? envConfig.isCI ?? this.envDetector.isCI();

    // In headless environments, default to xvfb unless explicitly disabled
    const isHeadless = isLambda || isCI;
    const preferXvfb =
      userConfig.preferXvfb ??
      envConfig.preferXvfb ??
      (isHeadless ? process.env.POPPLER_PREFER_XVFB !== 'false' : false);

    return {
      platform,
      isLambda,
      isCI,
      preferXvfb,
      binaryPath: userConfig.binaryPath ?? envConfig.binaryPath,
      binaryPackage: userConfig.binaryPackage ?? envConfig.binaryPackage,
      version: userConfig.version ?? envConfig.version,
      execOptions: {
        encoding: 'utf8' as BufferEncoding,
        maxBuffer:
          userConfig.execOptions?.maxBuffer ??
          envConfig.execOptions?.maxBuffer ??
          5000 * 1024,
        timeout: userConfig.execOptions?.timeout ?? envConfig.execOptions?.timeout,
        env: { ...envConfig.execOptions?.env, ...userConfig.execOptions?.env },
      },
    };
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentConfig(): Partial<PdfPopplerConfig> {
    return {
      binaryPath: process.env.POPPLER_BINARY_PATH,
      binaryPackage: process.env.POPPLER_BINARY_PACKAGE,
      version: process.env.POPPLER_VERSION,
      preferXvfb:
        process.env.POPPLER_PREFER_XVFB !== undefined
          ? process.env.POPPLER_PREFER_XVFB === 'true'
          : undefined,
    };
  }

  /**
   * Build exec options for child_process
   */
  private buildExecOptions(): ExecFileOptions {
    const options: ExecFileOptions = {
      encoding: this.resolvedConfig.execOptions.encoding,
      maxBuffer: this.resolvedConfig.execOptions.maxBuffer,
      timeout: this.resolvedConfig.execOptions.timeout,
      shell: false,
    };

    // Platform-specific environment setup
    if (this.resolvedConfig.platform === 'linux') {
      options.env = this.buildLinuxEnv();
    } else {
      options.env = { ...process.env };
    }

    // Merge user-provided env
    if (this.resolvedConfig.execOptions.env) {
      options.env = { ...options.env, ...this.resolvedConfig.execOptions.env };
    }

    return options;
  }

  /**
   * Build environment variables for Linux
   */
  private buildLinuxEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };

    // Set up library path
    const popplerDir = this.binaryPath.replace(/[\/\\]bin$/, '');
    const libPath = path.join(popplerDir, 'lib');

    if (fs.existsSync(libPath)) {
      env.LD_LIBRARY_PATH = env.LD_LIBRARY_PATH
        ? `${libPath}:${env.LD_LIBRARY_PATH}`
        : libPath;
    }

    // Add fontconfig environment variables if available (from fonts package)
    if (this.fontconfigEnv) {
      Object.assign(env, this.fontconfigEnv);
    }

    // Lambda-specific settings
    if (this.resolvedConfig.isLambda) {
      env.DISPLAY = ':99';
      env.XAUTHORITY = '/tmp/.Xauth';

      // Add Lambda Layer lib paths if they exist
      if (fs.existsSync('/opt/lib')) {
        env.LD_LIBRARY_PATH = `/opt/lib:${env.LD_LIBRARY_PATH || ''}`;
      }

      // Set XKB config path for bundled keyboard config
      const xkbPath = path.join(popplerDir, 'share', 'xkb');
      if (fs.existsSync(xkbPath)) {
        env.XKB_CONFIG_ROOT = xkbPath;
      }
    }

    return env;
  }

  /**
   * Get platform-specific binary name
   */
  private getBinaryName(base: string): string {
    return this.resolvedConfig.platform === 'win32' ? `${base}.exe` : base;
  }

  /**
   * Make binaries executable on Unix platforms
   */
  private ensureExecutable(): void {
    if (this.resolvedConfig.platform === 'win32') return;

    try {
      const popplerDir = this.binaryPath.replace(/[\/\\]bin$/, '');
      // Use spawn to avoid blocking, but we don't wait for it
      const { spawn } = require('child_process');
      spawn('chmod', ['-R', '755', popplerDir], { stdio: 'ignore' });
    } catch {
      // Ignore errors - permission may already be set or not needed
    }
  }

  /**
   * Convert any input type to Buffer
   */
  private async inputToBuffer(input: PdfInput): Promise<Buffer> {
    if (Buffer.isBuffer(input)) {
      return input;
    }
    if (input instanceof Uint8Array) {
      return Buffer.from(input);
    }

    // Readable stream - collect chunks
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      input.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      input.on('end', () => resolve(Buffer.concat(chunks)));
      input.on('error', reject);
    });
  }

  /**
   * Convert a single page to buffer
   */
  private async convertSinglePageToBuffer(
    pdfBuffer: Buffer,
    page: number,
    options: ConvertOptions
  ): Promise<Buffer> {
    const format = FORMATS.includes(options.format as OutputFormat)
      ? (options.format as OutputFormat)
      : 'png';

    const args: string[] = [`-${format}`, '-singlefile'];
    args.push('-f', String(page));
    args.push('-l', String(page));

    // Formats that support scaling
    const scalableFormats: OutputFormat[] = ['png', 'jpeg', 'tiff'];
    if (options.scale !== null && options.scale !== undefined && scalableFormats.includes(format)) {
      args.push('-scale-to', String(parseInt(String(options.scale))));
    } else if (options.scale === undefined && scalableFormats.includes(format)) {
      // Default scale for raster formats
      args.push('-scale-to', '1024');
    }

    args.push('-'); // stdin input
    args.push('-'); // stdout output

    const { command, execArgs, execOptions } = this.prepareConvertExecution(args);

    return new Promise((resolve, reject) => {
      const proc = spawn(command, execArgs, {
        ...execOptions,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const chunks: Buffer[] = [];
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (error: Error) => {
        reject(this.wrapError(error, stderr));
      });

      proc.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`pdftocairo exited with code ${code}\nStderr: ${stderr}`));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });

      proc.stdin.write(pdfBuffer);
      proc.stdin.end();
    });
  }

  /**
   * Convert a single page to stream
   */
  private convertSinglePageToStream(
    pdfBuffer: Buffer,
    page: number,
    options: ConvertOptions
  ): Readable {
    const format = FORMATS.includes(options.format as OutputFormat)
      ? (options.format as OutputFormat)
      : 'png';

    const passThrough = new PassThrough();

    const args: string[] = [`-${format}`, '-singlefile'];
    args.push('-f', String(page));
    args.push('-l', String(page));

    // Formats that support scaling
    const scalableFormats: OutputFormat[] = ['png', 'jpeg', 'tiff'];
    if (options.scale !== null && options.scale !== undefined && scalableFormats.includes(format)) {
      args.push('-scale-to', String(parseInt(String(options.scale))));
    } else if (options.scale === undefined && scalableFormats.includes(format)) {
      // Default scale for raster formats
      args.push('-scale-to', '1024');
    }

    args.push('-'); // stdin input
    args.push('-'); // stdout output

    const { command, execArgs, execOptions } = this.prepareConvertExecution(args);

    const proc = spawn(command, execArgs, {
      ...execOptions,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout.pipe(passThrough);

    proc.stderr.on('data', () => {
      // Could emit as warning or store for debugging
    });

    proc.on('error', (err: Error) => {
      passThrough.destroy(err);
    });

    proc.stdin.write(pdfBuffer);
    proc.stdin.end();

    return passThrough;
  }

  /**
   * Parse pdfinfo output
   */
  private parseInfo(stdout: string): PdfInfo {
    const lines = stdout.split(/\r?\n/);
    const info: Record<string, string | number> = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).replace(/ /g, '_').toLowerCase();
        const value = line.substring(colonIdx + 1).trim();
        info[key] = value;
      }
    }

    // Parse dimensions
    if (info.page_size && typeof info.page_size === 'string') {
      const dims = info.page_size.split('x');
      info.width_in_pts = parseFloat(dims[0]);
      info.height_in_pts = parseFloat(dims[1]);
    }

    return info as PdfInfo;
  }

  /**
   * Parse pdfimages -list output
   */
  private parseImgdata(stdout: string): ImageData[] {
    const lines = stdout.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].replace(/  +/g, ' ').trim().split(' ');
    const data: ImageData[] = [];

    for (let i = 2; i < lines.length; i++) {
      const values = lines[i].replace(/  +/g, ' ').trim().split(' ');
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      data.push(row as ImageData);
    }

    return data;
  }

  /**
   * Prepare convert execution with xvfb handling
   */
  private prepareConvertExecution(args: string[]): {
    command: string;
    execArgs: string[];
    execOptions: ExecFileOptions;
  } {
    let command = path.join(this.binaryPath, this.getBinaryName('pdftocairo'));
    let execArgs = args;
    let execOptions = { ...this.execOptions };

    // Handle virtual display for headless Linux environments
    // Only use xvfb if:
    // 1. preferXvfb is true (or not explicitly disabled)
    // 2. Environment needs virtual display
    // 3. Platform is Linux
    const useXvfb =
      this.resolvedConfig.preferXvfb !== false &&
      this.envDetector.needsVirtualDisplay() &&
      this.resolvedConfig.platform === 'linux';

    if (useXvfb) {
      const xvfbResult = this.setupXvfb(command, args, execOptions);
      command = xvfbResult.command;
      execArgs = xvfbResult.args;
      execOptions = xvfbResult.options;
    }

    return { command, execArgs, execOptions };
  }

  /**
   * Check if script has CRLF line endings
   */
  private hasCRLF(scriptPath: string): boolean {
    try {
      const content = fs.readFileSync(scriptPath, 'utf8');
      return content.includes('\r');
    } catch {
      return false;
    }
  }

  /**
   * Get script content with CRLF fixed (for passing to bash -c)
   */
  private getFixedScriptContent(scriptPath: string): string | null {
    try {
      const content = fs.readFileSync(scriptPath, 'utf8');
      return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    } catch {
      return null;
    }
  }

  /**
   * Set up xvfb-run for headless environments
   */
  private setupXvfb(
    originalCommand: string,
    args: string[],
    options: ExecFileOptions
  ): {
    command: string;
    args: string[];
    options: ExecFileOptions;
    scriptContent?: string;
  } {
    const bundledXvfb = path.join(this.binaryPath, 'xvfb-run');
    const xvfbPaths = [bundledXvfb, '/opt/bin/xvfb-run', '/usr/bin/xvfb-run'];

    for (const xvfbPath of xvfbPaths) {
      if (fs.existsSync(xvfbPath)) {
        const newOptions: ExecFileOptions = {
          ...options,
          env: { ...options.env, DISPLAY: ':99' },
        };

        const needsCRLFFix = this.hasCRLF(xvfbPath);

        // If CRLF needs fixing, pass script content to bash -c (no temp file)
        if (needsCRLFFix) {
          const scriptContent = this.getFixedScriptContent(xvfbPath);
          if (scriptContent) {
            return {
              command: '/bin/bash',
              args: ['-c', `${scriptContent}\n"$@"`, '_', originalCommand, ...args],
              options: newOptions,
            };
          }
        }

        // Use bash wrapper for bundled scripts
        if (xvfbPath === bundledXvfb) {
          return {
            command: '/bin/bash',
            args: [xvfbPath, originalCommand, ...args],
            options: newOptions,
          };
        }

        // System xvfb-run can be executed directly
        return {
          command: xvfbPath,
          args: [
            '-a',
            '--server-args=-screen 0 1024x768x24',
            originalCommand,
            ...args,
          ],
          options: newOptions,
        };
      }
    }

    // No xvfb found, set minimal display env
    return {
      command: originalCommand,
      args,
      options: {
        ...options,
        env: { ...options.env, DISPLAY: ':99', XAUTHORITY: '/tmp/.Xauth' },
      },
    };
  }

  /**
   * Wrap error with stderr information
   */
  private wrapError(error: Error, stderr?: string): Error {
    const message = stderr
      ? `${error.message}\nStderr: ${stderr}`
      : error.message;
    const wrapped = new Error(message);
    wrapped.stack = error.stack;
    return wrapped;
  }
}
