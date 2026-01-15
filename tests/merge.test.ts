import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler, InvalidPdfError } from 'pdf-poppler-core';

describe('PDF Merging', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);
  });

  describe('merge()', () => {
    it('should merge multiple PDFs into one', async () => {
      const merged = await poppler.merge([samplePdfBuffer, samplePdfBuffer]);

      expect(merged).toBeInstanceOf(Buffer);
      // Verify it's a valid PDF
      expect(merged.slice(0, 5).toString()).toBe('%PDF-');

      // Get page count of merged PDF
      const mergedInfo = await poppler.info(merged);
      const originalInfo = await poppler.info(samplePdfBuffer);

      const originalPages = parseInt(originalInfo.pages, 10);
      const mergedPages = parseInt(mergedInfo.pages, 10);

      // Merged should have pages from both PDFs
      expect(mergedPages).toBe(originalPages * 2);
    });

    it('should handle single PDF input', async () => {
      const merged = await poppler.merge([samplePdfBuffer]);

      expect(merged).toBeInstanceOf(Buffer);
      expect(merged.slice(0, 5).toString()).toBe('%PDF-');

      // Should have same page count as original
      const mergedInfo = await poppler.info(merged);
      const originalInfo = await poppler.info(samplePdfBuffer);

      expect(mergedInfo.pages).toBe(originalInfo.pages);
    });

    it('should merge three or more PDFs', async () => {
      const merged = await poppler.merge([
        samplePdfBuffer,
        samplePdfBuffer,
        samplePdfBuffer
      ]);

      expect(merged).toBeInstanceOf(Buffer);

      const mergedInfo = await poppler.info(merged);
      const originalInfo = await poppler.info(samplePdfBuffer);

      const originalPages = parseInt(originalInfo.pages, 10);
      const mergedPages = parseInt(mergedInfo.pages, 10);

      expect(mergedPages).toBe(originalPages * 3);
    });

    it('should accept Buffer input', async () => {
      const merged = await poppler.merge([samplePdfBuffer, samplePdfBuffer]);
      expect(merged).toBeInstanceOf(Buffer);
    });

    it('should accept Uint8Array input', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const merged = await poppler.merge([uint8Array, uint8Array]);
      expect(merged).toBeInstanceOf(Buffer);
    });

    it('should accept Readable stream input', async () => {
      const stream1 = Readable.from(samplePdfBuffer);
      const stream2 = Readable.from(samplePdfBuffer);
      const merged = await poppler.merge([stream1, stream2]);
      expect(merged).toBeInstanceOf(Buffer);
    });

    it('should accept mixed input types', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const stream = Readable.from(samplePdfBuffer);
      const merged = await poppler.merge([samplePdfBuffer, uint8Array, stream]);
      expect(merged).toBeInstanceOf(Buffer);
    });

    it('should preserve content from all PDFs', async () => {
      // Merge and verify both PDFs' content is present
      const merged = await poppler.merge([samplePdfBuffer, samplePdfBuffer]);

      // Convert pages to check content exists
      const pages = await poppler.convert(merged, { format: 'png', dpi: 72 });

      const originalInfo = await poppler.info(samplePdfBuffer);
      const originalPages = parseInt(originalInfo.pages, 10);

      expect(pages.length).toBe(originalPages * 2);
      pages.forEach(page => {
        expect(page.data.length).toBeGreaterThan(0);
      });
    });
  });

  describe('mergeToStream()', () => {
    it('should return a Readable stream', async () => {
      const stream = await poppler.mergeToStream([samplePdfBuffer, samplePdfBuffer]);

      expect(typeof stream.pipe).toBe('function');
      expect(stream).toBeInstanceOf(Readable);

      // Consume stream to verify it works
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const result = Buffer.concat(chunks);

      expect(result.slice(0, 5).toString()).toBe('%PDF-');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for empty array', async () => {
      await expect(poppler.merge([])).rejects.toThrow();
    });

    it('should throw InvalidPdfError for invalid input', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      await expect(poppler.merge([invalidBuffer])).rejects.toThrow(InvalidPdfError);
    });

    it('should throw error if any PDF is invalid', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      await expect(poppler.merge([samplePdfBuffer, invalidBuffer])).rejects.toThrow();
    });

    it('should throw error for null input', async () => {
      await expect(poppler.merge(null as any)).rejects.toThrow();
    });

    it('should throw error for undefined input', async () => {
      await expect(poppler.merge(undefined as any)).rejects.toThrow();
    });
  });
});
