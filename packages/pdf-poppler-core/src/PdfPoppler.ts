import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { execFile, ExecFileOptions } from 'child_process';
import {
  PdfPopplerConfig,
  ConvertOptions,
  PdfInfo,
  ImageData,
  VersionInfo,
  Platform,
  ResolvedConfig,
  OutputFormat,
} from './types';
import { PdfPopplerConfigBuilder, configure } from './PdfPopplerConfig';
import { BinaryResolver } from './platform/BinaryResolver';
import { EnvironmentDetector } from './platform/EnvironmentDetector';

/** Valid output formats */
const FORMATS: OutputFormat[] = ['png', 'jpeg', 'tiff', 'pdf', 'ps', 'eps', 'svg'];

/**
 * Main class for PDF operations using Poppler
 *
 * @example
 * ```typescript
 * // Auto-detect everything
 * const poppler = new PdfPoppler();
 * const info = await poppler.info('/path/to/file.pdf');
 *
 * // With configuration
 * const poppler = new PdfPoppler({ preferXvfb: false });
 * await poppler.convert('/path/to/file.pdf', { format: 'png' });
 *
 * // Using builder
 * const poppler = PdfPoppler.configure()
 *   .withOsBinary()
 *   .withPreferXvfb(false)
 *   .build();
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
   * @param file - Path to the PDF file
   */
  async info(file: string): Promise<PdfInfo> {
    const validatedFile = this.validatePdfPath(file);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdfinfo'));

    return new Promise((resolve, reject) => {
      execFile(
        binary,
        [validatedFile],
        this.execOptions,
        (error, stdout, stderr) => {
          if (error) {
            return reject(this.wrapError(error, stderr as string));
          }
          resolve(this.parseInfo(stdout as string));
        }
      );
    });
  }

  /**
   * Convert PDF to images
   * @param file - Path to the PDF file
   * @param options - Conversion options
   */
  async convert(file: string, options: ConvertOptions = {}): Promise<string> {
    const validatedFile = this.validatePdfPath(file);
    const validatedOutDir = this.validateOutputDir(
      options.out_dir || path.dirname(validatedFile)
    );
    const validatedPrefix = this.validateOutputPrefix(
      options.out_prefix ||
        path.basename(validatedFile, path.extname(validatedFile))
    );

    const opts = this.mergeConvertOptions(options, validatedOutDir, validatedPrefix);
    const args = this.buildConvertArgs(validatedFile, opts);
    const { command, execArgs, execOptions } = this.prepareConvertExecution(args);

    return new Promise((resolve, reject) => {
      execFile(command, execArgs, execOptions, (error, stdout, stderr) => {
        if (error) {
          return reject(this.wrapError(error, stderr as string));
        }
        resolve(stdout as string);
      });
    });
  }

  /**
   * Flatten PDF by rendering with pdftocairo -pdf
   * This converts form fields and annotations to static content
   * @param file - Path to the PDF file
   * @param outputPath - Output path for flattened PDF
   * @returns Path to flattened PDF
   */
  async flatten(file: string, outputPath: string): Promise<string> {
    const validatedFile = this.validatePdfPath(file);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdftocairo'));

    const args = ['-pdf', validatedFile, outputPath];

    return new Promise((resolve, reject) => {
      execFile(binary, args, this.execOptions, (error, stdout, stderr) => {
        if (error) {
          return reject(this.wrapError(error, stderr as string));
        }
        resolve(outputPath);
      });
    });
  }

  /**
   * Flatten PDF from buffer by rendering with pdftocairo -pdf
   * Uses stdin to pass PDF data directly without writing to disk first
   * @param pdfBuffer - PDF data as Buffer or Uint8Array
   * @param outputPath - Output path for flattened PDF
   * @returns Path to flattened PDF
   */
  async flattenBuffer(pdfBuffer: Buffer | Uint8Array, outputPath: string): Promise<string> {
    const { spawn } = require('child_process');
    const binary = path.join(this.binaryPath, this.getBinaryName('pdftocairo'));

    // Use '-' for stdin input
    const args = ['-pdf', '-', outputPath];

    return new Promise((resolve, reject) => {
      const proc = spawn(binary, args, {
        ...this.execOptions,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';
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
          resolve(outputPath);
        }
      });

      // Write buffer to stdin and close
      proc.stdin.write(Buffer.from(pdfBuffer));
      proc.stdin.end();
    });
  }

  /**
   * Convert PDF from buffer to images
   * Uses stdin to pass PDF data directly without writing to disk first
   * @param pdfBuffer - PDF data as Buffer or Uint8Array
   * @param options - Conversion options
   * @returns stdout from pdftocairo
   */
  async convertBuffer(pdfBuffer: Buffer | Uint8Array, options: ConvertOptions = {}): Promise<string> {
    const { spawn } = require('child_process');

    const outDir = options.out_dir || process.cwd();
    const outPrefix = options.out_prefix || 'output';

    const validatedOutDir = this.validateOutputDir(outDir);
    const validatedPrefix = this.validateOutputPrefix(outPrefix);

    const opts = this.mergeConvertOptions(options, validatedOutDir, validatedPrefix);

    // Build args but use '-' for stdin instead of file path
    const args: string[] = [`-${opts.format}`];

    if (opts.page !== null) {
      args.push('-f', String(parseInt(String(opts.page))));
      args.push('-l', String(parseInt(String(opts.page))));
    }
    if (opts.scale !== null) {
      args.push('-scale-to', String(parseInt(String(opts.scale))));
    }
    args.push('-'); // stdin input
    args.push(path.join(opts.out_dir, opts.out_prefix));

    const { command, execArgs, execOptions } = this.prepareConvertExecution(args);

    return new Promise((resolve, reject) => {
      const proc = spawn(command, execArgs, {
        ...execOptions,
        stdio: ['pipe', 'pipe', 'pipe']
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
          reject(new Error(`pdftocairo exited with code ${code}\nStderr: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      // Write buffer to stdin and close
      proc.stdin.write(Buffer.from(pdfBuffer));
      proc.stdin.end();
    });
  }

  /**
   * Get embedded image data from PDF
   * @param file - Path to the PDF file
   */
  async imgdata(file: string): Promise<ImageData[]> {
    const validatedFile = this.validatePdfPath(file);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdfimages'));

    return new Promise((resolve, reject) => {
      execFile(
        binary,
        [validatedFile, '-list'],
        this.execOptions,
        (error, stdout, stderr) => {
          if (error) {
            return reject(this.wrapError(error, stderr as string));
          }
          resolve(this.parseImgdata(stdout as string));
        }
      );
    });
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
   * Validate PDF file path for security
   */
  private validatePdfPath(file: string): string {
    if (typeof file !== 'string') {
      throw new Error('File path must be a string');
    }
    if (file.includes('\0')) {
      throw new Error('Invalid file path: null bytes detected');
    }
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${resolved}`);
    }
    const stats = fs.statSync(resolved);
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }
    if (!resolved.toLowerCase().endsWith('.pdf')) {
      throw new Error('File must have .pdf extension');
    }
    return resolved;
  }

  /**
   * Validate output directory for security
   */
  private validateOutputDir(outDir: string): string {
    if (typeof outDir !== 'string') {
      throw new Error('Output directory must be a string');
    }
    if (outDir.includes('\0')) {
      throw new Error('Invalid output directory: null bytes detected');
    }
    const resolved = path.resolve(outDir);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Output directory not found: ${resolved}`);
    }
    const stats = fs.statSync(resolved);
    if (!stats.isDirectory()) {
      throw new Error('Output path is not a directory');
    }
    return resolved;
  }

  /**
   * Validate output prefix for security
   */
  private validateOutputPrefix(prefix: string): string {
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
   * Merge convert options with defaults
   */
  private mergeConvertOptions(
    opts: ConvertOptions,
    outDir: string,
    outPrefix: string
  ): Required<ConvertOptions> {
    const format = FORMATS.includes(opts.format as OutputFormat)
      ? (opts.format as OutputFormat)
      : 'jpeg';

    // Formats that support scaling
    const scalableFormats: OutputFormat[] = ['png', 'jpeg', 'tiff'];

    // If scale is explicitly null or format doesn't support scaling, don't use scale
    let scale: number | null;
    if (opts.scale === null || !scalableFormats.includes(format)) {
      scale = null;
    } else {
      scale = opts.scale ?? 1024;
    }

    return {
      format,
      scale,
      out_dir: outDir,
      out_prefix: outPrefix,
      page: opts.page ?? null,
    };
  }

  /**
   * Build pdftocairo arguments
   */
  private buildConvertArgs(
    file: string,
    opts: Required<ConvertOptions>
  ): string[] {
    const args: string[] = [`-${opts.format}`];

    if (opts.page !== null) {
      args.push('-f', String(parseInt(String(opts.page))));
      args.push('-l', String(parseInt(String(opts.page))));
    }
    if (opts.scale !== null) {
      args.push('-scale-to', String(parseInt(String(opts.scale))));
    }
    args.push(file);
    args.push(path.join(opts.out_dir, opts.out_prefix));

    return args;
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
   * Fix CRLF line endings in a shell script
   * Returns the path to use (original or fixed temp file)
   */
  private fixScriptLineEndings(scriptPath: string): string {
    try {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      if (scriptContent.includes('\r')) {
        // Fix CRLF line endings (npm/git on Windows may convert them)
        const fixedContent = scriptContent
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n');
        const tempScript = '/tmp/xvfb-run-fixed';
        fs.writeFileSync(tempScript, fixedContent, { mode: 0o755 });
        return tempScript;
      }
    } catch {
      // If we can't read/fix, return original
    }
    return scriptPath;
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
  } {
    const bundledXvfb = path.join(this.binaryPath, 'xvfb-run');
    const xvfbPaths = [bundledXvfb, '/opt/bin/xvfb-run', '/usr/bin/xvfb-run'];

    for (const xvfbPath of xvfbPaths) {
      if (fs.existsSync(xvfbPath)) {
        const newOptions: ExecFileOptions = {
          ...options,
          env: { ...options.env, DISPLAY: ':99' },
        };

        // Fix CRLF line endings if needed and get the script path to use
        const scriptPath = this.fixScriptLineEndings(xvfbPath);
        const wasFixed = scriptPath !== xvfbPath;

        // Use bash wrapper for bundled scripts or fixed scripts
        if (wasFixed || xvfbPath === bundledXvfb) {
          return {
            command: '/bin/bash',
            args: [scriptPath, originalCommand, ...args],
            options: newOptions,
          };
        } else {
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
