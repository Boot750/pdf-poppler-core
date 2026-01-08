/**
 * pdf-poppler-core
 *
 * Convert PDF files to images using Poppler with a class-based API.
 *
 * @example
 * ```typescript
 * import { PdfPoppler } from 'pdf-poppler-core';
 *
 * // Auto-detect everything
 * const poppler = new PdfPoppler();
 * const info = await poppler.info('/path/to/file.pdf');
 * await poppler.convert('/path/to/file.pdf', { format: 'png' });
 *
 * // With builder pattern
 * const poppler = PdfPoppler.configure()
 *   .withOsBinary()
 *   .withPreferXvfb(false)
 *   .build();
 *
 * // Factory methods
 * const lambdaPoppler = PdfPoppler.forLambda();
 * const ciPoppler = PdfPoppler.forCI();
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
  PdfPopplerConfig,
  ExecOptions,
  ConvertOptions,
  PdfInfo,
  ImageData,
  VersionInfo,
  ResolvedConfig,
} from './types';

// Platform utilities (for advanced usage)
export { BinaryResolver } from './platform/BinaryResolver';
export { EnvironmentDetector } from './platform/EnvironmentDetector';
