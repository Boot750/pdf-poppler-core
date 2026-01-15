import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler, InvalidPdfError } from 'pdf-poppler-core';

describe('Attachment Extraction', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);
  });

  describe('listAttachments()', () => {
    it('should return an array', async () => {
      const attachments = await poppler.listAttachments(samplePdfBuffer);
      expect(Array.isArray(attachments)).toBe(true);
    });

    it('should return empty array for PDF without attachments', async () => {
      // sample.pdf likely has no attachments
      const attachments = await poppler.listAttachments(samplePdfBuffer);
      expect(attachments).toEqual([]);
    });

    it('should accept Buffer input', async () => {
      const attachments = await poppler.listAttachments(samplePdfBuffer);
      expect(Array.isArray(attachments)).toBe(true);
    });

    it('should accept Uint8Array input', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const attachments = await poppler.listAttachments(uint8Array);
      expect(Array.isArray(attachments)).toBe(true);
    });

    it('should accept Readable stream input', async () => {
      const stream = Readable.from(samplePdfBuffer);
      const attachments = await poppler.listAttachments(stream);
      expect(Array.isArray(attachments)).toBe(true);
    });
  });

  describe('extractAllAttachments()', () => {
    it('should return an array', async () => {
      const attachments = await poppler.extractAllAttachments(samplePdfBuffer);
      expect(Array.isArray(attachments)).toBe(true);
    });

    it('should return empty array for PDF without attachments', async () => {
      const attachments = await poppler.extractAllAttachments(samplePdfBuffer);
      expect(attachments).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should throw InvalidPdfError for invalid input on listAttachments', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      await expect(poppler.listAttachments(invalidBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw InvalidPdfError for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(poppler.listAttachments(emptyBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw error for null input', async () => {
      await expect(poppler.listAttachments(null as any)).rejects.toThrow();
    });

    it('should throw error for undefined input', async () => {
      await expect(poppler.listAttachments(undefined as any)).rejects.toThrow();
    });

    it('should throw error when extracting non-existent attachment', async () => {
      // Trying to extract attachment 1 from a PDF with no attachments
      await expect(poppler.extractAttachment(samplePdfBuffer, 1)).rejects.toThrow();
    });
  });

  describe.skip('PDFs with attachments', () => {
    // These tests require a PDF with attachments
    // Skip until we have test fixtures

    it('should list attachments with correct properties', async () => {
      // TODO: Create PDF with attachments
    });

    it('should extract specific attachment by index', async () => {
      // TODO: Create PDF with attachments
    });

    it('should extract all attachments', async () => {
      // TODO: Create PDF with attachments
    });
  });
});
