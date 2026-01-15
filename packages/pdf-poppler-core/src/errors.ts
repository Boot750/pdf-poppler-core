/**
 * Base error class for all pdf-poppler-core errors
 */
export class PdfPopplerError extends Error {
  constructor(message: string, public readonly stderr?: string) {
    super(message);
    this.name = 'PdfPopplerError';
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when the input is not a valid PDF file
 */
export class InvalidPdfError extends PdfPopplerError {
  constructor(message: string = 'Invalid or corrupted PDF file', stderr?: string) {
    super(message, stderr);
    this.name = 'InvalidPdfError';
  }
}

/**
 * Thrown when the PDF is password protected and no password was provided
 */
export class EncryptedPdfError extends PdfPopplerError {
  constructor(message: string = 'PDF is password protected', stderr?: string) {
    super(message, stderr);
    this.name = 'EncryptedPdfError';
  }
}

/**
 * Thrown when a requested page number is out of range
 */
export class PageOutOfRangeError extends PdfPopplerError {
  constructor(
    public readonly page: number,
    public readonly totalPages: number
  ) {
    super(`Page ${page} is out of range (1-${totalPages})`);
    this.name = 'PageOutOfRangeError';
  }
}

/**
 * Thrown when a required Poppler binary is not found
 */
export class BinaryNotFoundError extends PdfPopplerError {
  constructor(public readonly binary: string) {
    super(`Poppler binary not found: ${binary}`);
    this.name = 'BinaryNotFoundError';
  }
}
