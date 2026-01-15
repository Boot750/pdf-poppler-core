/**
 * Type definitions for pdf-poppler-core
 */

import { Readable } from 'stream';

/** Supported platforms */
export type Platform = 'win32' | 'darwin' | 'linux';

/** Supported output formats for PDF conversion */
export type OutputFormat = 'png' | 'jpeg' | 'tiff' | 'pdf' | 'ps' | 'eps' | 'svg';

/** Input source - Buffer, Uint8Array, or Readable stream */
export type PdfInput = Buffer | Uint8Array | Readable;

/**
 * Configuration options for PdfPoppler
 */
export interface PdfPopplerConfig {
  /** Path to the bin directory containing poppler executables */
  binaryPath?: string;

  /** Custom npm package name that provides binaries */
  binaryPackage?: string;

  /** Preferred poppler version (e.g., "24.02") */
  version?: string;

  /** Whether to prefer xvfb variant for headless environments */
  preferXvfb?: boolean;

  /** Override platform detection */
  platform?: Platform;

  /** Override Lambda detection */
  isLambda?: boolean;

  /** Override CI detection */
  isCI?: boolean;

  /** Custom exec options for child_process */
  execOptions?: ExecOptions;
}

/**
 * Exec options for child_process
 */
export interface ExecOptions {
  encoding?: BufferEncoding;
  maxBuffer?: number;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Options for PDF to image conversion
 */
export interface ConvertOptions {
  /** Output format (default: 'png') */
  format?: OutputFormat;

  /** Scale to this size in pixels (default: 1024 for raster formats) */
  scale?: number | null;

  /** Convert only this page number (default: all pages) */
  page?: number | null;
}

/**
 * Result of a single page conversion to buffer
 */
export interface PageResult {
  /** Page number (1-indexed) */
  page: number;
  /** Image data as Buffer */
  data: Buffer;
}

/**
 * Result of a single page conversion to stream
 */
export interface PageStreamResult {
  /** Page number (1-indexed) */
  page: number;
  /** Image data as Readable stream */
  stream: Readable;
}

/**
 * PDF metadata information
 */
export interface PdfInfo {
  /** Number of pages as string */
  pages: string;

  /** Page size (e.g., "595.276 x 841.89 pts (A4)") */
  page_size: string;

  /** Page width in points */
  width_in_pts: number;

  /** Page height in points */
  height_in_pts: number;

  /** Document title (if available) */
  title?: string;

  /** Document author (if available) */
  author?: string;

  /** Document creator (if available) */
  creator?: string;

  /** Document producer (if available) */
  producer?: string;

  /** Creation date (if available) */
  creation_date?: string;

  /** Modification date (if available) */
  mod_date?: string;

  /** Allow any additional metadata fields */
  [key: string]: string | number | undefined;
}

/**
 * Image data extracted from PDF
 */
export interface ImageData {
  page: string;
  num: string;
  type: string;
  width: string;
  height: string;
  color: string;
  comp: string;
  bpc: string;
  enc: string;
  interp: string;
  object: string;
  ID: string;
  'x-ppi': string;
  'y-ppi': string;
  size: string;
  ratio: string;
  [key: string]: string;
}

/**
 * Information about an available poppler version
 */
export interface VersionInfo {
  /** Version number (e.g., "24.02") */
  version: string;

  /** Whether this version includes bundled Xvfb */
  hasXvfb: boolean;

  /** Path to this version's directory */
  path: string;
}

/**
 * Internal resolved configuration (all fields required)
 */
export interface ResolvedConfig {
  platform: Platform;
  isLambda: boolean;
  isCI: boolean;
  preferXvfb: boolean;
  binaryPath?: string;
  binaryPackage?: string;
  version?: string;
  execOptions: Required<Pick<ExecOptions, 'encoding' | 'maxBuffer'>> & ExecOptions;
}
