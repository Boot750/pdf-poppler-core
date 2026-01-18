/**
 * pdf-poppler-core
 *
 * Convert PDF to images using Poppler with a streaming API.
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
 *
 * // Convert to image buffers
 * const pages = await poppler.convert(pdfBuffer, { format: 'png' });
 * pages.forEach(({ page, data }) => {
 *   fs.writeFileSync(`page-${page}.png`, data);
 * });
 *
 * // Or get streams for piping
 * const streams = await poppler.convertToStream(pdfBuffer, { format: 'png' });
 *
 * // Flatten PDF
 * const flattened = await poppler.flatten(pdfBuffer);
 *
 * // Factory methods
 * const lambdaPoppler = PdfPoppler.forLambda();
 * ```
 */

// Main class
export { PdfPoppler } from './PdfPoppler';

// Configuration builder
export { PdfPopplerConfigBuilder, configure } from './PdfPopplerConfig';

// Types
export {
  Platform,
  OutputFormat,
  AntialiasMode,
  PdfPopplerConfig,
  ExecOptions,
  ConvertOptions,
  TextOptions,
  TextResult,
  HtmlOptions,
  FontInfo,
  PdfInfo,
  ImageData,
  VersionInfo,
  ResolvedConfig,
  PdfInput,
  PageResult,
  PageStreamResult,
  SplitResult,
  SplitStreamResult,
  Attachment,
  ExtractedAttachment,
  SignatureDetails,
  SignatureInfo,
} from './types';

// Error types
export {
  PdfPopplerError,
  InvalidPdfError,
  EncryptedPdfError,
  PageOutOfRangeError,
  BinaryNotFoundError,
} from './errors';

// Platform utilities (for advanced usage)
export { BinaryResolver } from './platform/BinaryResolver';
export { EnvironmentDetector } from './platform/EnvironmentDetector';
