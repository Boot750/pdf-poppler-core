import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler } from 'pdf-poppler-core';

describe('PDF Info Functionality', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);
  });

  describe('poppler.info()', () => {
    it('should extract basic PDF information from buffer', async () => {
      const info = await poppler.info(samplePdfBuffer);

      expect(info).toBeDefined();
      expect(typeof info).toBe('object');

      // Check for essential properties that are always present
      expect(info).toHaveProperty('pages');
      expect(info).toHaveProperty('page_size');
      expect(info).toHaveProperty('width_in_pts');
      expect(info).toHaveProperty('height_in_pts');
    });

    it('should parse page dimensions correctly', async () => {
      const info = await poppler.info(samplePdfBuffer);

      expect(info.width_in_pts).toBeGreaterThan(0);
      expect(info.height_in_pts).toBeGreaterThan(0);
      expect(typeof info.width_in_pts).toBe('number');
      expect(typeof info.height_in_pts).toBe('number');
    });

    it('should parse page count correctly', async () => {
      const info = await poppler.info(samplePdfBuffer);

      expect(info.pages).toBeDefined();
      expect(parseInt(info.pages)).toBeGreaterThan(0);
    });

    it('should handle invalid PDF data gracefully', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      await expect(poppler.info(invalidBuffer)).rejects.toThrow();
    });

    it('should return consistent data structure', async () => {
      const info = await poppler.info(samplePdfBuffer);

      // Verify expected property names (lowercase with underscores)
      const requiredProperties = [
        'pages', 'page_size', 'width_in_pts', 'height_in_pts'
      ];

      requiredProperties.forEach(prop => {
        expect(info).toHaveProperty(prop);
      });

      // Check that property names follow the expected format
      Object.keys(info).forEach(key => {
        expect(key).toMatch(/^[a-z_]+$/);
      });
    });

    it('should work with Uint8Array input', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const info = await poppler.info(uint8Array);

      expect(info).toBeDefined();
      expect(info.pages).toBeDefined();
      expect(parseInt(info.pages)).toBeGreaterThan(0);
    });

    it('should work with Readable stream input', async () => {
      const stream = Readable.from(samplePdfBuffer);
      const info = await poppler.info(stream);

      expect(info).toBeDefined();
      expect(info.pages).toBeDefined();
      expect(parseInt(info.pages)).toBeGreaterThan(0);
    });

    it('should parse metadata fields correctly', async () => {
      const info = await poppler.info(samplePdfBuffer);

      // Check that all string values are properly trimmed
      Object.values(info).forEach(value => {
        if (typeof value === 'string') {
          expect(value).toBe(value.trim());
          expect(value).not.toMatch(/^\s+|\s+$/);
        }
      });
    });

    it('should handle PDF with different page sizes consistently', async () => {
      const info = await poppler.info(samplePdfBuffer);

      // Ensure dimensions are positive numbers
      expect(info.width_in_pts).toBeGreaterThan(0);
      expect(info.height_in_pts).toBeGreaterThan(0);

      // Ensure page_size format is consistent
      expect(info.page_size).toMatch(/^\d+(\.\d+)?\s*x\s*\d+(\.\d+)?/);
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      const invalidBuffer = Buffer.from('invalid pdf content');

      try {
        await poppler.info(invalidBuffer);
        fail('Expected an error to be thrown');
      } catch (error: any) {
        expect(error).toBeTruthy();
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(poppler.info(emptyBuffer)).rejects.toThrow();
    });

    it('should handle null/undefined input', async () => {
      await expect(poppler.info(null as any)).rejects.toThrow();
      await expect(poppler.info(undefined as any)).rejects.toThrow();
    });
  });
});
