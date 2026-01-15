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

/** Antialias mode for rendering */
export type AntialiasMode = 'default' | 'none' | 'gray' | 'subpixel';

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

  /** Convert specific pages (e.g., [1, 3, 5]) */
  pages?: number[];

  /** Resolution in DPI (alternative to scale, takes precedence) */
  dpi?: number;

  /** JPEG quality 1-100 (only for JPEG format) */
  quality?: number;

  /** First page to convert (for page ranges) */
  firstPage?: number;

  /** Last page to convert (for page ranges) */
  lastPage?: number;

  /** PDF user password (for encrypted PDFs) */
  password?: string;

  /** PDF owner password (for encrypted PDFs) */
  ownerPassword?: string;

  /** Use crop box instead of media box */
  cropBox?: boolean;

  /** Transparent background for PNG */
  transparent?: boolean;

  /** Antialias mode for rendering */
  antialias?: AntialiasMode;
}

/**
 * Options for text extraction
 */
export interface TextOptions {
  /** Extract from specific page only */
  page?: number;

  /** First page to extract (for page ranges) */
  firstPage?: number;

  /** Last page to extract (for page ranges) */
  lastPage?: number;

  /** Maintain original layout spacing */
  layout?: boolean;

  /** Raw text extraction order */
  raw?: boolean;

  /** PDF user password (for encrypted PDFs) */
  password?: string;

  /** Output encoding (default: UTF-8) */
  encoding?: string;

  /** Line ending style */
  eol?: 'unix' | 'dos' | 'mac';

  /** Skip diagonal text */
  noDiag?: boolean;

  /** No page break characters (form feed) */
  noPageBreaks?: boolean;
}

/**
 * Options for HTML conversion
 */
export interface HtmlOptions {
  /** Convert specific page only */
  page?: number;

  /** First page to convert (for page ranges) */
  firstPage?: number;

  /** Last page to convert (for page ranges) */
  lastPage?: number;

  /** PDF user password (for encrypted PDFs) */
  password?: string;

  /** Don't generate frame structure */
  noFrames?: boolean;

  /** Generate complex HTML (tries to preserve layout) */
  complex?: boolean;

  /** Generate single HTML page for all pages */
  singlePage?: boolean;

  /** Don't include images in output */
  ignoreImages?: boolean;

  /** Zoom factor (e.g., 1.5 for 150%) */
  zoom?: number;
}

/**
 * Result of text extraction for a single page
 */
export interface TextResult {
  /** Page number (1-indexed) */
  page: number;

  /** Extracted text content */
  text: string;
}

/**
 * Font information from pdffonts
 */
export interface FontInfo {
  /** Font name */
  name: string;

  /** Font type (e.g., "Type 1", "TrueType", "CID Type 0") */
  type: string;

  /** Font encoding */
  encoding: string;

  /** Whether the font is embedded in the PDF */
  embedded: boolean;

  /** Whether the font is a subset */
  subset: boolean;

  /** Whether the font has Unicode mapping */
  unicode: boolean;
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
 * Result of splitting a PDF page
 */
export interface SplitResult {
  /** Page number (1-indexed) */
  page: number;
  /** Single-page PDF as Buffer */
  data: Buffer;
}

/**
 * Result of splitting a PDF page to stream
 */
export interface SplitStreamResult {
  /** Page number (1-indexed) */
  page: number;
  /** Single-page PDF as Readable stream */
  stream: Readable;
}

/**
 * PDF attachment information
 */
export interface Attachment {
  /** Attachment index (1-indexed) */
  index: number;
  /** Attachment filename */
  name: string;
  /** Optional description */
  description?: string;
  /** File size in bytes */
  size: number;
  /** Creation date (if available) */
  creationDate?: string;
  /** Modification date (if available) */
  modDate?: string;
}

/**
 * Extracted attachment data
 */
export interface ExtractedAttachment {
  /** Attachment filename */
  name: string;
  /** Attachment data */
  data: Buffer;
}

/**
 * Digital signature information
 */
export interface SignatureDetails {
  /** Signer name */
  signerName?: string;
  /** Signer certificate info */
  signerCertificate?: string;
  /** Signing time */
  signTime?: string;
  /** Hash algorithm used */
  hashAlgorithm?: string;
  /** Whether signature is valid */
  valid: boolean;
  /** Whether signature is trusted */
  trusted: boolean;
}

/**
 * Result of signature verification
 */
export interface SignatureInfo {
  /** Whether the PDF is signed */
  signed: boolean;
  /** List of signatures found */
  signatures: SignatureDetails[];
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
