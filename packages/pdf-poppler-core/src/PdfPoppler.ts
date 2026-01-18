import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { execFile, spawn, ExecFileOptions, ChildProcess } from 'child_process';
import { Readable, PassThrough } from 'stream';
import {
  PdfPopplerConfig,
  ConvertOptions,
  TextOptions,
  TextResult,
  HtmlOptions,
  FontInfo,
  PdfInfo,
  ImageData,
  VersionInfo,
  Platform,
  ResolvedConfig,
  OutputFormat,
  PdfInput,
  PageResult,
  PageStreamResult,
  SplitResult,
  SplitStreamResult,
  Attachment,
  ExtractedAttachment,
  SignatureInfo,
  SignatureDetails,
} from './types';
import { PdfPopplerConfigBuilder, configure } from './PdfPopplerConfig';
import { BinaryResolver } from './platform/BinaryResolver';
import { EnvironmentDetector } from './platform/EnvironmentDetector';
import {
  PdfPopplerError,
  InvalidPdfError,
  EncryptedPdfError,
  PageOutOfRangeError,
  BinaryNotFoundError,
} from './errors';

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
          reject(this.wrapError(new Error(`pdfinfo exited with code ${code}`), stderr));
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
    let pagesToConvert: number[] = [];

    if (options.pages && options.pages.length > 0) {
      // Use explicit pages array
      pagesToConvert = options.pages.filter(p => p >= 1 && p <= pageCount);
      // Validate all requested pages exist
      for (const p of options.pages) {
        if (p < 1 || p > pageCount) {
          throw new PageOutOfRangeError(p, pageCount);
        }
      }
      pagesToConvert = options.pages;
    } else if (options.page !== undefined && options.page !== null) {
      // Single page specified
      if (options.page < 1 || options.page > pageCount) {
        throw new PageOutOfRangeError(options.page, pageCount);
      }
      pagesToConvert = [options.page];
    } else {
      // Use firstPage/lastPage or default to all pages
      const startPage = options.firstPage ?? 1;
      const endPage = options.lastPage ?? pageCount;

      // Validate range
      if (startPage < 1 || startPage > pageCount) {
        throw new PageOutOfRangeError(startPage, pageCount);
      }
      if (endPage < 1 || endPage > pageCount) {
        throw new PageOutOfRangeError(endPage, pageCount);
      }

      for (let page = startPage; page <= endPage; page++) {
        pagesToConvert.push(page);
      }
    }

    const results: PageResult[] = [];

    // Process each page (pdftocairo stdout only supports single page)
    for (const page of pagesToConvert) {
      const pageBuffer = await this.convertSinglePageToBuffer(pdfBuffer, page, options);
      results.push({ page, data: pageBuffer });
    }

    return results;
  }

  /**
   * Convert PDF pages using an async iterator (memory efficient for large PDFs)
   * Yields pages one at a time instead of loading all into memory
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @param options - Conversion options
   * @yields { page, data: Buffer } for each page
   */
  async *convertIterator(
    input: PdfInput,
    options: ConvertOptions = {}
  ): AsyncGenerator<PageResult, void, unknown> {
    const pdfBuffer = await this.inputToBuffer(input);

    // Get page count
    const pdfInfo = await this.info(pdfBuffer);
    const pageCount = parseInt(pdfInfo.pages, 10);

    // Determine which pages to convert
    let pagesToConvert: number[] = [];

    if (options.pages && options.pages.length > 0) {
      // Use explicit pages array
      for (const p of options.pages) {
        if (p < 1 || p > pageCount) {
          throw new PageOutOfRangeError(p, pageCount);
        }
      }
      pagesToConvert = options.pages;
    } else if (options.page !== undefined && options.page !== null) {
      // Single page specified
      if (options.page < 1 || options.page > pageCount) {
        throw new PageOutOfRangeError(options.page, pageCount);
      }
      pagesToConvert = [options.page];
    } else {
      // Use firstPage/lastPage or default to all pages
      const startPage = options.firstPage ?? 1;
      const endPage = options.lastPage ?? pageCount;

      // Validate range
      if (startPage < 1 || startPage > pageCount) {
        throw new PageOutOfRangeError(startPage, pageCount);
      }
      if (endPage < 1 || endPage > pageCount) {
        throw new PageOutOfRangeError(endPage, pageCount);
      }

      for (let page = startPage; page <= endPage; page++) {
        pagesToConvert.push(page);
      }
    }

    // Yield each page one at a time
    for (const page of pagesToConvert) {
      const pageBuffer = await this.convertSinglePageToBuffer(pdfBuffer, page, options);
      yield { page, data: pageBuffer };
    }
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
          reject(this.wrapError(new Error(`pdftocairo exited with code ${code}`), stderr));
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

    const args = ['-pdf', '-', '-'];

    const proc = spawn(binary, args, {
      ...this.execOptions,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdin.write(pdfBuffer);
    proc.stdin.end();

    return this.createManagedStream(proc);
  }

  /**
   * Get embedded image metadata from PDF
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   */
  async listImages(input: PdfInput): Promise<ImageData[]> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdfimages'));

    // pdfimages requires a file path, doesn't reliably support stdin
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

  /**
   * Get embedded image metadata from PDF
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @deprecated Use listImages() instead
   */
  async imgdata(input: PdfInput): Promise<ImageData[]> {
    return this.listImages(input);
  }

  /**
   * Extract text from PDF
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @param options - Text extraction options
   * @returns All text content as a single string
   */
  async text(input: PdfInput, options: TextOptions = {}): Promise<string> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdftotext'));

    const args = this.buildTextArgs(options);
    args.push('-'); // stdin input
    args.push('-'); // stdout output

    return new Promise((resolve, reject) => {
      const proc = spawn(binary, args, {
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
          reject(this.wrapError(new Error(`pdftotext exited with code ${code}`), stderr));
        } else {
          resolve(stdout);
        }
      });

      proc.stdin.write(pdfBuffer);
      proc.stdin.end();
    });
  }

  /**
   * Extract text from PDF page by page
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @param options - Text extraction options
   * @returns Array of { page, text } for each page
   */
  async textPages(input: PdfInput, options: TextOptions = {}): Promise<TextResult[]> {
    const pdfBuffer = await this.inputToBuffer(input);

    // Get page count
    const pdfInfo = await this.info(pdfBuffer);
    const pageCount = parseInt(pdfInfo.pages, 10);

    // Determine which pages to extract
    let startPage = 1;
    let endPage = pageCount;

    if (options.page !== undefined) {
      startPage = options.page;
      endPage = options.page;
    } else {
      if (options.firstPage !== undefined) {
        startPage = options.firstPage;
      }
      if (options.lastPage !== undefined) {
        endPage = options.lastPage;
      }
    }

    const results: TextResult[] = [];

    // Extract text from each page
    for (let page = startPage; page <= endPage; page++) {
      const pageText = await this.text(pdfBuffer, {
        ...options,
        firstPage: page,
        lastPage: page,
      });
      results.push({ page, text: pageText });
    }

    return results;
  }

  /**
   * List fonts used in PDF
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @param options - Options including password for encrypted PDFs
   * @returns Array of FontInfo objects
   */
  async listFonts(
    input: PdfInput,
    options: { password?: string } = {}
  ): Promise<FontInfo[]> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdffonts'));

    const args: string[] = [];

    // Password
    if (options.password) {
      args.push('-upw', options.password);
    }

    args.push('-'); // stdin input

    return new Promise((resolve, reject) => {
      const proc = spawn(binary, args, {
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
          reject(this.wrapError(new Error(`pdffonts exited with code ${code}`), stderr));
        } else {
          resolve(this.parseFonts(stdout));
        }
      });

      proc.stdin.write(pdfBuffer);
      proc.stdin.end();
    });
  }

  /**
   * Merge multiple PDFs into one
   * @param inputs - Array of PDF inputs (Buffer, Uint8Array, or Readable stream)
   * @returns Merged PDF as Buffer
   */
  async merge(inputs: PdfInput[]): Promise<Buffer> {
    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      throw new PdfPopplerError('At least one PDF input is required');
    }

    const binary = path.join(this.binaryPath, this.getBinaryName('pdfunite'));
    const tempDir = os.tmpdir();
    const tempFiles: string[] = [];
    const outputFile = path.join(
      tempDir,
      `pdf-poppler-merged-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.pdf`
    );

    try {
      // Convert all inputs to buffers and write to temp files
      for (let i = 0; i < inputs.length; i++) {
        const pdfBuffer = await this.inputToBuffer(inputs[i]);
        const tempFile = path.join(
          tempDir,
          `pdf-poppler-input-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 11)}.pdf`
        );
        fs.writeFileSync(tempFile, pdfBuffer);
        tempFiles.push(tempFile);
      }

      // Build pdfunite command: pdfunite input1.pdf input2.pdf ... output.pdf
      const args = [...tempFiles, outputFile];

      return await new Promise((resolve, reject) => {
        execFile(binary, args, this.execOptions, (error, stdout, stderr) => {
          if (error) {
            return reject(this.wrapError(error, stderr as string));
          }

          try {
            const mergedPdf = fs.readFileSync(outputFile);
            resolve(mergedPdf);
          } catch (readError) {
            reject(this.wrapError(readError as Error, stderr as string));
          }
        });
      });
    } finally {
      // Clean up all temp files
      for (const tempFile of tempFiles) {
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
      try {
        fs.unlinkSync(outputFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Merge multiple PDFs into one and return as stream
   * @param inputs - Array of PDF inputs (Buffer, Uint8Array, or Readable stream)
   * @returns Merged PDF as Readable stream
   */
  async mergeToStream(inputs: PdfInput[]): Promise<Readable> {
    const buffer = await this.merge(inputs);
    return Readable.from(buffer);
  }

  /**
   * Split PDF into individual single-page PDFs
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @returns Array of { page, data: Buffer } for each page
   */
  async split(input: PdfInput): Promise<SplitResult[]> {
    const pdfBuffer = await this.inputToBuffer(input);

    // Get page count
    const pdfInfo = await this.info(pdfBuffer);
    const pageCount = parseInt(pdfInfo.pages, 10);

    const results: SplitResult[] = [];

    // Use pdftocairo to extract each page as a separate PDF
    // pdftocairo -pdf -f <page> -l <page> supports stdin/stdout
    for (let page = 1; page <= pageCount; page++) {
      const pageBuffer = await this.extractSinglePage(pdfBuffer, page);
      results.push({ page, data: pageBuffer });
    }

    return results;
  }

  /**
   * Split PDF into individual single-page PDF streams
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @returns Array of { page, stream: Readable } for each page
   */
  async splitToStreams(input: PdfInput): Promise<SplitStreamResult[]> {
    const pdfBuffer = await this.inputToBuffer(input);

    // Get page count
    const pdfInfo = await this.info(pdfBuffer);
    const pageCount = parseInt(pdfInfo.pages, 10);

    const results: SplitStreamResult[] = [];

    for (let page = 1; page <= pageCount; page++) {
      const stream = this.extractSinglePageToStream(pdfBuffer, page);
      results.push({ page, stream });
    }

    return results;
  }

  /**
   * Extract a single page from PDF as Buffer
   */
  private async extractSinglePage(pdfBuffer: Buffer, page: number): Promise<Buffer> {
    const binary = path.join(this.binaryPath, this.getBinaryName('pdftocairo'));
    const args = ['-pdf', '-f', String(page), '-l', String(page), '-', '-'];

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
          reject(this.wrapError(new Error(`pdftocairo exited with code ${code}`), stderr));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });

      proc.stdin.write(pdfBuffer);
      proc.stdin.end();
    });
  }

  /**
   * Extract a single page from PDF as Readable stream
   */
  private extractSinglePageToStream(pdfBuffer: Buffer, page: number): Readable {
    const binary = path.join(this.binaryPath, this.getBinaryName('pdftocairo'));
    const args = ['-pdf', '-f', String(page), '-l', String(page), '-', '-'];

    const proc = spawn(binary, args, {
      ...this.execOptions,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdin.write(pdfBuffer);
    proc.stdin.end();

    return this.createManagedStream(proc);
  }

  /**
   * List attachments in PDF
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @returns Array of Attachment objects
   */
  async listAttachments(input: PdfInput): Promise<Attachment[]> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdfdetach'));
    const tempDir = os.tmpdir();
    const tempFile = path.join(
      tempDir,
      `pdf-poppler-detach-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.pdf`
    );

    try {
      fs.writeFileSync(tempFile, pdfBuffer);

      return await new Promise((resolve, reject) => {
        execFile(binary, ['-list', tempFile], this.execOptions, (error, stdout, stderr) => {
          if (error) {
            return reject(this.wrapError(error, stderr as string));
          }
          resolve(this.parseAttachments(stdout as string));
        });
      });
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Extract a specific attachment by index
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @param index - Attachment index (1-indexed)
   * @returns Attachment data as Buffer
   */
  async extractAttachment(input: PdfInput, index: number): Promise<Buffer> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdfdetach'));
    const tempDir = os.tmpdir();
    const tempFile = path.join(
      tempDir,
      `pdf-poppler-detach-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.pdf`
    );
    const outputDir = path.join(
      tempDir,
      `pdf-poppler-attach-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    );

    try {
      fs.writeFileSync(tempFile, pdfBuffer);
      fs.mkdirSync(outputDir, { recursive: true });

      // First get the filename of the attachment
      const attachments = await this.listAttachments(pdfBuffer);
      const attachment = attachments.find(a => a.index === index);
      if (!attachment) {
        throw new PdfPopplerError(`Attachment ${index} not found`);
      }

      return await new Promise((resolve, reject) => {
        const outputPath = path.join(outputDir, attachment.name);
        execFile(
          binary,
          ['-savefile', String(index), '-o', outputPath, tempFile],
          this.execOptions,
          (error, stdout, stderr) => {
            if (error) {
              return reject(this.wrapError(error, stderr as string));
            }
            try {
              const data = fs.readFileSync(outputPath);
              resolve(data);
            } catch (readError) {
              reject(this.wrapError(readError as Error, stderr as string));
            }
          }
        );
      });
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
      try {
        fs.rmSync(outputDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Extract all attachments from PDF
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @returns Array of { name, data } for each attachment
   */
  async extractAllAttachments(input: PdfInput): Promise<ExtractedAttachment[]> {
    const pdfBuffer = await this.inputToBuffer(input);

    // First list attachments
    const attachments = await this.listAttachments(pdfBuffer);

    if (attachments.length === 0) {
      return [];
    }

    const results: ExtractedAttachment[] = [];

    // Extract each attachment
    for (const attachment of attachments) {
      const data = await this.extractAttachment(pdfBuffer, attachment.index);
      results.push({ name: attachment.name, data });
    }

    return results;
  }

  /**
   * Convert PDF to HTML
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @param options - HTML conversion options
   * @returns HTML content as string
   * @throws BinaryNotFoundError if pdftohtml is not available
   */
  async html(input: PdfInput, options: HtmlOptions = {}): Promise<string> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdftohtml'));

    // Check if pdftohtml binary exists
    if (!fs.existsSync(binary)) {
      throw new BinaryNotFoundError('pdftohtml');
    }

    const tempDir = os.tmpdir();
    const tempFile = path.join(
      tempDir,
      `pdf-poppler-html-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.pdf`
    );

    try {
      fs.writeFileSync(tempFile, pdfBuffer);

      const args = this.buildHtmlArgs(options);
      args.push('-stdout'); // Output to stdout
      args.push(tempFile); // Input file

      return await new Promise((resolve, reject) => {
        execFile(binary, args, this.execOptions, (error, stdout, stderr) => {
          if (error) {
            return reject(this.wrapError(error, stderr as string));
          }
          resolve(stdout as string);
        });
      });
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Build pdftohtml command arguments from options
   */
  private buildHtmlArgs(options: HtmlOptions): string[] {
    const args: string[] = [];

    // Page range
    if (options.page !== undefined) {
      args.push('-f', String(options.page));
      args.push('-l', String(options.page));
    } else {
      if (options.firstPage !== undefined) {
        args.push('-f', String(options.firstPage));
      }
      if (options.lastPage !== undefined) {
        args.push('-l', String(options.lastPage));
      }
    }

    // Password
    if (options.password) {
      args.push('-upw', options.password);
    }

    // No frames
    if (options.noFrames) {
      args.push('-noframes');
    }

    // Complex HTML
    if (options.complex) {
      args.push('-c');
    }

    // Single page
    if (options.singlePage) {
      args.push('-s');
    }

    // Ignore images
    if (options.ignoreImages) {
      args.push('-i');
    }

    // Zoom
    if (options.zoom !== undefined) {
      args.push('-zoom', String(options.zoom));
    }

    return args;
  }

  /**
   * Verify digital signatures in PDF
   * @param input - PDF as Buffer, Uint8Array, or Readable stream
   * @returns SignatureInfo with signed status and signature details
   * @throws BinaryNotFoundError if pdfsig is not available
   */
  async verifySignatures(input: PdfInput): Promise<SignatureInfo> {
    const pdfBuffer = await this.inputToBuffer(input);
    const binary = path.join(this.binaryPath, this.getBinaryName('pdfsig'));

    // Check if pdfsig binary exists
    if (!fs.existsSync(binary)) {
      throw new BinaryNotFoundError('pdfsig');
    }

    // pdfsig supports stdin with '-'
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
          reject(this.wrapError(new Error(`pdfsig exited with code ${code}`), stderr));
        } else {
          resolve(this.parseSignatures(stdout));
        }
      });

      proc.stdin.write(pdfBuffer);
      proc.stdin.end();
    });
  }

  /**
   * Parse pdfsig output
   */
  private parseSignatures(stdout: string): SignatureInfo {
    const lines = stdout.trim().split(/\r?\n/);
    const signatures: SignatureDetails[] = [];

    // Check if document is signed
    const hasNoSignatures = lines.some(line =>
      line.toLowerCase().includes('does not contain any signatures') ||
      line.toLowerCase().includes('no signatures')
    );

    if (hasNoSignatures) {
      return { signed: false, signatures: [] };
    }

    // Parse signature information
    // pdfsig output format varies, but typically includes:
    // - Signature #N
    // - Signer name, certificate info, time, etc.
    let currentSig: Partial<SignatureDetails> | null = null;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      // New signature block
      if (lowerLine.includes('signature #') || lowerLine.match(/^signature \d+/)) {
        if (currentSig) {
          signatures.push({
            valid: currentSig.valid ?? false,
            trusted: currentSig.trusted ?? false,
            ...currentSig,
          });
        }
        currentSig = { valid: false, trusted: false };
      }

      if (currentSig) {
        // Parse signature details
        if (lowerLine.includes('signer') && line.includes(':')) {
          currentSig.signerName = line.split(':').slice(1).join(':').trim();
        }
        if (lowerLine.includes('certificate') && line.includes(':')) {
          currentSig.signerCertificate = line.split(':').slice(1).join(':').trim();
        }
        if (lowerLine.includes('time') && line.includes(':')) {
          currentSig.signTime = line.split(':').slice(1).join(':').trim();
        }
        if (lowerLine.includes('hash algorithm') && line.includes(':')) {
          currentSig.hashAlgorithm = line.split(':').slice(1).join(':').trim();
        }
        if (lowerLine.includes('signature is valid')) {
          currentSig.valid = true;
        }
        if (lowerLine.includes('certificate is trusted')) {
          currentSig.trusted = true;
        }
      }
    }

    // Add last signature if exists
    if (currentSig) {
      signatures.push({
        valid: currentSig.valid ?? false,
        trusted: currentSig.trusted ?? false,
        ...currentSig,
      });
    }

    return {
      signed: signatures.length > 0,
      signatures,
    };
  }

  /**
   * Parse pdfdetach -list output
   * Output format:
   * 1 File attachments
   * 1: name.txt
   * 2: file.pdf
   */
  private parseAttachments(stdout: string): Attachment[] {
    const lines = stdout.trim().split(/\r?\n/);
    const attachments: Attachment[] = [];

    // Skip header line(s)
    for (const line of lines) {
      // Match lines like "1: filename.txt" or "  1: filename.txt"
      const match = line.match(/^\s*(\d+):\s+(.+)$/);
      if (match) {
        attachments.push({
          index: parseInt(match[1], 10),
          name: match[2].trim(),
          size: 0, // pdfdetach -list doesn't show size
        });
      }
    }

    return attachments;
  }

  /**
   * Build pdftotext command arguments from options
   */
  private buildTextArgs(options: TextOptions): string[] {
    const args: string[] = [];

    // Page range
    if (options.page !== undefined) {
      args.push('-f', String(options.page));
      args.push('-l', String(options.page));
    } else {
      if (options.firstPage !== undefined) {
        args.push('-f', String(options.firstPage));
      }
      if (options.lastPage !== undefined) {
        args.push('-l', String(options.lastPage));
      }
    }

    // Layout options
    if (options.layout) {
      args.push('-layout');
    }
    if (options.raw) {
      args.push('-raw');
    }

    // Password
    if (options.password) {
      args.push('-upw', options.password);
    }

    // Encoding
    if (options.encoding) {
      args.push('-enc', options.encoding);
    }

    // End of line
    if (options.eol) {
      args.push('-eol', options.eol);
    }

    // Other options
    if (options.noDiag) {
      args.push('-nodiag');
    }
    if (options.noPageBreaks) {
      args.push('-nopgbrk');
    }

    return args;
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
    // Validate input
    if (input === null || input === undefined) {
      throw new InvalidPdfError('Input cannot be null or undefined');
    }

    // Handle file path (string)
    if (typeof input === 'string') {
      if (!fs.existsSync(input)) {
        throw new InvalidPdfError(`File not found: ${input}`);
      }
      return fs.readFileSync(input);
    }

    if (Buffer.isBuffer(input)) {
      return input;
    }
    if (input instanceof Uint8Array) {
      return Buffer.from(input);
    }

    // Check if it's a readable stream (has .on method)
    if (typeof (input as Readable).on !== 'function') {
      throw new InvalidPdfError('Input must be a file path, Buffer, Uint8Array, or Readable stream');
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
   * Create a managed stream from a child process that properly cleans up
   * This prevents Jest from hanging due to open handles on Windows
   */
  private createManagedStream(proc: ChildProcess): PassThrough {
    const passThrough = new PassThrough();
    let cleanedUp = false;

    proc.stdout!.pipe(passThrough);

    // Clean up the child process - prevent multiple calls
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      // Unpipe to break the connection
      proc.stdout?.unpipe(passThrough);

      // Destroy all stdio streams
      if (proc.stdout && !proc.stdout.destroyed) {
        proc.stdout.destroy();
      }
      if (proc.stderr && !proc.stderr.destroyed) {
        proc.stderr.destroy();
      }
      if (proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.destroy();
      }

      // Kill the process if it's still running
      if (!proc.killed && proc.exitCode === null) {
        proc.kill();
      }
    };

    // Clean up when stream is consumed
    passThrough.on('close', cleanup);
    passThrough.on('end', cleanup);
    passThrough.on('error', cleanup);

    // Also clean up when process exits (fallback)
    proc.on('close', cleanup);
    proc.on('exit', cleanup);

    proc.on('error', (err: Error) => {
      cleanup();
      if (!passThrough.destroyed) {
        passThrough.destroy(err);
      }
    });

    return passThrough;
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

    // Formats that support scaling/resolution
    const scalableFormats: OutputFormat[] = ['png', 'jpeg', 'tiff'];

    // DPI takes precedence over scale
    if (options.dpi !== undefined && scalableFormats.includes(format)) {
      args.push('-r', String(options.dpi));
    } else if (options.scale !== null && options.scale !== undefined && scalableFormats.includes(format)) {
      args.push('-scale-to', String(parseInt(String(options.scale))));
    } else if (options.scale === undefined && options.dpi === undefined && scalableFormats.includes(format)) {
      // Default scale for raster formats
      args.push('-scale-to', '1024');
    }

    // JPEG quality
    if (format === 'jpeg' && options.quality !== undefined) {
      args.push('-jpegopt', `quality=${options.quality}`);
    }

    // Password options
    if (options.password) {
      args.push('-upw', options.password);
    }
    if (options.ownerPassword) {
      args.push('-opw', options.ownerPassword);
    }

    // Transparency (PNG only)
    if (options.transparent && format === 'png') {
      args.push('-transp');
    }

    // Antialias
    if (options.antialias) {
      args.push('-antialias', options.antialias);
    }

    // Crop box
    if (options.cropBox) {
      args.push('-cropbox');
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
          reject(this.wrapError(new Error(`pdftocairo exited with code ${code}`), stderr));
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

    const args: string[] = [`-${format}`, '-singlefile'];
    args.push('-f', String(page));
    args.push('-l', String(page));

    // Formats that support scaling/resolution
    const scalableFormats: OutputFormat[] = ['png', 'jpeg', 'tiff'];

    // DPI takes precedence over scale
    if (options.dpi !== undefined && scalableFormats.includes(format)) {
      args.push('-r', String(options.dpi));
    } else if (options.scale !== null && options.scale !== undefined && scalableFormats.includes(format)) {
      args.push('-scale-to', String(parseInt(String(options.scale))));
    } else if (options.scale === undefined && options.dpi === undefined && scalableFormats.includes(format)) {
      // Default scale for raster formats
      args.push('-scale-to', '1024');
    }

    // JPEG quality
    if (format === 'jpeg' && options.quality !== undefined) {
      args.push('-jpegopt', `quality=${options.quality}`);
    }

    // Password options
    if (options.password) {
      args.push('-upw', options.password);
    }
    if (options.ownerPassword) {
      args.push('-opw', options.ownerPassword);
    }

    // Transparency (PNG only)
    if (options.transparent && format === 'png') {
      args.push('-transp');
    }

    // Antialias
    if (options.antialias) {
      args.push('-antialias', options.antialias);
    }

    // Crop box
    if (options.cropBox) {
      args.push('-cropbox');
    }

    args.push('-'); // stdin input
    args.push('-'); // stdout output

    const { command, execArgs, execOptions } = this.prepareConvertExecution(args);

    const proc = spawn(command, execArgs, {
      ...execOptions,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdin.write(pdfBuffer);
    proc.stdin.end();

    return this.createManagedStream(proc);
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
   * Parse pdffonts output
   * pdffonts output format:
   * name                                 type              encoding         emb sub uni object ID
   * ------------------------------------ ----------------- ---------------- --- --- --- ---------
   * ABCDEE+Arial-BoldMT                  CID TrueType      Identity-H       yes yes yes     10  0
   */
  private parseFonts(stdout: string): FontInfo[] {
    const lines = stdout.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    // Parse separator line to find column positions
    const separatorLine = lines[1];

    // Use separator line dashes to find column boundaries
    // Each column is separated by a space between dash groups
    const columnBoundaries: { start: number; end: number }[] = [];
    let inDash = false;
    let colStart = 0;

    for (let i = 0; i <= separatorLine.length; i++) {
      const char = separatorLine[i];
      if (char === '-' && !inDash) {
        colStart = i;
        inDash = true;
      } else if ((char !== '-' || i === separatorLine.length) && inDash) {
        columnBoundaries.push({ start: colStart, end: i });
        inDash = false;
      }
    }

    if (columnBoundaries.length < 6) return [];

    const fonts: FontInfo[] = [];

    // Parse each font line (skip header and separator)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Extract values using column boundaries
      const name = line.substring(columnBoundaries[0].start, columnBoundaries[0].end).trim();
      const type = line.substring(columnBoundaries[1].start, columnBoundaries[1].end).trim();
      const encoding = line.substring(columnBoundaries[2].start, columnBoundaries[2].end).trim();
      const emb = line.substring(columnBoundaries[3].start, columnBoundaries[3].end).trim().toLowerCase();
      const sub = line.substring(columnBoundaries[4].start, columnBoundaries[4].end).trim().toLowerCase();
      const uni = line.substring(columnBoundaries[5].start, columnBoundaries[5].end).trim().toLowerCase();

      fonts.push({
        name,
        type,
        encoding,
        embedded: emb === 'yes',
        subset: sub === 'yes',
        unicode: uni === 'yes',
      });
    }

    return fonts;
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
   * Wrap error with stderr information and detect error type
   */
  private wrapError(error: Error, stderr?: string): PdfPopplerError {
    const stderrLower = (stderr || '').toLowerCase();
    const messageLower = error.message.toLowerCase();
    const combined = stderrLower + ' ' + messageLower;

    // Detect encrypted/password-protected PDF
    if (
      combined.includes('encrypted') ||
      combined.includes('password') ||
      combined.includes('permission denied')
    ) {
      return new EncryptedPdfError('PDF is password protected', stderr);
    }

    // Detect invalid PDF
    if (
      combined.includes('not a pdf') ||
      combined.includes('invalid pdf') ||
      combined.includes('corrupted') ||
      combined.includes('couldn\'t open') ||
      combined.includes('error opening') ||
      combined.includes('syntax error') ||
      combined.includes('command line error') ||
      combined.includes('pdf file is damaged')
    ) {
      return new InvalidPdfError('Invalid or corrupted PDF file', stderr);
    }

    // Default to base error
    const message = stderr
      ? `${error.message}\nStderr: ${stderr}`
      : error.message;
    return new PdfPopplerError(message, stderr);
  }
}
