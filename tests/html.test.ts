import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler, InvalidPdfError, BinaryNotFoundError } from 'pdf-poppler-core';

describe('HTML Conversion', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;
  let hasPdftohtml = false;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);

    // Check if pdftohtml binary exists
    const binPath = poppler.getPath();
    const pdftohtmlPath = process.platform === 'win32'
      ? path.join(binPath, 'pdftohtml.exe')
      : path.join(binPath, 'pdftohtml');
    hasPdftohtml = fs.existsSync(pdftohtmlPath);
  });

  describe('html()', () => {
    it('should convert PDF to HTML or throw BinaryNotFoundError', async () => {
      if (!hasPdftohtml) {
        await expect(poppler.html(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const html = await poppler.html(samplePdfBuffer);
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('should contain HTML tags or throw BinaryNotFoundError', async () => {
      if (!hasPdftohtml) {
        await expect(poppler.html(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const html = await poppler.html(samplePdfBuffer);
      // Should contain some HTML structure
      expect(html.toLowerCase()).toContain('<html');
      expect(html.toLowerCase()).toContain('</html>');
    });

    it('should convert specific page or throw BinaryNotFoundError', async () => {
      if (!hasPdftohtml) {
        await expect(poppler.html(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const html = await poppler.html(samplePdfBuffer, { page: 1 });
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('should convert page range or throw BinaryNotFoundError', async () => {
      if (!hasPdftohtml) {
        await expect(poppler.html(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const html = await poppler.html(samplePdfBuffer, {
        firstPage: 1,
        lastPage: 1
      });
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('should respect singlePage option or throw BinaryNotFoundError', async () => {
      if (!hasPdftohtml) {
        await expect(poppler.html(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const html = await poppler.html(samplePdfBuffer, { singlePage: true });
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('should accept Buffer input or throw BinaryNotFoundError', async () => {
      if (!hasPdftohtml) {
        await expect(poppler.html(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const html = await poppler.html(samplePdfBuffer);
      expect(typeof html).toBe('string');
    });

    it('should accept Uint8Array input or throw BinaryNotFoundError', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      if (!hasPdftohtml) {
        await expect(poppler.html(uint8Array)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const html = await poppler.html(uint8Array);
      expect(typeof html).toBe('string');
    });

    it('should accept Readable stream input or throw BinaryNotFoundError', async () => {
      const stream = Readable.from(samplePdfBuffer);
      if (!hasPdftohtml) {
        await expect(poppler.html(stream)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const html = await poppler.html(stream);
      expect(typeof html).toBe('string');
    });

    it('should return consistent HTML structure or throw BinaryNotFoundError', async () => {
      if (!hasPdftohtml) {
        await expect(poppler.html(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const html1 = await poppler.html(samplePdfBuffer, { page: 1 });
      const html2 = await poppler.html(samplePdfBuffer, { page: 1 });

      // Both should contain the same essential HTML structure
      // (title may differ due to temp file path)
      expect(html1.toLowerCase()).toContain('<html');
      expect(html2.toLowerCase()).toContain('<html');
      expect(html1.length).toBeGreaterThan(0);
      expect(html2.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw appropriate error for invalid input', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      if (!hasPdftohtml) {
        await expect(poppler.html(invalidBuffer)).rejects.toThrow(BinaryNotFoundError);
      } else {
        await expect(poppler.html(invalidBuffer)).rejects.toThrow(InvalidPdfError);
      }
    });

    it('should throw appropriate error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      if (!hasPdftohtml) {
        await expect(poppler.html(emptyBuffer)).rejects.toThrow(BinaryNotFoundError);
      } else {
        await expect(poppler.html(emptyBuffer)).rejects.toThrow(InvalidPdfError);
      }
    });

    it('should throw error for null input', async () => {
      await expect(poppler.html(null as any)).rejects.toThrow();
    });

    it('should throw error for undefined input', async () => {
      await expect(poppler.html(undefined as any)).rejects.toThrow();
    });
  });

  describe.skip('Password protected PDFs', () => {
    // These tests require an encrypted PDF file
    // Skip until we have test fixtures

    it('should convert with correct password', async () => {
      // TODO: Create encrypted test PDF
    });

    it('should throw EncryptedPdfError without password', async () => {
      // TODO: Create encrypted test PDF
    });
  });
});
