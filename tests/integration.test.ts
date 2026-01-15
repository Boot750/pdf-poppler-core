import * as path from 'path';
import * as fs from 'fs';
import { PdfPoppler } from 'pdf-poppler-core';

describe.skip('Integration Tests', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  const testOutputDir = path.join(__dirname, '..', 'test-output');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);

    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  describe('End-to-End PDF Processing', () => {
    it('should complete full PDF processing workflow', async () => {
      // Step 1: Get PDF info
      const info = await poppler.info(samplePdfBuffer);
      expect(info).toBeDefined();
      expect(info.pages).toBeDefined();

      const pageCount = parseInt(info.pages);
      expect(pageCount).toBeGreaterThan(0);

      // Step 2: Extract image data
      const imageData = await poppler.imgdata(samplePdfBuffer);
      expect(Array.isArray(imageData)).toBe(true);

      // Step 3: Convert to images (returns buffers)
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png'
      });

      expect(pages.length).toBeGreaterThan(0);
      expect(pages.length).toBeLessThanOrEqual(pageCount);

      // Verify each page buffer is reasonable
      pages.forEach(page => {
        expect(page.data).toBeInstanceOf(Buffer);
        expect(page.data.length).toBeGreaterThan(1000); // At least 1KB
      });
    });

    it('should handle different format conversions consistently', async () => {
      const formats: Array<'png' | 'jpeg'> = ['png', 'jpeg'];
      const results: { [key: string]: Buffer } = {};

      for (const format of formats) {
        const pages = await poppler.convert(samplePdfBuffer, {
          format: format,
          page: 1
        });

        expect(pages.length).toBe(1);
        results[format] = pages[0].data;
      }

      // Verify both formats created buffers
      expect(results.png.length).toBeGreaterThan(0);
      expect(results.jpeg.length).toBeGreaterThan(0);

      // PNG is usually larger than JPEG for the same content
      expect(results.png.length).toBeGreaterThan(results.jpeg.length * 0.5);
    });

    it('should maintain consistency across multiple operations', async () => {
      // Run info extraction multiple times
      const info1 = await poppler.info(samplePdfBuffer);
      const info2 = await poppler.info(samplePdfBuffer);

      expect(info1.pages).toBe(info2.pages);
      expect(info1.width_in_pts).toBe(info2.width_in_pts);
      expect(info1.height_in_pts).toBe(info2.height_in_pts);

      // Run image data extraction multiple times
      const imgdata1 = await poppler.imgdata(samplePdfBuffer);
      const imgdata2 = await poppler.imgdata(samplePdfBuffer);

      expect(imgdata1.length).toBe(imgdata2.length);

      // Run conversion multiple times
      const pages1 = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      const pages2 = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      expect(pages1.length).toBe(pages2.length);
      // Buffer sizes should be identical
      expect(pages1[0].data.length).toBe(pages2[0].data.length);
    });

    it('should handle concurrent operations safely', async () => {
      const concurrentOperations = [
        poppler.info(samplePdfBuffer),
        poppler.imgdata(samplePdfBuffer),
        poppler.convert(samplePdfBuffer, {
          format: 'png',
          page: 1
        }),
        poppler.convert(samplePdfBuffer, {
          format: 'jpeg',
          page: 1
        })
      ];

      const results = await Promise.all(concurrentOperations);

      // Verify all operations completed
      expect(results).toHaveLength(4);

      // Verify info result
      expect(results[0]).toHaveProperty('pages');

      // Verify imgdata result
      expect(Array.isArray(results[1])).toBe(true);

      // Verify both conversions returned buffers
      expect(results[2]).toHaveLength(1);
      expect(results[3]).toHaveLength(1);
      expect((results[2] as any)[0].data).toBeInstanceOf(Buffer);
      expect((results[3] as any)[0].data).toBeInstanceOf(Buffer);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from invalid input errors', async () => {
      const invalidBuffer = Buffer.from('not a pdf');

      // First, try invalid input
      await expect(poppler.convert(invalidBuffer, {
        format: 'png',
        page: 1
      })).rejects.toThrow();

      // Should still work with valid input after error
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      expect(pages.length).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);
    });

    it('should handle mixed valid and invalid operations', async () => {
      const invalidBuffer = Buffer.from('not a pdf');

      const operations = [
        poppler.info(samplePdfBuffer), // Valid
        poppler.info(invalidBuffer), // Invalid
        poppler.convert(samplePdfBuffer, { // Valid
          format: 'png',
          page: 1
        })
      ];

      const results = await Promise.allSettled(operations);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      // Verify the valid conversion worked
      if (results[2].status === 'fulfilled') {
        expect((results[2].value as any).length).toBe(1);
      }
    });
  });

  describe('Data Integrity', () => {
    it('should produce consistent image outputs for same input', async () => {
      // First conversion
      const pages1 = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      // Second conversion
      const pages2 = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      // Buffer sizes should be identical
      expect(pages1[0].data.length).toBe(pages2[0].data.length);

      // Buffers should be equal
      expect(pages1[0].data.equals(pages2[0].data)).toBe(true);
    });

    it('should be able to save buffers to files', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      const outputPath = path.join(testOutputDir, 'integration-save-test.png');
      fs.writeFileSync(outputPath, pages[0].data);

      expect(fs.existsSync(outputPath)).toBe(true);
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBe(pages[0].data.length);

      // Verify PNG header
      const savedBuffer = fs.readFileSync(outputPath);
      expect(savedBuffer[0]).toBe(0x89);
      expect(savedBuffer[1]).toBe(0x50);

      // Clean up
      fs.unlinkSync(outputPath);
    });
  });
});
