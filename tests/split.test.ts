import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler, InvalidPdfError } from 'pdf-poppler-core';

describe('PDF Splitting', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);
  });

  describe('split()', () => {
    it('should split PDF into individual pages', async () => {
      const pages = await poppler.split(samplePdfBuffer);

      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      expect(pages.length).toBe(totalPages);
    });

    it('should return valid PDFs for each page', async () => {
      const pages = await poppler.split(samplePdfBuffer);

      for (const page of pages) {
        // Verify it's a valid PDF
        expect(page.data.slice(0, 5).toString()).toBe('%PDF-');

        // Each page should be a single-page PDF
        const pageInfo = await poppler.info(page.data);
        expect(pageInfo.pages).toBe('1');
      }
    });

    it('should have correct page numbers', async () => {
      const pages = await poppler.split(samplePdfBuffer);

      pages.forEach((page, index) => {
        expect(page.page).toBe(index + 1);
      });
    });

    it('should return buffers for each page', async () => {
      const pages = await poppler.split(samplePdfBuffer);

      pages.forEach(page => {
        expect(page.data).toBeInstanceOf(Buffer);
        expect(page.data.length).toBeGreaterThan(0);
      });
    });

    it('should accept Buffer input', async () => {
      const pages = await poppler.split(samplePdfBuffer);
      expect(pages.length).toBeGreaterThan(0);
    });

    it('should accept Uint8Array input', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const pages = await poppler.split(uint8Array);
      expect(pages.length).toBeGreaterThan(0);
    });

    it('should accept Readable stream input', async () => {
      const stream = Readable.from(samplePdfBuffer);
      const pages = await poppler.split(stream);
      expect(pages.length).toBeGreaterThan(0);
    });

    it('should be reversible with merge', async () => {
      // Split the PDF
      const pages = await poppler.split(samplePdfBuffer);

      // Merge back together
      const merged = await poppler.merge(pages.map(p => p.data));

      // Should have same page count as original
      const originalInfo = await poppler.info(samplePdfBuffer);
      const mergedInfo = await poppler.info(merged);

      expect(mergedInfo.pages).toBe(originalInfo.pages);
    });
  });

  describe('splitToStreams()', () => {
    it('should return streams for each page', async () => {
      const pageStreams = await poppler.splitToStreams(samplePdfBuffer);

      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      expect(pageStreams.length).toBe(totalPages);
    });

    it('should return Readable streams', async () => {
      const pageStreams = await poppler.splitToStreams(samplePdfBuffer);

      pageStreams.forEach(page => {
        expect(typeof page.stream.pipe).toBe('function');
        expect(page.stream).toBeInstanceOf(Readable);
      });
    });

    it('should have correct page numbers', async () => {
      const pageStreams = await poppler.splitToStreams(samplePdfBuffer);

      pageStreams.forEach((page, index) => {
        expect(page.page).toBe(index + 1);
      });
    });

    it('should return valid PDF data when consumed', async () => {
      const pageStreams = await poppler.splitToStreams(samplePdfBuffer);

      // Consume first stream
      const chunks: Buffer[] = [];
      for await (const chunk of pageStreams[0].stream) {
        chunks.push(Buffer.from(chunk));
      }
      const result = Buffer.concat(chunks);

      expect(result.slice(0, 5).toString()).toBe('%PDF-');
    });
  });

  describe('Error Handling', () => {
    it('should throw InvalidPdfError for invalid input', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      await expect(poppler.split(invalidBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw InvalidPdfError for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(poppler.split(emptyBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw error for null input', async () => {
      await expect(poppler.split(null as any)).rejects.toThrow();
    });

    it('should throw error for undefined input', async () => {
      await expect(poppler.split(undefined as any)).rejects.toThrow();
    });
  });
});
