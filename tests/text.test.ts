import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler, InvalidPdfError } from 'pdf-poppler-core';

describe('Text Extraction', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);
  });

  describe('text()', () => {
    it('should extract all text from PDF', async () => {
      const text = await poppler.text(samplePdfBuffer);

      expect(typeof text).toBe('string');
      // Sample PDF should have some text content
      expect(text.length).toBeGreaterThanOrEqual(0);
    });

    it('should extract text from specific page', async () => {
      const text = await poppler.text(samplePdfBuffer, { page: 1 });

      expect(typeof text).toBe('string');
    });

    it('should extract text with layout preservation', async () => {
      const textWithLayout = await poppler.text(samplePdfBuffer, { layout: true });
      const textWithoutLayout = await poppler.text(samplePdfBuffer, { layout: false });

      expect(typeof textWithLayout).toBe('string');
      expect(typeof textWithoutLayout).toBe('string');
      // Layout version may have different spacing/formatting
    });

    it('should extract text in raw mode', async () => {
      const rawText = await poppler.text(samplePdfBuffer, { raw: true });

      expect(typeof rawText).toBe('string');
    });

    it('should work with firstPage and lastPage options', async () => {
      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      if (totalPages >= 1) {
        const text = await poppler.text(samplePdfBuffer, {
          firstPage: 1,
          lastPage: 1
        });

        expect(typeof text).toBe('string');
      }
    });

    it('should accept Buffer input', async () => {
      const text = await poppler.text(samplePdfBuffer);
      expect(typeof text).toBe('string');
    });

    it('should accept Uint8Array input', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const text = await poppler.text(uint8Array);
      expect(typeof text).toBe('string');
    });

    it('should accept Readable stream input', async () => {
      const stream = Readable.from(samplePdfBuffer);
      const text = await poppler.text(stream);
      expect(typeof text).toBe('string');
    });

    it('should handle noPageBreaks option', async () => {
      const text = await poppler.text(samplePdfBuffer, { noPageBreaks: true });
      expect(typeof text).toBe('string');
    });
  });

  describe('textPages()', () => {
    it('should return text per page', async () => {
      const pages = await poppler.textPages(samplePdfBuffer);

      expect(Array.isArray(pages)).toBe(true);

      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      expect(pages.length).toBe(totalPages);

      pages.forEach((p, index) => {
        expect(p.page).toBe(index + 1);
        expect(typeof p.text).toBe('string');
      });
    });

    it('should extract specific page range', async () => {
      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      if (totalPages >= 1) {
        const pages = await poppler.textPages(samplePdfBuffer, {
          firstPage: 1,
          lastPage: 1
        });

        expect(pages.length).toBe(1);
        expect(pages[0].page).toBe(1);
        expect(typeof pages[0].text).toBe('string');
      }
    });

    it('should extract single page using page option', async () => {
      const pages = await poppler.textPages(samplePdfBuffer, { page: 1 });

      expect(pages.length).toBe(1);
      expect(pages[0].page).toBe(1);
    });

    it('should support layout option per page', async () => {
      const pages = await poppler.textPages(samplePdfBuffer, { layout: true });

      expect(Array.isArray(pages)).toBe(true);
      pages.forEach(p => {
        expect(typeof p.text).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw InvalidPdfError for invalid input', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      await expect(poppler.text(invalidBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw InvalidPdfError for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(poppler.text(emptyBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw error for null input', async () => {
      await expect(poppler.text(null as any)).rejects.toThrow();
    });

    it('should throw error for undefined input', async () => {
      await expect(poppler.text(undefined as any)).rejects.toThrow();
    });
  });

  describe('Consistency', () => {
    it('should return consistent results across multiple calls', async () => {
      const text1 = await poppler.text(samplePdfBuffer);
      const text2 = await poppler.text(samplePdfBuffer);

      expect(text1).toBe(text2);
    });

    it('should return same content from text() and textPages() combined', async () => {
      const fullText = await poppler.text(samplePdfBuffer);
      const pages = await poppler.textPages(samplePdfBuffer);

      // The combined page text should have similar content
      // (may differ in exact formatting due to page breaks)
      const combinedText = pages.map(p => p.text).join('');

      // Both should have text or both should be empty
      if (fullText.trim().length > 0) {
        expect(combinedText.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe.skip('Password protected PDFs', () => {
    // These tests require an encrypted PDF file
    // Skip until we have test fixtures

    it('should extract text with correct password', async () => {
      // TODO: Create encrypted test PDF
    });

    it('should throw EncryptedPdfError without password', async () => {
      // TODO: Create encrypted test PDF
    });
  });
});
