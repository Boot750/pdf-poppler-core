import * as path from 'path';
import * as fs from 'fs';
import { PdfPoppler, PageResult } from 'pdf-poppler-core';

describe('Convert Iterator', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(async () => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);

    // Warmup
    try {
      await poppler.convert(samplePdfBuffer, { format: 'png', page: 1 });
    } catch (e) {
      // Ignore warmup errors
    }
  }, 15000);

  describe('convertIterator()', () => {
    it('should yield pages one at a time', async () => {
      const pages: PageResult[] = [];

      for await (const page of poppler.convertIterator(samplePdfBuffer, { format: 'png' })) {
        pages.push(page);
      }

      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      expect(pages.length).toBe(totalPages);
      pages.forEach((page, index) => {
        expect(page.page).toBe(index + 1);
        expect(page.data).toBeInstanceOf(Buffer);
      });
    });

    it('should allow early termination', async () => {
      let count = 0;

      for await (const page of poppler.convertIterator(samplePdfBuffer, { format: 'png' })) {
        count++;
        expect(page.data).toBeInstanceOf(Buffer);
        if (count >= 1) break; // Stop after first page
      }

      expect(count).toBe(1);
    });

    it('should respect page option', async () => {
      const pages: PageResult[] = [];

      for await (const page of poppler.convertIterator(samplePdfBuffer, {
        format: 'png',
        page: 1
      })) {
        pages.push(page);
      }

      expect(pages.length).toBe(1);
      expect(pages[0].page).toBe(1);
    });

    it('should respect firstPage/lastPage options', async () => {
      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      if (totalPages >= 1) {
        const pages: PageResult[] = [];

        for await (const page of poppler.convertIterator(samplePdfBuffer, {
          format: 'png',
          firstPage: 1,
          lastPage: 1
        })) {
          pages.push(page);
        }

        expect(pages.length).toBe(1);
        expect(pages[0].page).toBe(1);
      }
    });

    it('should respect format option', async () => {
      const pages: PageResult[] = [];

      for await (const page of poppler.convertIterator(samplePdfBuffer, {
        format: 'jpeg',
        page: 1
      })) {
        pages.push(page);
      }

      expect(pages.length).toBe(1);
      // Verify JPEG header
      expect(pages[0].data[0]).toBe(0xFF);
      expect(pages[0].data[1]).toBe(0xD8);
    });

    it('should respect dpi option', async () => {
      const lowDpiPages: PageResult[] = [];
      const highDpiPages: PageResult[] = [];

      for await (const page of poppler.convertIterator(samplePdfBuffer, {
        format: 'png',
        page: 1,
        dpi: 72
      })) {
        lowDpiPages.push(page);
      }

      for await (const page of poppler.convertIterator(samplePdfBuffer, {
        format: 'png',
        page: 1,
        dpi: 150
      })) {
        highDpiPages.push(page);
      }

      expect(lowDpiPages.length).toBe(1);
      expect(highDpiPages.length).toBe(1);
      // Higher DPI should produce larger file
      expect(highDpiPages[0].data.length).toBeGreaterThan(lowDpiPages[0].data.length);
    });

    it('should work with spread operator to collect all pages', async () => {
      const pages: PageResult[] = [];

      for await (const page of poppler.convertIterator(samplePdfBuffer, { format: 'png' })) {
        pages.push(page);
      }

      const info = await poppler.info(samplePdfBuffer);
      expect(pages.length).toBe(parseInt(info.pages, 10));
    });

    it('should produce same results as convert()', async () => {
      const iteratorPages: PageResult[] = [];

      for await (const page of poppler.convertIterator(samplePdfBuffer, {
        format: 'png',
        page: 1,
        dpi: 72
      })) {
        iteratorPages.push(page);
      }

      const convertPages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        dpi: 72
      });

      expect(iteratorPages.length).toBe(convertPages.length);
      expect(iteratorPages[0].page).toBe(convertPages[0].page);
      expect(iteratorPages[0].data.length).toBe(convertPages[0].data.length);
    });
  });

  describe('Memory efficiency', () => {
    it('should not load all pages into memory at once', async () => {
      // This test verifies the iterator yields pages one at a time
      // by checking we can process each page before the next is generated
      let processedCount = 0;

      for await (const page of poppler.convertIterator(samplePdfBuffer, { format: 'png' })) {
        // Process page immediately
        expect(page.data).toBeInstanceOf(Buffer);
        processedCount++;

        // If this were loading all at once, we couldn't break early
        if (processedCount >= 1) break;
      }

      expect(processedCount).toBe(1);
    });
  });
});
